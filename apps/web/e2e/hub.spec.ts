// The main site's landing hub: three site cards and the socials, opened through the real edge by its Host name.
import AxeBuilder from '@axe-core/playwright';
import { pageUrl } from './sites';
import { expect, test } from './fixtures';

const HOST = 'localhost';

// Written out here on purpose, not imported from the shared library.
const CARDS = [
  { heading: 'Home Networking', href: 'https://lan.actionjacksoninstalls.com/' },
  { heading: 'Car Audio & Remote Start', href: 'https://car.actionjacksoninstalls.com/' },
  { heading: 'Developer Portfolio', href: 'https://dev.actionjacksoninstalls.com/' },
] as const;

const SOCIAL_LINKS = [
  { name: 'GitHub', href: 'https://github.com/DaSonOfPoseidon' },
  { name: 'LinkedIn', href: 'https://www.linkedin.com/in/jackson-keithley-115582213/' },
  { name: 'jackson@actionjacksoninstalls.com', href: 'mailto:jackson@actionjacksoninstalls.com' },
] as const;

test.describe('main hub', () => {
  test('lists the three sites as whole-card links, in order, to their production URLs', async ({ page, watched }) => {
    await page.goto(pageUrl(HOST));
    const cards = page.locator('main#main').getByRole('list', { name: 'Sites' }).getByRole('listitem');
    await expect(cards).toHaveCount(CARDS.length);
    for (const [index, card] of CARDS.entries()) {
      const item = cards.nth(index);
      await expect(item.getByRole('heading', { level: 2 })).toHaveText(card.heading);
      // One link per card, named by the site, pointing at its production host.
      await expect(item.getByRole('link')).toHaveCount(1);
      await expect(item.getByRole('link', { name: card.heading, exact: true })).toHaveAttribute('href', card.href);
    }
    expect(await watched.problems()).toEqual([]);
  });

  test('a click anywhere on a card follows its link', async ({ page }) => {
    await page.goto(pageUrl(HOST));
    const item = page.locator('main#main').getByRole('list', { name: 'Sites' }).getByRole('listitem').nth(1);
    const box = (await item.boundingBox())!;
    // The bottom-right corner of the card is far from its heading text, so only a stretched link answers it.
    const target = await page.evaluate(
      ([x, y]) => {
        const hit = document.elementFromPoint(x, y);
        return hit?.closest('a')?.getAttribute('href') ?? null;
      },
      [box.x + box.width - 6, box.y + box.height - 6],
    );
    expect(target).toBe('https://car.actionjacksoninstalls.com/');
  });

  test('shows the socials with their real URLs', async ({ page }) => {
    await page.goto(pageUrl(HOST));
    const socials = page.locator('main#main').getByRole('navigation', { name: 'Find Jackson online' });
    await expect(socials.getByRole('link')).toHaveCount(SOCIAL_LINKS.length);
    for (const social of SOCIAL_LINKS) {
      await expect(socials.getByRole('link', { name: social.name, exact: true })).toHaveAttribute('href', social.href);
    }
  });

  test('tab order runs header, cards, socials, footer and every stop shows a focus ring', async ({ page }) => {
    await page.goto(pageUrl(HOST));
    await expect(page.locator('aj-root')).toHaveAttribute('ng-version', /\d/);
    const stops: string[] = [];
    for (let i = 0; i < 10; i += 1) {
      await page.keyboard.press('Tab');
      stops.push(
        await page.evaluate(() => {
          const el = document.activeElement as HTMLElement;
          const style = getComputedStyle(el);
          const after = getComputedStyle(el, '::after');
          const ring = style.outlineStyle !== 'none' || after.outlineStyle !== 'none';
          return `${el.textContent?.trim()}|${ring ? 'ring' : 'no-ring'}`;
        }),
      );
    }
    expect(stops).toEqual([
      'Skip to main content|ring',
      'Home Networking|ring',
      'Car Audio & Remote Start|ring',
      'Developer Portfolio|ring',
      'Home Networking|ring',
      'Car Audio & Remote Start|ring',
      'Developer Portfolio|ring',
      'GitHub|ring',
      'LinkedIn|ring',
      'jackson@actionjacksoninstalls.com|ring',
    ]);
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
