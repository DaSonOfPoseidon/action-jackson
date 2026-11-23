import { SITE_ORDER, parseRegistry, productionHost, publicSites, siteByKey, siteUrl } from './site-registry';

const fixture = {
  sites: [
    { key: 'main', hosts: ['localhost', 'actionjacksoninstalls.com'] },
    { key: 'lan', hosts: ['lan.localhost', 'lan.actionjacksoninstalls.com'] },
    { key: 'admin', hosts: ['admin.actionjacksoninstalls.com'], spa: true },
  ],
};

describe('site registry', () => {
  it('reads the real contracts/sites.json: five sites, admin is the spa', () => {
    expect(siteByKey('admin').spa).toBe(true);
    expect(['main', 'lan', 'car', 'dev', 'admin'].map((key) => siteByKey(key as never).key)).toEqual([
      'main',
      'lan',
      'car',
      'dev',
      'admin',
    ]);
  });

  it('picks the production host by suffix, never by position', () => {
    // The .localhost host comes first in the fixture, so a first-host rule would be wrong.
    const registry = parseRegistry(fixture);
    expect(productionHost(registry.byKey('main'))).toBe('actionjacksoninstalls.com');
    expect(productionHost(registry.byKey('lan'))).toBe('lan.actionjacksoninstalls.com');
  });

  it('does not take a lookalike host for the production one', () => {
    const registry = parseRegistry({
      sites: [{ key: 'main', hosts: ['evilactionjacksoninstalls.com', 'actionjacksoninstalls.com.evil.example', 'actionjacksoninstalls.com'] }],
    });
    expect(productionHost(registry.byKey('main'))).toBe('actionjacksoninstalls.com');
  });

  it('fails loudly when a site has no production host', () => {
    expect(() => parseRegistry({ sites: [{ key: 'lan', hosts: ['lan.localhost'] }] })).toThrow(
      /lan.*actionjacksoninstalls\.com/,
    );
  });

  it('fails loudly on a malformed registry', () => {
    expect(() => parseRegistry({})).toThrow(/sites/);
    expect(() => parseRegistry({ sites: [{ key: 'Lan', hosts: ['lan.actionjacksoninstalls.com'] }] })).toThrow(/key/);
    expect(() => parseRegistry({ sites: [{ key: 'lan', hosts: [] }] })).toThrow(/hosts/);
    expect(() =>
      parseRegistry({
        sites: [
          { key: 'lan', hosts: ['lan.actionjacksoninstalls.com'] },
          { key: 'lan', hosts: ['x.actionjacksoninstalls.com'] },
        ],
      }),
    ).toThrow(/twice/);
  });

  it('lists the public sites without admin, in a fixed order', () => {
    expect(publicSites().map((site) => site.key)).toEqual(['main', 'lan', 'car', 'dev']);
    expect(publicSites().some((site) => site.key === 'admin')).toBe(false);
    expect(SITE_ORDER).toEqual(['main', 'lan', 'car', 'dev']);
  });

  it('gives every real site a production host and an absolute https url', () => {
    expect(productionHost(siteByKey('main'))).toBe('actionjacksoninstalls.com');
    expect(siteUrl(siteByKey('car'))).toBe('https://car.actionjacksoninstalls.com/');
    expect(siteUrl(siteByKey('dev'), '/blog')).toBe('https://dev.actionjacksoninstalls.com/blog');
  });

  it('throws for an unknown key', () => {
    expect(() => siteByKey('nope' as never)).toThrow(/nope/);
  });
});
