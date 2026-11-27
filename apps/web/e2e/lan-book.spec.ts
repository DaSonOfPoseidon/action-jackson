// The lan booking page (/book), opened through a real edge by Host name lan.localhost.
//
// This file is the booking page's @down side: the API is down (the offline states), or the open times are answered by the
// test itself (page.route) so the day and time pickers can be checked without a database. The real bookings, which need the
// quotes of lan-quote.spec.ts, are in that file's serial @up block.
// What the page must say is written out here on purpose, not imported from the app.
import type { Page } from '@playwright/test';
import { contrastFailures, settled } from './contrast-audit';
import { expect, test } from './fixtures';
import { axeViolations, hydrated } from './lan-helpers';
import { pageUrl } from './sites';

const HOST = 'lan.localhost';
const BOOK_URL = pageUrl(HOST, '/book');
const SUBMIT = 'Book Appointment';
const OFFLINE = "We can't reach our booking system right now. You can still browse; please try again later.";

// Two open days in the answer the test gives for GET /api/lan/availability (Monday 7 and Tuesday 8 January 2030).
const MOCK_DAYS = [
  { date: '2030-01-07', starts: ['08:00', '09:00', '10:00'] },
  { date: '2030-01-08', starts: ['08:00', '13:30'] },
];

async function mockAvailability(page: Page): Promise<void> {
  await page.route('**/api/lan/availability*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ timeZone: 'America/Chicago', days: MOCK_DAYS }) }),
  );
}

// The calls the page makes to the API, as "METHOD /path?query".
function trackApi(page: Page): string[] {
  const calls: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/api/')) {
      calls.push(`${request.method()} ${url.pathname}${url.search}`);
    }
  });
  return calls;
}

async function open(page: Page, path = '/book'): Promise<void> {
  await page.goto(pageUrl(HOST, path));
  await expect(page.getByRole('button', { name: SUBMIT })).toBeEnabled({ timeout: 15_000 });
}

// The audits run on a full-page screenshot with text boxes in page coordinates, and the header is sticky: see lan-quote.spec.ts.
async function atTop(page: Page): Promise<void> {
  await page.evaluate(() => window.scrollTo(0, 0));
  await settled(page);
}

const kind = (page: Page, name: 'Site Survey' | 'Drops-Only Install' | 'Whole-Home Install') => page.getByRole('radio', { name: new RegExp(`^${name}`) });
const summary = (page: Page) => page.locator('.summary');
const alertRegion = (page: Page) => page.locator('aj-form-status [role="alert"]');
const slotNote = (page: Page) => page.locator('.bf-slots-note');

// A console error for a 503 is the offline answer these tests make on purpose.
const unexpected = async (watched: { problems(): Promise<string[]> }) => (await watched.problems()).filter((problem) => !problem.includes('status of 503'));

test.describe('the booking page, before the API is needed', () => {
  test('is in the prerendered page with its button off, and with JavaScript off nothing can be sent @down', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    try {
      const page = await context.newPage();
      const sent: string[] = [];
      page.on('request', (request) => {
        if (request.method() !== 'GET') {
          sent.push(`${request.method()} ${request.url()}`);
        }
      });
      await page.goto(BOOK_URL);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Book an Appointment.');
      await expect(page.locator('form.cform')).toHaveAttribute('method', 'post');
      await expect(page.getByRole('button', { name: SUBMIT })).toBeDisabled();
      await expect(page.locator('.cf-wait')).toContainText('needs JavaScript');
      await expect(page.locator('.cf-wait a[href^="mailto:"]')).toBeVisible();
      await page.getByRole('textbox', { name: 'Email on the quote' }).fill('someone@example.com');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
      expect(page.url()).toBe(BOOK_URL);
      expect(sent).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('makes no API call until a kind is chosen, and prefills the quote number only when it is eight digits @down', async ({ page }) => {
    const api = trackApi(page);
    await open(page, '/book?quote=12345678');
    await hydrated(page);
    await expect(page.getByRole('textbox', { name: 'Quote number' })).toHaveValue('12345678');
    await expect(page.getByRole('textbox', { name: 'Email on the quote' })).toHaveValue('');
    await page.waitForTimeout(800);
    expect(api).toEqual([]);
    // The number is in the URL, the email never is.
    expect(page.url()).toBe(pageUrl(HOST, '/book?quote=12345678'));

    for (const quote of ['abc', '123456789', '1234567']) {
      await open(page, `/book?quote=${quote}`);
      await expect(page.getByRole('textbox', { name: 'Quote number' })).toHaveValue('');
    }
  });

  test('asks for the open days from today in Chicago, 31 days, once a kind is chosen, and again for a length @down', async ({ page }) => {
    // 05:30 UTC on the 28th is 23:30 on the 27th in Chicago: the window starts on the 27th, not the UTC date.
    await page.clock.setFixedTime(new Date('2026-11-28T05:30:00Z'));
    const api = trackApi(page);
    await mockAvailability(page);
    await open(page);
    await kind(page, 'Site Survey').check();
    await expect.poll(() => api.length).toBe(1);
    expect(api[0]).toBe('GET /api/lan/availability?from=2026-11-27&to=2026-12-27&kind=survey');
    await kind(page, 'Drops-Only Install').check();
    await expect.poll(() => api.length).toBe(2);
    expect(api[1]).toBe('GET /api/lan/availability?from=2026-11-27&to=2026-12-27&kind=drops-only-install&durationMinutes=120');
    await page.getByRole('combobox', { name: 'How long should we plan for?' }).selectOption('3');
    await expect.poll(() => api.length).toBe(3);
    expect(api[2]).toContain('durationMinutes=180');
    // Typing elsewhere asks for nothing.
    await page.getByRole('textbox', { name: 'Quote number' }).fill('12345678');
    await page.getByRole('textbox', { name: 'Notes' }).fill('Gate code 1234');
    await page.waitForTimeout(800);
    expect(api.length).toBe(3);
    // Later moves 31 days on; Earlier is off at the start.
    await expect(page.getByRole('button', { name: 'Earlier' })).toBeDisabled();
    await page.getByRole('button', { name: 'Later' }).click();
    await expect.poll(() => api.length).toBe(4);
    expect(api[3]).toContain('from=2026-12-28&to=2027-01-27');
    await page.getByRole('button', { name: 'Later' }).click();
    await expect.poll(() => api.length).toBe(5);
    // 90 days after the 27th: the last window stops there, and there is nothing later.
    expect(api[4]).toContain('from=2027-01-28&to=2027-02-25');
    await expect(page.getByRole('button', { name: 'Later' })).toBeDisabled();
  });

  test('says the open times cannot be reached when the API is down, offers to try again, and keeps the form usable @down', async ({ page, watched }) => {
    const api = trackApi(page);
    await open(page);
    await kind(page, 'Site Survey').check();
    await expect(slotNote(page)).toContainText(OFFLINE);
    await expect(page.locator('aj-offline-banner [role="status"]')).toHaveText(OFFLINE);
    await expect(page.locator('button.bf-day')).toHaveCount(0);
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect.poll(() => api.length).toBe(2);
    await expect(slotNote(page)).toContainText(OFFLINE);
    await page.getByRole('textbox', { name: 'Notes' }).fill('Still typing');
    await expect(page.getByRole('textbox', { name: 'Notes' })).toHaveValue('Still typing');
    expect(await unexpected(watched)).toEqual([]);
  });

  test('an empty submit lists what is missing, focuses the summary, and sends nothing @down', async ({ page, watched }) => {
    const api = trackApi(page);
    await open(page);
    await page.getByRole('button', { name: SUBMIT }).click();
    await expect(summary(page)).toBeFocused();
    await expect(summary(page).getByRole('heading', { level: 2 })).toHaveText('4 problems to fix');
    await expect(summary(page).getByRole('link')).toHaveText([
      'Quote number: Enter the 8-digit quote number.',
      'Email: Enter your email address.',
      'Appointment type: Choose the kind of appointment.',
      'Day: Choose a day.',
    ]);
    await expect(page.locator('#bf-quote-number-error')).toHaveText('Error: Enter the 8-digit quote number.');
    await summary(page).getByRole('link', { name: /^Day/ }).click();
    await expect(page.locator('#bf-slot')).toBeFocused();
    expect(api).toEqual([]);
    expect(await watched.problems()).toEqual([]);
  });

  test('chooses a day and a time from the open ones, shows them in Central Time, and asks for a time when there is none @down', async ({ page }) => {
    await mockAvailability(page);
    await open(page);
    await page.getByRole('textbox', { name: 'Quote number' }).fill('12345678');
    await page.getByRole('textbox', { name: 'Email on the quote' }).fill('ada@example.com');
    await kind(page, 'Site Survey').check();
    const days = page.locator('button.bf-day');
    await expect(days).toHaveText(['Mon, Jan 7', 'Tue, Jan 8']);
    await expect(days.first()).toHaveAttribute('aria-pressed', 'false');
    await days.first().click();
    await expect(days.first()).toHaveAttribute('aria-pressed', 'true');
    await expect(days.nth(1)).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('.bf-times legend')).toHaveText('Start times on Mon, Jan 7 (Central Time)');
    await expect(page.locator('.bf-times label')).toHaveText(['8:00 AM', '9:00 AM', '10:00 AM']);
    await page.getByRole('button', { name: SUBMIT }).click();
    await expect(summary(page).getByRole('link')).toHaveText(['Time: Choose a start time.']);
    await days.nth(1).click();
    await expect(page.locator('.bf-times label')).toHaveText(['8:00 AM', '1:30 PM']);
    await page.getByRole('radio', { name: '1:30 PM' }).check();
    await expect(page.getByRole('radio', { name: '1:30 PM' })).toBeChecked();
  });

  test('can be filled and sent with the keyboard alone, in a sensible order @down', async ({ page }) => {
    await mockAvailability(page);
    await open(page);
    const focused = () => page.evaluate(() => document.activeElement?.id ?? '');
    await page.locator('.form-hero a').last().focus();

    const steps: [string, string | 'space' | 'enter' | undefined][] = [
      ['bf-quote-number', '12345678'],
      ['bf-email', 'ada@example.com'],
    ];
    for (const [id, action] of steps) {
      await page.keyboard.press('Tab');
      expect(await focused(), id).toBe(id);
      await page.keyboard.type(action as string);
    }
    // The link for a visitor with no quote number is next, then the kinds, which are one stop: Space chooses the focused one.
    await page.keyboard.press('Tab');
    await expect(page.locator('.cf-hint a')).toBeFocused();
    await page.keyboard.press('Tab');
    expect(await focused()).toBe('bf-kind-0');
    await page.keyboard.press('Space');
    await expect(page.locator('#bf-kind-0')).toBeChecked();
    await expect(page.locator('button.bf-day').first()).toBeVisible();
    // Earlier is off at the start, so the keyboard skips it: Later, then the days.
    const order: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      await page.keyboard.press('Tab');
      order.push(await focused());
    }
    expect(order).toEqual(['bf-later', 'bf-day-2030-01-07', 'bf-day-2030-01-08']);
    await page.keyboard.press('Shift+Tab');
    expect(await focused()).toBe('bf-day-2030-01-07');
    // Enter and Space press a day button; its times are then in the page, as one radio stop after the days.
    await page.keyboard.press('Enter');
    await expect(page.locator('#bf-day-2030-01-07')).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Tab');
    expect(await focused()).toBe('bf-day-2030-01-08');
    await page.keyboard.press('Tab');
    expect(await focused()).toBe('bf-time-0');
    await page.keyboard.press('ArrowDown');
    expect(await focused()).toBe('bf-time-1');
    await expect(page.locator('#bf-time-1')).toBeChecked();
    await page.keyboard.press('Tab');
    expect(await focused()).toBe('bf-phone');
    await page.keyboard.press('Tab');
    expect(await focused()).toBe('bf-notes');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: SUBMIT })).toBeFocused();
    await expect(page.locator('#bf-honeypot')).not.toBeFocused();
    // Enter sends. The API is down for the booking: the notice shows, and the keyboard is still on the button.
    await page.keyboard.press('Enter');
    await expect(alertRegion(page)).toContainText(OFFLINE);
    await expect(page.getByRole('button', { name: SUBMIT })).toBeFocused();
  });

  test('a valid booking sends one Idempotency-Key, the same one for a retry, and a new one after a change @down', async ({ page }) => {
    await mockAvailability(page);
    const keys: (string | undefined)[] = [];
    const bodies: unknown[] = [];
    page.on('request', (request) => {
      if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/lan/appointments') {
        keys.push(request.headers()['idempotency-key']);
        bodies.push(request.postDataJSON());
      }
    });
    await open(page);
    await page.getByRole('textbox', { name: 'Quote number' }).fill('12345678');
    await page.getByRole('textbox', { name: 'Email on the quote' }).fill('ada@example.com');
    await kind(page, 'Drops-Only Install').check();
    await page.locator('button.bf-day').first().click();
    await page.getByRole('radio', { name: '9:00 AM' }).check();
    const send = page.getByRole('button', { name: SUBMIT });
    await send.click();
    await expect(alertRegion(page)).toContainText(OFFLINE);
    await expect(send).toBeEnabled();
    await send.click();
    await expect.poll(() => keys.length).toBe(2);
    await page.getByRole('textbox', { name: 'Notes' }).fill('Call first');
    await send.click();
    await expect.poll(() => keys.length).toBe(3);
    for (const key of keys) {
      expect(key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    }
    // The same request keeps its key, and a change makes a new one. The length is explicit, in minutes.
    expect(keys[1]).toBe(keys[0]);
    expect(keys[2]).not.toBe(keys[0]);
    expect(bodies[0]).toEqual({
      quoteNumber: '12345678',
      email: 'ada@example.com',
      kind: 'drops-only-install',
      date: '2030-01-07',
      time: '09:00',
      durationMinutes: 120,
      honeypot: '',
    });
  });

  for (const [width, height] of [
    [320, 640],
    [640, 800],
  ] as const) {
    test(`has no horizontal scroll at ${width}px wide with the days, the times and the errors showing @down`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await mockAvailability(page);
      await open(page);
      await kind(page, 'Drops-Only Install').check();
      await page.locator('button.bf-day').first().click();
      await page.getByRole('button', { name: SUBMIT }).click();
      await expect(summary(page)).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
      // A radio and its label are on one line.
      const misplaced = await page.locator('label.cf-choice').evaluateAll((labels) =>
        labels.flatMap((label) => {
          const box = label.querySelector('input')!.getBoundingClientRect();
          const text = label.querySelector('span')!.getBoundingClientRect();
          const sameLine = text.top < box.bottom && box.top < text.top + 28;
          const beside = box.right <= text.left + 1;
          return sameLine && beside ? [] : [`${label.textContent!.trim().slice(0, 30)}`];
        }),
      );
      expect(misplaced).toEqual([]);
    });
  }

  for (const width of [320, 1280]) {
    test(`axe finds no violation at ${width}px, empty, with a kind, with a day chosen and with the errors showing @down`, async ({ page }) => {
      await page.setViewportSize({ width, height: width === 320 ? 640 : 800 });
      await mockAvailability(page);
      await open(page);
      await hydrated(page);
      expect(await axeViolations(page)).toEqual([]);
      await kind(page, 'Drops-Only Install').check();
      await expect(page.locator('button.bf-day').first()).toBeVisible();
      expect(await axeViolations(page)).toEqual([]);
      await page.locator('button.bf-day').first().click();
      expect(await axeViolations(page)).toEqual([]);
      await page.getByRole('button', { name: SUBMIT }).click();
      await expect(summary(page)).toBeFocused();
      expect(await axeViolations(page)).toEqual([]);
    });
  }

  for (const [name, size] of [
    ['desktop', { width: 1440, height: 900 }],
    ['mobile', { width: 390, height: 844 }],
  ] as const) {
    test(`every piece of text meets AAA against what is drawn behind it, in each state of the booking form, ${name} @down`, async ({ page, browser }) => {
      test.setTimeout(180_000);
      await page.setViewportSize(size);
      await open(page);
      // The open times unreachable (the real API-down answer), and the errors.
      await kind(page, 'Site Survey').check();
      await expect(slotNote(page)).toContainText(OFFLINE);
      await page.getByRole('button', { name: SUBMIT }).click();
      await expect(summary(page)).toBeFocused();
      await atTop(page);
      expect(await contrastFailures(page, browser)).toEqual([]);

      // Days, a pressed day, its times, one of them chosen, and the error for a missing time.
      await mockAvailability(page);
      await kind(page, 'Drops-Only Install').check();
      await page.locator('button.bf-day').first().click();
      await page.getByRole('button', { name: SUBMIT }).click();
      await expect(summary(page)).toBeFocused();
      await atTop(page);
      expect(await contrastFailures(page, browser)).toEqual([]);
      await page.getByRole('radio', { name: '9:00 AM' }).check();
      await page.getByRole('textbox', { name: 'Quote number' }).fill('12345678');
      await page.getByRole('textbox', { name: 'Email on the quote' }).fill('ada@example.com');
      await page.getByRole('button', { name: SUBMIT }).click();
      await expect(alertRegion(page)).toContainText(OFFLINE);
      await atTop(page);
      expect(await contrastFailures(page, browser)).toEqual([]);
    });
  }
});
