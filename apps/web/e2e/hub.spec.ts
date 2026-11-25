// The main site's landing hub: one question and three big buttons, opened through the real edge by its Host name.
import AxeBuilder from '@axe-core/playwright';
import { pageUrl } from './sites';
import { expect, test } from './fixtures';

const HOST = 'localhost';

// Written out here on purpose, not imported from the shared library.
const BUTTONS = [
  { name: 'Home networking', href: 'https://lan.actionjacksoninstalls.com/' },
  { name: 'Car audio and remote start', href: 'https://car.actionjacksoninstalls.com/' },
  { name: 'Developer portfolio', href: 'https://dev.actionjacksoninstalls.com/' },
] as const;

test.describe('main hub', () => {
  test('asks one question and lists the three sites as buttons, in order, to their production URLs', async ({ page, watched }) => {
    await page.goto(pageUrl(HOST));
    const main = page.locator('main#main');
    await expect(main.getByRole('heading', { level: 1 })).toHaveText('What are you looking for?');
    const links = main.getByRole('link');
    await expect(links).toHaveCount(BUTTONS.length);
    for (const [index, button] of BUTTONS.entries()) {
      await expect(links.nth(index)).toHaveText(button.name);
      await expect(main.getByRole('link', { name: button.name, exact: true })).toHaveAttribute('href', button.href);
    }
    expect(await watched.problems()).toEqual([]);
  });

  test('is a whole screen: no header, switcher, footer or skip link, and the page is only the question and the buttons', async ({ page }) => {
    await page.goto(pageUrl(HOST));
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('header, footer, nav, a.skip-link')).toHaveCount(0);
    await expect(page.getByRole('link')).toHaveCount(BUTTONS.length);
    // The main element fills the viewport.
    const box = (await page.locator('main#main').boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(page.viewportSize()!.height);
  });

  test('tab order runs through the three buttons and every stop shows a focus ring', async ({ page }) => {
    await page.goto(pageUrl(HOST));
    await expect(page.locator('aj-root')).toHaveAttribute('ng-version', /\d/);
    const stops: string[] = [];
    for (let i = 0; i < BUTTONS.length; i += 1) {
      await page.keyboard.press('Tab');
      stops.push(
        await page.evaluate(() => {
          const el = document.activeElement as HTMLElement;
          const style = getComputedStyle(el);
          return `${el.textContent?.trim()}|${style.outlineStyle !== 'none' && style.outlineWidth !== '0px' ? 'ring' : 'no-ring'}`;
        }),
      );
    }
    expect(stops).toEqual(BUTTONS.map((button) => `${button.name}|ring`));
  });

  test('has no horizontal scroll at 320px, and the page is laid out at 1920px', async ({ page }) => {
    for (const width of [320, 1920]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(pageUrl(HOST));
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `scrollWidth - innerWidth at ${width}px`).toBeLessThanOrEqual(0);
    }
  });

  test('loads its two self-hosted fonts from its own origin, with no request to another host', async ({ page }) => {
    const hosts = new Set<string>();
    page.on('request', (request) => hosts.add(new URL(request.url()).host));
    const fonts: string[] = [];
    page.on('response', (response) => {
      if (new URL(response.url()).pathname.endsWith('.woff2')) {
        fonts.push(`${response.status()} ${new URL(response.url()).pathname}`);
      }
    });
    await page.goto(pageUrl(HOST));
    await page.evaluate(() => document.fonts.ready);
    expect([...hosts]).toEqual([new URL(pageUrl(HOST)).host]);
    expect(fonts).toHaveLength(2);
    expect(fonts.every((font) => font.startsWith('200 '))).toBe(true);
    // The headings use Syne, the buttons Figtree.
    const used = await page.evaluate(() => [
      getComputedStyle(document.querySelector('h1')!).fontFamily,
      getComputedStyle(document.querySelector('main a')!).fontFamily,
      document.fonts.check('700 16px Syne'),
      document.fonts.check('600 16px Figtree'),
    ]);
    expect(used[0]).toMatch(/^"?Syne"?,/);
    expect(used[1]).toMatch(/^"?Figtree"?,/);
    expect(used[2]).toBe(true);
    expect(used[3]).toBe(true);
  });

  test('makes no request to the api and is clean for axe at 320px and at desktop width', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/')) {
        requests.push(request.url());
      }
    });
    for (const width of [320, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(pageUrl(HOST));
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag2aaa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
    }
    expect(requests).toEqual([]);
    // The offline banner's text never appears, and its live region stays empty.
    await expect(page.locator('aj-offline-banner .notice')).toHaveCount(0);
  });
});
