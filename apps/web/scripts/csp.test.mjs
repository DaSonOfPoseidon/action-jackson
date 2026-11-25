// Tests for csp.mjs (node --test, no dependency).
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { addCsp, processDist } from './csp.mjs';

const page = (head, body) => `<!DOCTYPE html><html lang="en"><head>\n<meta charset="utf-8">${head}</head>\n<body>${body}</body></html>`;
const policyOf = (html) => /<meta http-equiv="Content-Security-Policy" content="([^"]*)">/.exec(html)?.[1];

// Known values: printf 'alert(1)' | openssl dgst -sha256 -binary | base64, and the same for the second script,
// whose exact bytes include the newlines around it.
const HASH_ALERT = 'sha256-bhHHL3z2vDgxUt0W3dWQOrprscmda2Y5pLsLg4GF+pI=';
const HASH_NEWLINES = 'sha256-9j2bGAOi4fS6Q/kpjXKhmee+0q3HLgpdPHaV1G1EYRQ=';
const HASH_EMPTY = 'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=';

test('two inline scripts give two hashes over their exact bytes, in the first child of head', () => {
  const html = page('', '<script>alert(1)</script><script type="module">\nwindow.x=1;\n</script>');
  const out = addCsp(html);
  assert.equal(policyOf(out), `script-src 'self' '${HASH_ALERT}' '${HASH_NEWLINES}'`);
  assert.ok(out.startsWith('<!DOCTYPE html><html lang="en"><head><meta http-equiv="Content-Security-Policy"'), out.slice(0, 120));
});

test('a script with type text/javascript or module is hashed, and the same text twice is listed once', () => {
  const html = page('', '<script type="text/javascript">alert(1)</script><script type="module">alert(1)</script>');
  assert.equal(policyOf(addCsp(html)), `script-src 'self' '${HASH_ALERT}'`);
});

test('a script with a src, and data scripts (JSON ng-state, importmap), are not hashed', () => {
  const html = page(
    '<script src="main.js" type="module"></script>',
    '<script id="ng-state" type="application/json">{"a":"</b>"}</script><script type="importmap">{}</script>',
  );
  assert.equal(policyOf(addCsp(html)), `script-src 'self'`);
});

test('a page with no inline script still gets script-src self', () => {
  assert.equal(policyOf(addCsp(page('', '<p>Hello</p>'))), `script-src 'self'`);
});

test('an empty inline script is hashed too', () => {
  assert.equal(policyOf(addCsp(page('', '<script></script>'))), `script-src 'self' '${HASH_EMPTY}'`);
});

test('script text that looks like a tag or an attribute does not confuse the scanner', () => {
  const html = page('', '<script>var a = "<p onclick=x>"; // <!-- not a comment\n</script><p>onclick=1 and javascript:x in text</p>');
  assert.match(policyOf(addCsp(html)), /^script-src 'self' 'sha256-[A-Za-z0-9+/]+={0,2}'$/);
});

test('an inline event-handler attribute fails the build, whatever its case or quoting', () => {
  for (const tag of ['<a onclick="go()">x</a>', '<a ONCLICK=go()>x</a>', "<img src=x onerror='y'>", '<body onload="z">']) {
    assert.throws(() => addCsp(page('', tag)), /event-handler attribute/, tag);
  }
});

test('a javascript: URL fails the build, even with leading space or mixed case', () => {
  for (const tag of ['<a href="javascript:alert(1)">x</a>', '<a href=" JaVaScRiPt:alert(1)">x</a>', '<form action="java\nscript:x">']) {
    assert.throws(() => addCsp(page('', tag)), /javascript: URL/, tag);
  }
});

test('an ordinary attribute that merely contains "on" or "javascript" is fine', () => {
  const html = page('', '<a href="/contact" data-on="1" title="javascript: the language">x</a><p class="one">y</p>');
  assert.equal(policyOf(addCsp(html)), `script-src 'self'`);
});

test('a page that already has a CSP meta fails the build, and so does a second run over the output', () => {
  const once = addCsp(page('', '<p>x</p>'));
  assert.throws(() => addCsp(once), /already has a Content-Security-Policy/);
  assert.throws(() => addCsp(page('<meta HTTP-EQUIV="content-security-policy" content="default-src \'none\'">', '')), /already has/);
});

test('an unclosed script, tag or comment fails the build', () => {
  assert.throws(() => addCsp(page('', '<script>alert(1)')), /unclosed <script>/);
  assert.throws(() => addCsp(page('', '<p class="a')), /unclosed/);
  assert.throws(() => addCsp(page('', '<p>x</p><!-- never ends')), /unclosed comment/);
  assert.throws(() => addCsp('<html><body><p>no head</p></body></html>'), /no <head>/);
});

test('processDist rewrites every html file under each browser folder, and leaves other files alone', () => {
  const root = mkdtempSync(join(tmpdir(), 'aj-csp-'));
  try {
    mkdirSync(join(root, 'lan', 'browser', '404'), { recursive: true });
    writeFileSync(join(root, 'lan', 'browser', 'index.html'), page('', '<script>alert(1)</script>'));
    writeFileSync(join(root, 'lan', 'browser', '404', 'index.html'), page('', '<p>x</p>'));
    writeFileSync(join(root, 'lan', 'browser', 'main.js'), 'alert(1)');
    writeFileSync(join(root, 'lan', 'prerendered-routes.json'), '{}');
    assert.deepEqual(processDist(root).sort(), [join(root, 'lan', 'browser', '404', 'index.html'), join(root, 'lan', 'browser', 'index.html')]);
    assert.equal(policyOf(readFileSync(join(root, 'lan', 'browser', 'index.html'), 'latin1')), `script-src 'self' '${HASH_ALERT}'`);
    assert.equal(readFileSync(join(root, 'lan', 'browser', 'main.js'), 'utf8'), 'alert(1)');
    assert.throws(() => processDist(root), /already has/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('processDist keeps non-ASCII bytes exactly, so a hash stays valid', () => {
  const root = mkdtempSync(join(tmpdir(), 'aj-csp-'));
  try {
    mkdirSync(join(root, 'main', 'browser'), { recursive: true });
    const file = join(root, 'main', 'browser', 'index.html');
    writeFileSync(file, page('', '<script>var s = "café ©";</script><p>© 2026 · Jackson</p>'), 'utf8');
    processDist(root);
    const out = readFileSync(file, 'utf8');
    assert.ok(out.includes('<p>© 2026 · Jackson</p>'));
    assert.ok(out.includes('var s = "café ©";'));
    const expected = 'sha256-' + createHash('sha256').update('var s = "café ©";', 'utf8').digest('base64');
    assert.match(policyOf(out), new RegExp(expected.replace(/[+/]/g, '\\$&')));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('processDist fails when there is nothing to process', () => {
  const root = mkdtempSync(join(tmpdir(), 'aj-csp-'));
  try {
    assert.throws(() => processDist(root), /no .*browser/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
