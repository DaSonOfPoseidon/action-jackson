// Checks the output of `npm run build` (run it after the build: npm run test:dist). node --test, no dependency.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const registry = JSON.parse(readFileSync(resolve(root, '../../contracts/sites.json'), 'utf8'));
const PUBLIC = ['main', 'lan', 'car', 'dev'];
const hostOf = (key) => registry.sites.find((s) => s.key === key).hosts.find((h) => h === 'actionjacksoninstalls.com' || h.endsWith('.actionjacksoninstalls.com'));

function htmlFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return htmlFiles(path);
    return entry.name.endsWith('.html') ? [path] : [];
  });
}
const read = (path) => readFileSync(path, 'utf8');

// The inline executable scripts of a page, found independently of scripts/csp.mjs: every <script> with no src whose
// type is missing, text/javascript or module.
function inlineScripts(html) {
  return [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter(([, attrs]) => !/\bsrc\s*=/i.test(attrs))
    .filter(([, attrs]) => {
      const type = /\btype\s*=\s*"?([^"\s>]*)/i.exec(attrs)?.[1]?.toLowerCase() ?? '';
      return type === '' || type === 'text/javascript' || type === 'module';
    })
    .map(([, , text]) => text);
}

for (const key of [...PUBLIC, 'admin']) {
  test(`${key}: every built page has one CSP meta, first in head, listing exactly its inline scripts`, () => {
    const files = htmlFiles(join(dist, key, 'browser'));
    assert.ok(files.length > 0);
    for (const file of files) {
      const html = read(file);
      const metas = html.match(/<meta[^>]*http-equiv="Content-Security-Policy"[^>]*>/gi) ?? [];
      assert.equal(metas.length, 1, file);
      assert.ok(/<head[^>]*><meta http-equiv="Content-Security-Policy"/.test(html), `${file}: the policy is not the first child of head`);
      const policy = /content="([^"]*)"/.exec(metas[0])[1];
      const expected = new Set(inlineScripts(html).map((text) => `'sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}'`));
      const actual = policy.split(' ').filter((token) => token.startsWith("'sha256-"));
      assert.deepEqual(new Set(actual), expected, file);
      assert.ok(policy.startsWith("script-src 'self'"), file);
      assert.ok(!policy.includes('unsafe-inline') && !policy.includes('unsafe-eval'), file);
    }
  });
}

for (const key of PUBLIC) {
  test(`${key}: has 404.html (not 404/), robots.txt and a sitemap of real routes on its production host`, () => {
    const browser = join(dist, key, 'browser');
    const host = hostOf(key);
    assert.ok(existsSync(join(browser, 'index.html')));
    assert.match(read(join(browser, '404.html')), /<h1>Page not found<\/h1>/);
    assert.equal(existsSync(join(browser, '404')), false);
    assert.equal(read(join(browser, 'robots.txt')), `User-agent: *\nAllow: /\nSitemap: https://${host}/sitemap.xml\n`);
    const urls = [...read(join(browser, 'sitemap.xml')).matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]);
    assert.ok(urls.includes(`https://${host}/`));
    assert.ok(urls.every((url) => url.startsWith(`https://${host}/`) && !url.includes('404')), urls.join(' '));
  });

  test(`${key}: the home page names its canonical URL and the 404 page is noindex`, () => {
    const browser = join(dist, key, 'browser');
    assert.ok(read(join(browser, 'index.html')).includes(`<link rel="canonical" href="https://${hostOf(key)}/">`));
    assert.ok(read(join(browser, '404.html')).includes('<meta name="robots" content="noindex">'));
  });
}

test('admin: client-rendered, so index.html is its only page (plus the CSR copy), noindex, Disallow robots, no sitemap', () => {
  const browser = join(dist, 'admin', 'browser');
  const pages = htmlFiles(browser).map((file) => file.slice(browser.length + 1)).sort();
  assert.ok(pages.every((page) => page === 'index.html' || page === 'index.csr.html'), pages.join(' '));
  assert.ok(pages.includes('index.html'));
  assert.ok(read(join(browser, 'index.html')).includes('<meta name="robots" content="noindex, nofollow">'));
  assert.equal(read(join(browser, 'robots.txt')), 'User-agent: *\nDisallow: /\n');
  assert.equal(existsSync(join(browser, 'sitemap.xml')), false);
  assert.equal(existsSync(join(browser, '404.html')), false);
});
