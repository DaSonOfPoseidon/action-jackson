// The four public sites, each opened through the real edge by its own Host name.
import AxeBuilder from '@axe-core/playwright';
import { SITES, SWITCHER_LABELS, edgeOrigin, pageUrl } from './sites';
import { expect, test } from './fixtures';

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag2aaa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

for (const site of SITES) {
  test.describe(`${site.key} (${site.host})`, () => {
    test('/ is the home page with its title, h1, canonical and og tags', async ({ page, watched }) => {
      const response = await page.goto(pageUrl(site.host));
      expect(response?.status()).toBe(200);
      await expect(page).toHaveTitle(site.title);
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(site.h1);
      await expect(page.locator('main#main')).toContainText('This site is being rebuilt.');
      const canonical = `https://${site.production}/`;
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', canonical);
      await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', canonical);
      await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'website');
      await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', site.title);
      await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /\S/);
      expect(await watched.problems()).toEqual([]);
    });

    test('the page hydrates with no content-security-policy violation and no console error', async ({ page, watched }) => {
      await page.goto(pageUrl(site.host));
      // ng-version is written by the prerender too, so it proves nothing about the browser. A click on the skip link is
      // client-only: without the bootstrap the bare link follows its #main href (the click is not cancelled), with it
      // the handler cancels the click and focuses <main>. Poll, since the click may land before the handler is attached.
      await expect(page.locator('aj-root')).toHaveAttribute('ng-version', /\d/);
      await expect
        .poll(
          () =>
            page.evaluate(() => {
              (document.activeElement as HTMLElement | null)?.blur();
              const link = document.querySelector<HTMLAnchorElement>('a.skip-link');
              const notCancelled = link?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
              return { cancelled: notCancelled === false, focused: document.activeElement?.id };
            }),
          { timeout: 15_000 },
        )
        .toEqual({ cancelled: true, focused: 'main' });
      expect(await watched.problems()).toEqual([]);
    });

    test('the response has the edge CSP header once, with no script rule, and the page its own script policy', async ({ page }) => {
      const response = await page.goto(pageUrl(site.host));
      const policies = (await response?.headersArray())?.filter((header) => header.name.toLowerCase() === 'content-security-policy') ?? [];
      expect(policies).toHaveLength(1);
      expect(policies[0]?.value).not.toContain('script-src');
      await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveAttribute('content', /^script-src 'self'/);
    });

    test('the switcher links to the other public sites by their production URL and marks this one', async ({ page }) => {
      await page.goto(pageUrl(site.host));
      const nav = page.getByRole('navigation', { name: 'Action Jackson sites' });
      const others = SITES.filter((other) => other.key !== site.key);
      await expect(nav.getByRole('link')).toHaveCount(others.length);
      for (const other of others) {
        await expect(nav.getByRole('link', { name: SWITCHER_LABELS[other.key], exact: true })).toHaveAttribute('href', `https://${other.production}/`);
      }
      await expect(nav.locator('[aria-current="page"]')).toHaveText(SWITCHER_LABELS[site.key]);
      await expect(nav.locator('a[aria-current="page"]')).toHaveCount(0);
      await expect(nav.locator('a[href*="admin"]')).toHaveCount(0);
    });

    test('a missing path answers 404 and shows the not-found page', async ({ page, watched }) => {
      const url = pageUrl(site.host, '/no-such-page');
      const response = await page.goto(url);
      expect(response?.status()).toBe(404);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Page not found');
      await expect(page.getByRole('link', { name: 'Go to the home page' })).toHaveAttribute('href', '/');
      // The browser logs the 404 of the page itself as a console error; nothing else may be reported.
      expect(await watched.problems([url])).toEqual([]);
    });

    test("robots.txt and sitemap.xml are served with this site's production host", async ({ request }) => {
      const headers = { Host: site.host };
      const robots = await request.get(`${edgeOrigin()}/robots.txt`, { headers });
      expect(robots.status()).toBe(200);
      expect(await robots.text()).toBe(`User-agent: *\nAllow: /\nSitemap: https://${site.production}/sitemap.xml\n`);

      const sitemap = await request.get(`${edgeOrigin()}/sitemap.xml`, { headers });
      expect(sitemap.status()).toBe(200);
      const text = await sitemap.text();
      expect(text).toContain(`<loc>https://${site.production}/</loc>`);
      expect(text).not.toContain('404');
    });

    for (const [name, path] of [
      ['home page', '/'],
      ['not-found page', '/no-such-page'],
    ] as const) {
      test(`axe finds no violation on the ${name} (wcag2a, 2aa, 2aaa, 21a, 21aa, 22aa)`, async ({ page }) => {
        await page.goto(pageUrl(site.host, path));
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
        expect(results.violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`)).toEqual([]);
      });
    }

    test('color-contrast-enhanced (7:1) is evaluated, and passes, on the home page', async ({ page }) => {
      await page.goto(pageUrl(site.host));
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      const results = await new AxeBuilder({ page }).withRules(['color-contrast-enhanced']).analyze();
      expect(results.violations).toEqual([]);
      // Evaluated, not skipped: at least one element was checked and passed.
      expect(results.passes.find((rule) => rule.id === 'color-contrast-enhanced')?.nodes.length ?? 0).toBeGreaterThan(0);
    });
  });
}
