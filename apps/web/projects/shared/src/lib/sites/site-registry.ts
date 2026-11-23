import sitesJson from '@contracts/sites.json';

// The site registry is contracts/sites.json, imported (never copied), the same file the edge reads.

export type PublicSiteKey = 'main' | 'lan' | 'car' | 'dev';
export type SiteKey = PublicSiteKey | 'admin';

export interface Site {
  readonly key: SiteKey;
  readonly hosts: readonly string[];
  readonly spa: boolean;
}

// The public sites, in the order the switcher lists them. Admin is never one of them.
export const SITE_ORDER: readonly PublicSiteKey[] = ['main', 'lan', 'car', 'dev'];

const PRODUCTION_DOMAIN = 'actionjacksoninstalls.com';

// The same rule as the edge's SiteRegistry.IsProductionFamily: the apex itself, or a subdomain of it. A host such as
// "evilactionjacksoninstalls.com" does not end in ".actionjacksoninstalls.com", so it never matches.
function isProductionHost(host: string): boolean {
  return host === PRODUCTION_DOMAIN || host.endsWith('.' + PRODUCTION_DOMAIN);
}

export interface SiteRegistry {
  readonly sites: readonly Site[];
  byKey(key: string): Site;
}

// Throws (so the build fails) on a registry the apps cannot use: a malformed entry, a repeated key, or a site with no
// production host (the switcher and the canonical link need one).
export function parseRegistry(json: unknown): SiteRegistry {
  const list = (json as { sites?: unknown } | null)?.sites;
  if (!Array.isArray(list)) {
    throw new Error('sites.json: "sites" must be an array');
  }
  const sites: Site[] = [];
  for (const entry of list as { key?: unknown; hosts?: unknown; spa?: unknown }[]) {
    const key = entry?.key;
    if (typeof key !== 'string' || !/^[a-z][a-z0-9-]*$/.test(key)) {
      throw new Error(`sites.json: a site has an invalid key (${JSON.stringify(key)})`);
    }
    const hosts = entry.hosts;
    if (!Array.isArray(hosts) || hosts.length === 0 || !hosts.every((h) => typeof h === 'string' && h.length > 0)) {
      throw new Error(`sites.json: site "${key}" needs a non-empty list of hosts`);
    }
    if (!hosts.some((h: string) => isProductionHost(h))) {
      throw new Error(`sites.json: site "${key}" has no ${PRODUCTION_DOMAIN} host`);
    }
    if (sites.some((s) => s.key === key)) {
      throw new Error(`sites.json: site "${key}" is listed twice`);
    }
    sites.push({ key: key as SiteKey, hosts: hosts as string[], spa: entry.spa === true });
  }
  return {
    sites,
    byKey(key: string): Site {
      const site = sites.find((s) => s.key === key);
      if (!site) {
        throw new Error(`sites.json has no site "${key}"`);
      }
      return site;
    },
  };
}

const registry = parseRegistry(sitesJson);

export function siteByKey(key: SiteKey): Site {
  return registry.byKey(key);
}

export function productionHost(site: Site): string {
  // parseRegistry guarantees one exists.
  return site.hosts.find(isProductionHost)!;
}

export function publicSites(): Site[] {
  return SITE_ORDER.map((key) => siteByKey(key));
}

// The absolute https URL of a site's page. The path is used as given: pass one that starts with "/".
export function siteUrl(site: Site, path = '/'): string {
  return `https://${productionHost(site)}${path}`;
}
