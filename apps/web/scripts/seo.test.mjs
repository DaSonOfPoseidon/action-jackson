// Tests for seo.mjs (node --test, no dependency). The files are parsed, not just string-compared.
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { processDist, productionHost, robotsTxt, routePaths, sitemapXml } from './seo.mjs';

const registry = {
  sites: [
    { key: 'main', hosts: ['localhost', 'actionjacksoninstalls.com'] },
    { key: 'lan', hosts: ['lan.localhost', 'lan.actionjacksoninstalls.com'] },
    { key: 'admin', hosts: ['admin.localhost', 'admin.actionjacksoninstalls.com'], spa: true },
  ],
};

// A small dist: main and lan prerendered (home, about, 404), admin client-rendered.
function makeDist() {
  const root = mkdtempSync(join(tmpdir(), 'aj-seo-'));
  for (const key of ['main', 'lan']) {
    mkdirSync(join(root, key, 'browser', '404'), { recursive: true });
    mkdirSync(join(root, key, 'browser', 'about'), { recursive: true });
    writeFileSync(join(root, key, 'browser', 'index.html'), '<h1>home</h1>');
    writeFileSync(join(root, key, 'browser', 'about', 'index.html'), '<h1>about</h1>');
    writeFileSync(join(root, key, 'browser', '404', 'index.html'), '<h1>not found</h1>');
    writeFileSync(join(root, key, 'prerendered-routes.json'), JSON.stringify({ routes: { '/': {}, '/about': {}, '/404': {} } }));
  }
  mkdirSync(join(root, 'admin', 'browser'), { recursive: true });
  writeFileSync(join(root, 'admin', 'browser', 'index.html'), '<h1>admin</h1>');
  return root;
}

const sitemapUrls = (xml) => [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]);

test('productionHost picks the host by its suffix, never by its position', () => {
  assert.equal(productionHost({ key: 'main', hosts: ['localhost', 'actionjacksoninstalls.com'] }), 'actionjacksoninstalls.com');
  assert.equal(productionHost({ key: 'lan', hosts: ['lan.actionjacksoninstalls.com', 'lan.localhost'] }), 'lan.actionjacksoninstalls.com');
  assert.equal(productionHost({ key: 'lan', hosts: ['lan.localhost', 'lan.actionjacksoninstalls.com'] }), 'lan.actionjacksoninstalls.com');
});

test('productionHost refuses a look-alike host and a site with no production host', () => {
  assert.throws(() => productionHost({ key: 'x', hosts: ['evilactionjacksoninstalls.com', 'x.localhost'] }), /no production host/);
  assert.throws(() => productionHost({ key: 'x', hosts: [] }), /no production host/);
});

test('routePaths drops 404 and gives every path in its canonical form', () => {
  assert.deepEqual(routePaths({ routes: { '/': {}, '/about': {}, '/404': {}, '/team/': {} } }), ['/', '/about', '/team']);
  assert.throws(() => routePaths({}), /routes/);
});

test('robots.txt for a public site allows everything and names the sitemap on its production host', () => {
  assert.equal(robotsTxt({ key: 'lan', hosts: ['lan.localhost', 'lan.actionjacksoninstalls.com'] }), 'User-agent: *\nAllow: /\nSitemap: https://lan.actionjacksoninstalls.com/sitemap.xml\n');
});

test('robots.txt for admin disallows everything and has no sitemap', () => {
  assert.equal(robotsTxt({ key: 'admin', hosts: ['admin.actionjacksoninstalls.com'], spa: true }), 'User-agent: *\nDisallow: /\n');
});

test('sitemap.xml is well formed and lists each route once under the production host', () => {
  const xml = sitemapXml('lan.actionjacksoninstalls.com', ['/', '/about', '/quote?a=1&b=2']);
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>\n<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  assert.deepEqual(sitemapUrls(xml), [
    'https://lan.actionjacksoninstalls.com/',
    'https://lan.actionjacksoninstalls.com/about',
    'https://lan.actionjacksoninstalls.com/quote?a=1&amp;b=2',
  ]);
  assert.ok(xml.trimEnd().endsWith('</urlset>'));
});

test('processDist moves 404/index.html to 404.html, and writes robots.txt and sitemap.xml per public site', () => {
  const root = makeDist();
  try {
    processDist(root, registry);
    for (const [key, host] of [['main', 'actionjacksoninstalls.com'], ['lan', 'lan.actionjacksoninstalls.com']]) {
      const browser = join(root, key, 'browser');
      assert.equal(readFileSync(join(browser, '404.html'), 'utf8'), '<h1>not found</h1>');
      assert.equal(existsSync(join(browser, '404')), false);
      assert.equal(readFileSync(join(browser, 'robots.txt'), 'utf8'), `User-agent: *\nAllow: /\nSitemap: https://${host}/sitemap.xml\n`);
      assert.deepEqual(sitemapUrls(readFileSync(join(browser, 'sitemap.xml'), 'utf8')), [`https://${host}/`, `https://${host}/about`]);
      assert.equal(readFileSync(join(browser, 'about', 'index.html'), 'utf8'), '<h1>about</h1>');
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('processDist gives admin a Disallow robots.txt, no sitemap, and no 404.html', () => {
  const root = makeDist();
  try {
    processDist(root, registry);
    const browser = join(root, 'admin', 'browser');
    assert.equal(readFileSync(join(browser, 'robots.txt'), 'utf8'), 'User-agent: *\nDisallow: /\n');
    assert.equal(existsSync(join(browser, 'sitemap.xml')), false);
    assert.equal(existsSync(join(browser, '404.html')), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('processDist fails when a public app has no prerendered 404 page, and on a second run', () => {
  const root = makeDist();
  try {
    rmSync(join(root, 'lan', 'browser', '404'), { recursive: true });
    assert.throws(() => processDist(root, registry), /lan.*404/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
  const again = makeDist();
  try {
    processDist(again, registry);
    assert.throws(() => processDist(again, registry), /404/);
  } finally {
    rmSync(again, { recursive: true, force: true });
  }
});

test('processDist fails on an app that is not in the registry', () => {
  const root = makeDist();
  try {
    mkdirSync(join(root, 'stray', 'browser'), { recursive: true });
    assert.throws(() => processDist(root, registry), /stray/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
