// Post-build step, run after `ng build` and scripts/csp.mjs, once for all apps under dist/:
//   - Public apps (prerendered): moves the prerendered /404 page, 404/index.html, to 404.html, which the edge serves
//     with a 404 for any missing path. Writes robots.txt (allow all, with the sitemap's URL) and sitemap.xml (every
//     prerendered route except /404) for the site's production host.
//   - Admin (a client-rendered SPA, "spa": true in the registry): robots.txt that disallows everything, and no sitemap.
// The hosts come from contracts/sites.json, the file the edge reads. Run it once per build: a second run fails
// because 404/index.html is already moved. No dependency.
import { existsSync, readFileSync, readdirSync, renameSync, rmdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PRODUCTION_DOMAIN = 'actionjacksoninstalls.com';

// The same rule as the edge's SiteRegistry.IsProductionFamily and the shared library's productionHost: the apex
// itself or a subdomain of it, picked by suffix, never by position in the list.
export function productionHost(site) {
  const host = (site.hosts ?? []).find((h) => h === PRODUCTION_DOMAIN || h.endsWith(`.${PRODUCTION_DOMAIN}`));
  if (!host) throw new Error(`site "${site.key}" has no production host (${PRODUCTION_DOMAIN})`);
  return host;
}

// "/about/" and "/about" are one page; the root is "/".
const canonicalPath = (path) => (path.length > 1 ? path.replace(/\/+$/, '') : path) || '/';

// The routes Angular prerendered (prerendered-routes.json), without the not-found page.
export function routePaths(prerendered) {
  if (!prerendered || typeof prerendered.routes !== 'object' || prerendered.routes === null) {
    throw new Error('prerendered-routes.json has no "routes" object');
  }
  return Object.keys(prerendered.routes)
    .map(canonicalPath)
    .filter((path) => path !== '/404');
}

export function robotsTxt(site) {
  if (site.spa === true) {
    return 'User-agent: *\nDisallow: /\n';
  }
  return `User-agent: *\nAllow: /\nSitemap: https://${productionHost(site)}/sitemap.xml\n`;
}

const xmlEscape = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function sitemapXml(host, paths) {
  const urls = paths.map((path) => `  <url><loc>${xmlEscape(`https://${host}${path}`)}</loc></url>\n`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}</urlset>\n`;
}

// `registry` is the parsed contracts/sites.json. Every dist/<key> must be a site in it.
export function processDist(distRoot, registry) {
  const keys = readdirSync(distRoot).filter((name) => statSync(join(distRoot, name)).isDirectory());
  if (keys.length === 0) throw new Error(`nothing under ${distRoot}: run the build first`);
  for (const key of keys) {
    const site = registry.sites.find((s) => s.key === key);
    if (!site) throw new Error(`dist/${key} is not a site in contracts/sites.json`);
    const browser = join(distRoot, key, 'browser');
    if (!existsSync(browser)) throw new Error(`dist/${key} has no browser folder: run the build first`);
    writeFileSync(join(browser, 'robots.txt'), robotsTxt(site));
    if (site.spa === true) continue;

    const notFound = join(browser, '404', 'index.html');
    if (!existsSync(notFound)) {
      throw new Error(`dist/${key}: the prerendered 404 page (404/index.html) is missing, so the edge has no 404.html to serve`);
    }
    renameSync(notFound, join(browser, '404.html'));
    rmdirSync(join(browser, '404'));
    const prerendered = JSON.parse(readFileSync(join(distRoot, key, 'prerendered-routes.json'), 'utf8'));
    writeFileSync(join(browser, 'sitemap.xml'), sitemapXml(productionHost(site), routePaths(prerendered)));
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const registry = JSON.parse(readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../../contracts/sites.json'), 'utf8'));
    processDist(resolve(process.argv[2] ?? 'dist'), registry);
    console.log('seo: done');
  } catch (error) {
    console.error(`seo: ${error.message}`);
    process.exit(1);
  }
}
