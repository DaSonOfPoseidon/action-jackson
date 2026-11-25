// Post-build step, run after `ng build` of every app: puts a Content-Security-Policy <meta> into every built page.
//
// Angular 22's security.autoCsp refuses to combine with prerender, so this does the same job for every app (admin
// included). For each .html file under dist/<key>/browser it finds the inline executable <script>s (no src, and a
// type that is missing, text/javascript or module), hashes each over its exact bytes with SHA-256, and inserts, as
// the first child of <head>:
//   <meta http-equiv="Content-Security-Policy" content="script-src 'self' 'sha256-...' ...">
// listing that page's own hashes only. Nothing else is in the policy: the rest (base-uri, object-src, frame-ancestors,
// img-src and so on) comes from the edge's header, which is enforced together with this meta.
//
// The build FAILS (this script exits 1) when a page
//   - has an inline event-handler attribute (on...=) or a javascript: URL, which no hash could allow;
//   - already has a Content-Security-Policy meta (a second run over the same output stops here on purpose);
//   - cannot be scanned cleanly: an unclosed tag, comment or <script>, or no <head>.
//
// It reads and writes the files as latin1, so every byte outside the tags stays exactly as Angular wrote it and the
// hash is over the same bytes the browser sees. The scanner is deliberately narrow: it tokenizes tags and
// attributes only as far as these checks need, and skips the text of <script>, <style>, <textarea> and <title>.
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Elements whose content is text, not markup: a "<" inside them starts no tag.
const RAW_TEXT = new Set(['script', 'style', 'textarea', 'title']);
// A script runs unless its type is a data block (application/json, importmap, ...).
const EXECUTABLE_TYPES = new Set(['', 'text/javascript', 'module']);
// Attributes that hold a URL, where a javascript: value would run script. Other attributes (title, alt, ...) may
// contain the word.
const URL_ATTRIBUTES = new Set(['href', 'src', 'action', 'formaction', 'xlink:href', 'data', 'poster', 'background', 'cite', 'codebase', 'longdesc', 'manifest', 'ping', 'usemap']);

// Reads the start tag at html[start] === '<'. Returns { name, attrs, end } (end is the index after '>').
function readStartTag(html, start) {
  let i = start + 1;
  while (i < html.length && !/[\s/>]/.test(html[i])) i++;
  const name = html.slice(start + 1, i).toLowerCase();
  const attrs = [];
  for (;;) {
    while (i < html.length && /[\s/]/.test(html[i])) i++;
    if (i >= html.length) throw new Error(`unclosed <${name}> tag`);
    if (html[i] === '>') return { name, attrs, end: i + 1 };
    const nameStart = i;
    while (i < html.length && !/[\s=/>]/.test(html[i])) i++;
    const attrName = html.slice(nameStart, i).toLowerCase();
    let value = '';
    let j = i;
    while (j < html.length && /\s/.test(html[j])) j++;
    if (html[j] === '=') {
      j++;
      while (j < html.length && /\s/.test(html[j])) j++;
      if (html[j] === '"' || html[j] === "'") {
        const close = html.indexOf(html[j], j + 1);
        if (close < 0) throw new Error(`unclosed attribute value in <${name}> tag`);
        value = html.slice(j + 1, close);
        i = close + 1;
      } else {
        const valueStart = j;
        while (j < html.length && !/[\s>]/.test(html[j])) j++;
        value = html.slice(valueStart, j);
        i = j;
      }
    }
    attrs.push({ name: attrName, value });
  }
}

// Walks the page and returns its start tags and the text of its scripts.
function scan(html) {
  const tags = [];
  const scripts = [];
  let i = 0;
  for (;;) {
    const lt = html.indexOf('<', i);
    if (lt < 0) break;
    if (html.startsWith('<!--', lt)) {
      const close = html.indexOf('-->', lt + 4);
      if (close < 0) throw new Error('unclosed comment');
      i = close + 3;
    } else if (html[lt + 1] === '!' || html[lt + 1] === '?' || html[lt + 1] === '/') {
      const close = html.indexOf('>', lt);
      if (close < 0) throw new Error('unclosed tag');
      i = close + 1;
    } else if (/[a-zA-Z]/.test(html[lt + 1] ?? '')) {
      const tag = readStartTag(html, lt);
      tags.push({ ...tag, start: lt });
      i = tag.end;
      if (RAW_TEXT.has(tag.name)) {
        const closer = new RegExp(`</${tag.name}(?=[\\s/>])`, 'i').exec(html.slice(i));
        if (!closer) throw new Error(`unclosed <${tag.name}>`);
        if (tag.name === 'script') scripts.push({ attrs: tag.attrs, text: html.slice(i, i + closer.index) });
        const close = html.indexOf('>', i + closer.index);
        if (close < 0) throw new Error(`unclosed </${tag.name}> tag`);
        i = close + 1;
      }
    } else {
      i = lt + 1;
    }
  }
  return { tags, scripts };
}

const attr = (attrs, name) => attrs.find((a) => a.name === name)?.value;

// Returns the page with its CSP meta inserted. Throws, with a message that says what is wrong, on any failure above.
export function addCsp(html) {
  const { tags, scripts } = scan(html);

  for (const tag of tags) {
    for (const { name, value } of tag.attrs) {
      if (/^on[a-z]+$/.test(name)) {
        throw new Error(`<${tag.name}> has an inline event-handler attribute (${name}=), which a script hash cannot allow`);
      }
      if (URL_ATTRIBUTES.has(name) && /^javascript:/i.test(value.replace(/[\u0000- ]/g, ''))) {
        throw new Error(`<${tag.name} ${name}> is a javascript: URL, which a script hash cannot allow`);
      }
    }
    if (tag.name === 'meta' && attr(tag.attrs, 'http-equiv')?.toLowerCase() === 'content-security-policy') {
      throw new Error('the page already has a Content-Security-Policy meta');
    }
  }

  const hashes = [];
  for (const script of scripts) {
    if (attr(script.attrs, 'src') !== undefined) continue;
    if (!EXECUTABLE_TYPES.has((attr(script.attrs, 'type') ?? '').trim().toLowerCase())) continue;
    const hash = `'sha256-${createHash('sha256').update(Buffer.from(script.text, 'latin1')).digest('base64')}'`;
    if (!hashes.includes(hash)) hashes.push(hash);
  }

  const head = tags.find((tag) => tag.name === 'head');
  if (!head) throw new Error('the page has no <head> to put the policy in');
  const meta = `<meta http-equiv="Content-Security-Policy" content="${['script-src', "'self'", ...hashes].join(' ')}">`;
  return html.slice(0, head.end) + meta + html.slice(head.end);
}

function htmlFiles(dir) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...htmlFiles(path));
    else if (entry.name.endsWith('.html')) found.push(path);
  }
  return found;
}

// Processes every dist/<key>/browser under `distRoot`. Returns the files it rewrote.
export function processDist(distRoot) {
  const browsers = readdirSync(distRoot)
    .map((key) => join(distRoot, key, 'browser'))
    .filter((dir) => existsSync(dir) && statSync(dir).isDirectory());
  if (browsers.length === 0) throw new Error(`no <app>/browser folder under ${distRoot}: run the build first`);
  const rewritten = [];
  for (const file of browsers.flatMap(htmlFiles)) {
    try {
      writeFileSync(file, addCsp(readFileSync(file, 'latin1')), 'latin1');
    } catch (error) {
      throw new Error(`${file}: ${error.message}`);
    }
    rewritten.push(file);
  }
  return rewritten;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const files = processDist(resolve(process.argv[2] ?? 'dist'));
    console.log(`csp: ${files.length} pages`);
  } catch (error) {
    console.error(`csp: ${error.message}`);
    process.exit(1);
  }
}
