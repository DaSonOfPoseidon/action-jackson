import { type SiteKey, siteByKey, siteUrl } from '../sites/site-registry';

// The path part of a canonical URL: no query, no fragment, no trailing slash except for the root itself. "/about/",
// "/about?x=1" and "/about" are one page, so they share one canonical.
export function canonicalPath(url: string): string {
  const path = url.split(/[?#]/, 1)[0].replace(/\/+$/, '');
  return path.startsWith('/') ? path : '/' + path;
}

// https://<production host><path>, never a .localhost host, whatever host the page was served from.
export function canonicalUrl(site: SiteKey, url: string): string {
  return siteUrl(siteByKey(site), canonicalPath(url));
}
