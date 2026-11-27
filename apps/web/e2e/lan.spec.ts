// The lan site's business pages (the ported original site), opened through the real edge by Host name lan.localhost.
// What each page must show is written out here on purpose, not imported from the app.
import type { Page } from '@playwright/test';
import { contrastFailures, settled } from './contrast-audit';
import { edgeOrigin, pageUrl } from './sites';
import { expect, test } from './fixtures';
import { axeViolations, hydrated } from './lan-helpers';

const HOST = 'lan.localhost';
const PRODUCTION = 'lan.actionjacksoninstalls.com';
const SUFFIX = 'Action Jackson Home Networking';

interface Route {
  readonly path: string;
  readonly h1: string;
  readonly title: string;
  // The number of questions in the page's FAQ (service pages only).
  readonly faqs?: number;
}

const ROUTES: readonly Route[] = [
  { path: '/', h1: 'Upgrade Your Home Network.', title: `Home · ${SUFFIX}` },
  { path: '/about', h1: 'Home Network Performance Specialist.', title: `About · ${SUFFIX}` },
  { path: '/services/networking', h1: 'Engineered WiFi & Network Performance.', title: `Networking Services · ${SUFFIX}`, faqs: 5 },
  { path: '/services/smart-home', h1: 'Smart Home Infrastructure That Actually Works.', title: `Smart Home Automation · ${SUFFIX}`, faqs: 6 },
  { path: '/services/cameras', h1: 'Subscription-Free Security Cameras.', title: `PoE Camera Systems · ${SUFFIX}`, faqs: 6 },
  { path: '/services/wiring', h1: 'Structured Cabling & Low-Voltage Networking.', title: `Structured Cabling & Low Voltage · ${SUFFIX}`, faqs: 7 },
  { path: '/get-started', h1: 'Get Started.', title: `Get started · ${SUFFIX}` },
  { path: '/quote', h1: 'Get a Quote.', title: `Get a quote · ${SUFFIX}` },
];

const SERVICE_LINKS = [
  { name: 'Networking', href: '/services/networking' },
  { name: 'Smart Home', href: '/services/smart-home' },
  { name: 'Cameras', href: '/services/cameras' },
  { name: 'Structured Wiring', href: '/services/wiring' },
] as const;

// The visible primary navigation: the desktop list at wide widths, the menu button's list at narrow ones.
const primaryNav = (page: Page) => page.getByRole('navigation', { name: 'Primary' });

test.describe('lan pages', () => {
  for (const route of ROUTES) {
    test.describe(route.path, () => {
      test('answers 200 with its h1, title, description, canonical and og tags, and runs clean', async ({ page, watched }) => {
        const response = await page.goto(pageUrl(HOST, route.path));
        expect(response?.status()).toBe(200);
        await expect(page).toHaveTitle(route.title);
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(route.h1);
        await expect(page.locator('main#main')).toBeVisible();
        const canonical = `https://${PRODUCTION}${route.path}`;
        await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', canonical);
        await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', canonical);
        await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', route.title);
        await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /^\S+( \S+){5,}/);
        expect(await watched.problems()).toEqual([]);
      });

      test('makes no request to /api/ while it loads', async ({ page }) => {
        const api: string[] = [];
        page.on('request', (request) => {
          if (new URL(request.url()).pathname.startsWith('/api/')) {
            api.push(request.url());
          }
        });
        await page.goto(pageUrl(HOST, route.path), { waitUntil: 'networkidle' });
        await hydrated(page);
        expect(api).toEqual([]);
      });

      test('loads its fonts from its own origin only, and they are in use', async ({ page }) => {
        const fonts: string[] = [];
        page.on('requestfinished', (request) => {
          if (request.resourceType() === 'font') {
            fonts.push(request.url());
          }
        });
        await page.goto(pageUrl(HOST, route.path), { waitUntil: 'networkidle' });
        await page.evaluate(() => document.fonts.ready);
        expect(fonts.length).toBeGreaterThan(0);
        for (const url of fonts) {
          expect(new URL(url).origin).toBe(`http://${HOST}`);
        }
        const loaded = await page.evaluate(() => ({
          syne: document.fonts.check('700 1em Syne'),
          figtree: document.fonts.check('1em Figtree'),
        }));
        expect(loaded).toEqual({ syne: true, figtree: true });
      });

      test('has no horizontal scroll at 320px wide', async ({ page }) => {
        await page.setViewportSize({ width: 320, height: 640 });
        await page.goto(pageUrl(HOST, route.path));
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow).toBeLessThanOrEqual(0);
      });

      for (const width of [320, 1280]) {
        test(`axe finds no violation at ${width}px, with the menu closed and open`, async ({ page }) => {
          await page.setViewportSize({ width, height: width === 320 ? 640 : 800 });
          await page.goto(pageUrl(HOST, route.path));
          await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
          await hydrated(page);
          expect(await axeViolations(page)).toEqual([]);

          // Open the menu the way this width shows it: the Services menu on a wide screen, the menu button on a narrow one.
          const toggle = page.locator(width === 320 ? 'summary.menu-toggle' : 'summary.services-toggle');
          await toggle.click();
          await expect(toggle.locator('xpath=..')).toHaveJSProperty('open', true);
          expect(await axeViolations(page)).toEqual([]);
        });
      }

      test('every link on it that stays on the site resolves, and each /get-started link reaches the consultation form', async ({ page, request }) => {
        await page.goto(pageUrl(HOST, route.path));
        const hrefs = await page.locator('a[href]').evaluateAll((anchors) => anchors.map((a) => a.getAttribute('href') ?? ''));
        const internal = [...new Set(hrefs.filter((href) => href.startsWith('/')).map((href) => href.split('#')[0] || '/'))];
        expect(internal).toContain('/get-started');
        for (const path of internal) {
          const response = await request.get(edgeOrigin() + path, { headers: { Host: HOST } });
          expect(response.status(), path).toBe(200);
          if (path === '/get-started') {
            expect(await response.text()).toContain('Submit Consultation Request');
          }
        }
      });

      test('shows its content with JavaScript off: the navigation links and every section', async ({ browser }) => {
        const context = await browser.newContext({ javaScriptEnabled: false });
        try {
          const page = await context.newPage();
          await page.goto(pageUrl(HOST, route.path));
          await expect(page.getByRole('heading', { level: 1 })).toHaveText(route.h1);
          // The menus are closed <details>: their links are in the page and open with a click, no script needed.
          await expect(page.locator('header a[href="/get-started"]').first()).toBeAttached();
          for (const link of SERVICE_LINKS) {
            await expect(page.locator(`header a[href="${link.href}"]`).first()).toBeAttached();
          }
          if (route.faqs) {
            await expect(page.locator('details.faq-item')).toHaveCount(route.faqs);
            // An answer is in the HTML before it is opened.
            await expect(page.locator('details.faq-item p').first()).toBeAttached();
          }
          const toggle = page.locator('summary.services-toggle');
          await page.setViewportSize({ width: 1280, height: 800 });
          await toggle.click();
          await expect(page.locator('details.services-menu a', { hasText: 'Cameras' })).toBeVisible();
        } finally {
          await context.close();
        }
      });
    });
  }

  test('the header has the wordmark, the nav links and the Get Started button', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(pageUrl(HOST));
    const header = page.locator('header');
    await expect(header.getByRole('link', { name: 'Action Jackson Installs' })).toHaveAttribute('href', '/');
    const nav = primaryNav(page);
    await expect(nav.getByRole('link', { name: 'Home', exact: true })).toHaveAttribute('href', '/');
    await expect(nav.getByRole('link', { name: 'About', exact: true })).toHaveAttribute('href', '/about');
    await expect(nav.getByRole('link', { name: 'Get Started', exact: true })).toHaveAttribute('href', '/get-started');
    await expect(nav.locator('summary.services-toggle')).toHaveText('Services');
  });

  test('the Services menu opens with the keyboard, lists the four services and closes with Escape', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(pageUrl(HOST));
    await hydrated(page);
    const menu = page.locator('details.services-menu');
    const toggle = menu.locator('summary');
    await toggle.focus();
    await expect(menu).not.toHaveJSProperty('open', true);
    for (const link of SERVICE_LINKS) {
      await expect(menu.getByRole('link', { name: link.name, exact: true })).toBeHidden();
    }
    await page.keyboard.press('Enter');
    await expect(menu).toHaveJSProperty('open', true);
    for (const link of SERVICE_LINKS) {
      await expect(menu.getByRole('link', { name: link.name, exact: true })).toHaveAttribute('href', link.href);
      await expect(menu.getByRole('link', { name: link.name, exact: true })).toBeVisible();
    }
    // Tab moves into the menu.
    await page.keyboard.press('Tab');
    await expect(menu.getByRole('link', { name: 'Networking', exact: true })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(menu).not.toHaveJSProperty('open', true);
    await expect(toggle).toBeFocused();
  });

  test('the mobile menu opens, lists every link, closes with Escape, and closes when a link is followed', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(pageUrl(HOST));
    await hydrated(page);
    const menu = page.locator('details.mobile-menu');
    const toggle = menu.locator('summary');
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAccessibleName('Menu');
    await expect(menu.getByRole('link', { name: 'About', exact: true })).toBeHidden();
    await toggle.focus();
    await page.keyboard.press('Enter');
    await expect(menu).toHaveJSProperty('open', true);
    for (const name of ['Home', 'Networking', 'Smart Home', 'Cameras', 'Structured Wiring', 'About', 'Get Started']) {
      await expect(menu.getByRole('link', { name, exact: true })).toBeVisible();
    }
    await page.keyboard.press('Escape');
    await expect(menu).not.toHaveJSProperty('open', true);
    await expect(toggle).toBeFocused();

    await toggle.click();
    await menu.getByRole('link', { name: 'About', exact: true }).click();
    await expect(page).toHaveURL(pageUrl(HOST, '/about'));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Home Network Performance Specialist.');
    await expect(menu).not.toHaveJSProperty('open', true);
  });

  test('the footer has the wordmark, the tagline, the services, the quick links and the copyright', async ({ page }) => {
    await page.goto(pageUrl(HOST));
    const footer = page.locator('footer');
    await expect(footer).toContainText('Engineered home networking & smart infrastructure.');
    await expect(footer).toContainText('Columbia, MO · Precision infrastructure');
    for (const link of SERVICE_LINKS) {
      await expect(footer.getByRole('link', { name: link.name, exact: true })).toHaveAttribute('href', link.href);
    }
    await expect(footer.getByRole('link', { name: 'Schedule Consultation', exact: true })).toHaveAttribute('href', '/get-started');
    await expect(footer.getByRole('link', { name: 'About', exact: true })).toHaveAttribute('href', '/about');
    await expect(footer).toContainText(`© ${new Date().getFullYear()} Action Jackson Installs. All rights reserved.`);
  });

  test('the home page runs from the problem to the packages to the call to action, with the four packages', async ({ page }) => {
    await page.goto(pageUrl(HOST));
    const headings = await page.getByRole('heading', { level: 2 }).allTextContents();
    expect(headings).toEqual(['Sound familiar?', 'The engineered alternative.', 'Service Packages', 'Why Action Jackson?', 'Ready to upgrade your network?']);
    const packages = page.locator('#packages');
    await expect(packages.getByRole('heading', { level: 3 })).toHaveText([
      'Foundation Network',
      'Smart Home Backbone',
      'Security',
      'Performance + Protection',
    ]);
    await expect(packages).toContainText('$799–$1,499');
    await expect(packages).toContainText('$2,500–$6,000');
    await expect(page.getByRole('link', { name: 'View Packages' })).toHaveAttribute('href', /#packages$/);
  });

  // axe cannot judge text on a gradient, a glow or a translucent layer, so this reads the pixels behind every piece of text
  // (see contrast-audit.ts): the darkest and the lightest point behind it must both pass AAA.
  for (const [name, size] of [
    ['desktop', { width: 1440, height: 900 }],
    ['mobile', { width: 390, height: 844 }],
  ] as const) {
    test(`every piece of text meets AAA against what is drawn behind it, ${name}`, async ({ page, browser }) => {
      test.setTimeout(120_000);
      await page.setViewportSize(size);
      const failures: Record<string, unknown[]> = {};
      for (const path of [...ROUTES.map((route) => route.path), '/no-such-page']) {
        await page.goto(pageUrl(HOST, path));
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await settled(page);
        const found = await contrastFailures(page, browser);
        if (found.length > 0) {
          failures[path] = found;
        }
      }
      expect(failures).toEqual({});
    });
  }

  test('says nothing about a reply time, a free consultation, a volume discount or an email in the inbox', async ({ page }) => {
    const claims = [/within 24 hours/i, /no obligations?/i, /free consultation/i, /volume discount/i, /proposal within/i, /check your inbox/i];
    for (const route of ROUTES) {
      await page.goto(pageUrl(HOST, route.path));
      const text = await page.locator('body').innerText();
      const html = await page.content();
      for (const claim of claims) {
        expect(text, `${route.path} ${claim}`).not.toMatch(claim);
        expect(html, `${route.path} ${claim}`).not.toMatch(claim);
      }
    }
  });

  test('the service pages state the original prices', async ({ page }) => {
    const expected: Record<string, string[]> = {
      '/services/networking': ['$799'],
      '/services/smart-home': ['$1,500'],
      '/services/cameras': ['$125–$175', '/ camera'],
      '/services/wiring': ['$150', '/ drop', '$200 / drop', '$300+ / run', '$125 / drop'],
    };
    for (const [path, prices] of Object.entries(expected)) {
      await page.goto(pageUrl(HOST, path));
      // textContent, not innerText: the FAQ answers are in closed disclosures, which innerText leaves out.
      const text = (await page.locator('main').textContent()) ?? '';
      for (const price of prices) {
        expect(text, `${path} ${price}`).toContain(price);
      }
      // Every FAQ about buying equipment keeps the acquisition fee, as decided.
      expect(text, path).toContain('20% acquisition and stocking fee');
    }
  });

  test('a service page has the process steps as an ordered list, the FAQ as disclosures and its specs', async ({ page }) => {
    await page.goto(pageUrl(HOST, '/services/wiring'));
    const steps = page.locator('ol.process-steps > li');
    await expect(steps).toHaveCount(6);
    await expect(steps.first()).toContainText('Consultation');
    await expect(steps.last()).toContainText('Handoff');
    // The cable table scrolls inside its own labelled, focusable region, so it never widens the page.
    const region = page.getByRole('region', { name: 'Cable Comparison' });
    await expect(region).toHaveAttribute('tabindex', '0');
    await expect(region.getByRole('table')).toBeVisible();
    await expect(region.getByRole('row')).toHaveCount(5);
    await expect(region.getByRole('columnheader')).toHaveText(['Cable Type', 'Max Speed', 'Max Distance', 'Use Case', 'Price Range']);

    const first = page.locator('details.faq-item').first();
    await expect(first).not.toHaveJSProperty('open', true);
    await first.locator('summary').click();
    await expect(first).toHaveJSProperty('open', true);
    await expect(first.locator('p')).toBeVisible();
  });

  test('the structured data is in the HTML: the business on every page, breadcrumbs and the FAQ on the service pages', async ({ page }) => {
    const blocks = async (path: string) => {
      await page.goto(pageUrl(HOST, path));
      const texts = await page.locator('script[type="application/ld+json"]').allTextContents();
      return texts.map((text) => JSON.parse(text) as { '@type': string; mainEntity?: unknown[]; itemListElement?: { item?: string }[]; url?: string });
    };
    const home = await blocks('/');
    expect(home.map((b) => b['@type'])).toEqual(['LocalBusiness']);
    expect(home[0].url).toBe(`https://${PRODUCTION}/`);
    for (const route of ROUTES.filter((r) => r.faqs)) {
      const found = await blocks(route.path);
      expect(found.map((b) => b['@type']).sort(), route.path).toEqual(['BreadcrumbList', 'FAQPage', 'LocalBusiness']);
      expect(found.find((b) => b['@type'] === 'FAQPage')?.mainEntity, route.path).toHaveLength(route.faqs!);
      const crumbs = found.find((b) => b['@type'] === 'BreadcrumbList')!.itemListElement!;
      expect(crumbs.at(-1)?.item, route.path).toBe(`https://${PRODUCTION}${route.path}`);
    }
    // Navigating inside the app replaces the page's blocks instead of piling them up.
    await page.goto(pageUrl(HOST, '/services/cameras'));
    await hydrated(page);
    await page.locator('footer').getByRole('link', { name: 'Networking', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Engineered WiFi & Network Performance.');
    const after = (await page.locator('script[type="application/ld+json"]').allTextContents()).map((t) => JSON.parse(t)['@type']);
    expect(after.sort()).toEqual(['BreadcrumbList', 'FAQPage', 'LocalBusiness']);
    const crumb = (await page.locator('script[type="application/ld+json"]').allTextContents()).map((t) => JSON.parse(t)).find((b) => b['@type'] === 'BreadcrumbList');
    expect(crumb.itemListElement.at(-1).item).toBe(`https://${PRODUCTION}/services/networking`);
  });

  test('the sitemap lists exactly the public routes of ROUTES, and not the not-found page', async ({ request }) => {
    const response = await request.get(`${edgeOrigin()}/sitemap.xml`, { headers: { Host: HOST } });
    expect(response.status()).toBe(200);
    const locs = [...(await response.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).sort();
    expect(locs).toEqual(ROUTES.map((r) => `https://${PRODUCTION}${r.path}`).sort());
  });

  test('a missing path shows the not-found page inside the lan frame', async ({ page, watched }) => {
    const url = pageUrl(HOST, '/no-such-page');
    const response = await page.goto(url);
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Page not found');
    await expect(page.locator('header').getByRole('link', { name: 'Action Jackson Installs' })).toBeVisible();
    await expect(page.locator('footer')).toContainText('Precision infrastructure');
    expect(await watched.problems([url])).toEqual([]);
  });

  test('the site switcher, skip link and offline banner are in the frame, with the skip link first', async ({ page }) => {
    await page.goto(pageUrl(HOST));
    await expect(page.getByRole('navigation', { name: 'Action Jackson sites' })).toBeVisible();
    await expect(page.locator('[role="status"]')).toHaveCount(1);
    await page.keyboard.press('Tab');
    await expect(page.locator('a.skip-link')).toBeFocused();
  });

  test('the API is down in this run: the pages still render, and the offline banner stays empty because nothing calls the API', async ({ page }) => {
    await page.goto(pageUrl(HOST, '/services/cameras'));
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('[role="status"]')).toHaveText('');
  });

  test('keyboard focus is visible on the header links, the buttons and the menu toggles', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(pageUrl(HOST));
    const rings: string[] = [];
    for (let i = 0; i < 9; i += 1) {
      await page.keyboard.press('Tab');
      rings.push(
        await page.evaluate(() => {
          const el = document.activeElement as HTMLElement;
          const style = getComputedStyle(el);
          return style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) >= 2 ? 'ring' : `no-ring: ${el.outerHTML.slice(0, 60)}`;
        }),
      );
    }
    expect(rings.filter((ring) => ring !== 'ring')).toEqual([]);
  });

  test('with reduced motion, nothing animates', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(pageUrl(HOST));
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const running = await page.evaluate(() => document.getAnimations().filter((a) => a.effect?.getComputedTiming().activeDuration !== 0).length);
    expect(running).toBe(0);
  });
});
