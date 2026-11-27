// The lan quote builder (/quote), opened through a real edge by Host name lan.localhost.
//
// Like lan-forms.spec.ts, a test is tagged in its title and the Playwright project that runs it follows the tag:
//   @down  runs on the API-down edge: the checks that send nothing, and the offline cases.
//   @up    runs on the edge with the API: real quotes.
// What the page must say is written out here on purpose, not imported from the app.
import type { Page } from '@playwright/test';
import { contrastFailures, settled } from './contrast-audit';
import { expect, test } from './fixtures';
import { axeViolations, hydrated } from './lan-helpers';
import { pageUrl } from './sites';

const HOST = 'lan.localhost';
const QUOTE_URL = pageUrl(HOST, '/quote');
const API_QUOTES = pageUrl(HOST, '/api/lan/quotes');
const API_CALCULATE = pageUrl(HOST, '/api/lan/quotes/calculate');
const SUBMIT = 'Get My Quote';
const OFFLINE = "We can't reach our booking system right now. You can still browse; please try again later.";
const UNAVAILABLE = "The price can't be shown right now.";

// Money is written the way the page must write it, from a number of an API answer.
const usd = (amount: number): string => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

// The contrast audit reads a full-page screenshot with the text boxes in page coordinates. The header is sticky, so with the
// page scrolled it is drawn over text lower down (a focused heading scrolls the page), and the audit would read the header's
// pixels behind that text. At the top of the page every text is where the audit looks for it.
async function atTop(page: Page): Promise<void> {
  await page.evaluate(() => window.scrollTo(0, 0));
  await settled(page);
}

// The calls the page makes to the API, as "METHOD /path".
function trackApi(page: Page): string[] {
  const calls: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/api/')) {
      calls.push(`${request.method()} ${url.pathname}`);
    }
  });
  return calls;
}

// Opens the form and waits until the app has switched it on (the button is disabled in the prerendered page).
async function open(page: Page): Promise<void> {
  await page.goto(QUOTE_URL);
  await expect(page.getByRole('button', { name: SUBMIT })).toBeEnabled({ timeout: 15_000 });
}

const kindRadio = (page: Page, name: 'Drops Only' | 'Whole-Home') => page.getByRole('radio', { name: new RegExp(`^${name}`) });
const ack = (page: Page) => page.getByRole('checkbox', { name: /^I agree that the installer/ });

// The home, the address, the acknowledgment and the contact: what both kinds need.
async function fillCommon(page: Page, email: string): Promise<void> {
  await page.getByRole('combobox', { name: 'Age of the home' }).selectOption('2000-2020');
  await page.getByRole('combobox', { name: 'Stories' }).selectOption('2');
  await page.getByRole('combobox', { name: 'Attic access' }).selectOption('Walk-in attic');
  await page.getByRole('textbox', { name: 'Street address' }).fill('12 Main St');
  await page.getByRole('textbox', { name: 'City', exact: true }).fill('Columbia');
  await page.getByRole('textbox', { name: 'State (2 letters)' }).fill('mo');
  await page.getByRole('textbox', { name: 'ZIP code' }).fill('65201');
  await ack(page).check();
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Ada Lovelace');
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(email);
}

async function fillDrops(page: Page, email: string): Promise<void> {
  await kindRadio(page, 'Drops Only').check();
  await page.getByRole('textbox', { name: 'Cat6 runs' }).fill('2');
  await fillCommon(page, email);
}

async function fillWhole(page: Page, email: string): Promise<void> {
  await kindRadio(page, 'Whole-Home').check();
  await page.getByRole('checkbox', { name: 'Networking' }).check();
  await fillCommon(page, email);
}

const summary = (page: Page) => page.locator('.summary');
const alertRegion = (page: Page) => page.locator('aj-form-status [role="alert"]');
const price = (page: Page) => page.locator('.qf-price');

const EMPTY_SUMMARY = [
  'Quote type: Choose the kind of quote you want.',
  'Age of the home: Choose the age of your home.',
  'Stories: Choose the number of stories.',
  'Attic access: Choose the attic access.',
  'Street address: Enter the street address.',
  'City: Enter the city.',
  'State: Enter the state.',
  'ZIP code: Enter the ZIP code.',
  'Acknowledgment: Confirm the acknowledgment to continue.',
  'Name: Enter your name.',
  'Email: Enter your email address.',
];

test.describe('the quote builder, before the API is needed', () => {
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
      await page.goto(QUOTE_URL);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Get a Quote.');
      await expect(page.locator('form.cform')).toHaveAttribute('method', 'post');
      await expect(page.getByRole('button', { name: SUBMIT })).toBeDisabled();
      await expect(page.locator('.cf-wait')).toContainText('needs JavaScript');
      await expect(page.locator('.cf-wait a[href^="mailto:"]')).toBeVisible();
      // The price panel is not in the page until a kind is chosen, and no price is written into it.
      await expect(price(page)).toHaveCount(0);
      expect(await page.locator('body').innerText()).not.toContain('$');
      await page.getByRole('textbox', { name: 'Email', exact: true }).fill('someone@example.com');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
      expect(page.url()).toBe(QUOTE_URL);
      expect(sent).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('makes no API call until the visitor enters something @down', async ({ page }) => {
    const api = trackApi(page);
    await open(page);
    await hydrated(page);
    await kindRadio(page, 'Drops Only').check();
    // A kind with every count at 0 asks for no price either.
    await page.waitForTimeout(1000);
    await expect(price(page)).toContainText('Enter a number of cable runs or services to see the price.');
    expect(api).toEqual([]);
  });

  test('says the price cannot be shown, never $0, when the API is down, and asks once for a change @down', async ({ page }) => {
    const api = trackApi(page);
    await open(page);
    await kindRadio(page, 'Drops Only').check();
    await page.getByRole('textbox', { name: 'Cat6 runs' }).fill('2');
    await expect(price(page)).toContainText(UNAVAILABLE);
    await expect(price(page)).not.toContainText('$');
    await expect(page.locator('.qf-price-announce')).toHaveText(UNAVAILABLE);
    await expect(page.locator('aj-offline-banner [role="status"]')).toHaveText(OFFLINE);
    expect(api).toEqual(['POST /api/lan/quotes/calculate']);
    // Typing fast makes one request for the last value, not one per key.
    await page.getByRole('textbox', { name: 'Cat6 runs' }).fill('');
    await page.getByRole('textbox', { name: 'Cat6 runs' }).pressSequentially('12', { delay: 50 });
    await expect.poll(() => api.length).toBe(2);
    await page.waitForTimeout(800);
    expect(api).toEqual(['POST /api/lan/quotes/calculate', 'POST /api/lan/quotes/calculate']);
    // "Try again" asks again, at once.
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect.poll(() => api.length).toBe(3);
    await expect(price(page)).toContainText(UNAVAILABLE);
  });

  test('an empty submit lists what is missing, focuses the summary, and sends nothing @down', async ({ page, watched }) => {
    const api = trackApi(page);
    await open(page);
    await page.getByRole('button', { name: SUBMIT }).click();
    await expect(summary(page)).toBeFocused();
    await expect(summary(page).getByRole('heading', { level: 2 })).toHaveText('11 problems to fix');
    await expect(summary(page).getByRole('link')).toHaveText(EMPTY_SUMMARY);
    await expect(page.locator('#qf-street-error')).toHaveText('Error: Enter the street address.');
    await expect(page.getByRole('textbox', { name: 'Street address' })).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByRole('textbox', { name: 'Phone (optional)', exact: true })).not.toHaveAttribute('aria-invalid', 'true');
    await summary(page).getByRole('link', { name: /^Email/ }).click();
    await expect(page.locator('#qf-email')).toBeFocused();
    // The liability checkbox is reachable from its link, and its label stays on its line.
    await summary(page).getByRole('link', { name: /^Acknowledgment/ }).click();
    await expect(page.locator('#qf-ack')).toBeFocused();
    expect(api).toEqual([]);
    expect(await watched.problems()).toEqual([]);
  });

  test('a drops-only quote with every count at 0 asks for at least one, and sends nothing @down', async ({ page }) => {
    const api = trackApi(page);
    await open(page);
    await kindRadio(page, 'Drops Only').check();
    await fillCommon(page, 'ada@example.com');
    await page.getByRole('button', { name: SUBMIT }).click();
    await expect(summary(page).getByRole('link')).toHaveText(['Cable runs and services: Enter at least one cable run or service.']);
    await expect(page.locator('#qf-runs-error')).toContainText('Enter at least one cable run or service.');
    await summary(page).getByRole('link').click();
    await expect(page.locator('#qf-run-cat6')).toBeFocused();
    // A count over its limit is said on its field.
    await page.getByRole('textbox', { name: 'Cat6 runs' }).fill('51');
    await page.getByRole('textbox', { name: 'AP mounts' }).fill('21');
    await page.getByRole('button', { name: SUBMIT }).click();
    await expect(summary(page).getByRole('link')).toHaveText(['Cat6 runs: Enter a whole number from 0 to 50.', 'AP mounts: Enter a whole number from 0 to 20.']);
    // Nothing was priced or sent for an invalid count.
    await page.waitForTimeout(800);
    expect(api).toEqual([]);
  });

  test('a whole-home quote with no scope asks for one, shows no price panel and sends nothing @down', async ({ page }) => {
    const api = trackApi(page);
    await open(page);
    await kindRadio(page, 'Whole-Home').check();
    await expect(price(page)).toHaveCount(0);
    await expect(page.locator('.qf-whole-note')).toContainText('priced after a site survey');
    await expect(page.locator('.qf-whole-note')).toContainText('A deposit is due');
    await fillCommon(page, 'ada@example.com');
    await page.getByRole('button', { name: SUBMIT }).click();
    await expect(summary(page).getByRole('link')).toHaveText(['Scope: Choose at least one scope.']);
    await summary(page).getByRole('link').click();
    await expect(page.locator('#qf-scope-networking')).toBeFocused();
    // Own equipment swaps the brands for the description.
    await expect(page.getByRole('combobox', { name: 'Networking brand' })).toBeVisible();
    await page.getByRole('checkbox', { name: 'I have my own equipment' }).check();
    await expect(page.getByRole('combobox', { name: 'Networking brand' })).toHaveCount(0);
    await expect(page.getByRole('textbox', { name: 'Your equipment' })).toBeVisible();
    // A detail shows only for a ticked scope.
    await expect(page.getByRole('textbox', { name: 'Security details' })).toHaveCount(0);
    await page.getByRole('checkbox', { name: 'Security' }).check();
    await expect(page.getByRole('textbox', { name: 'Security details' })).toBeVisible();
    expect(api).toEqual([]);
  });

  test('keeps the trap field out of reach: not focusable, not announced @down', async ({ page }) => {
    await open(page);
    await expect(page.getByRole('textbox', { name: 'Leave this field blank' })).toHaveCount(0);
    await expect(page.locator('.cf-trap')).toHaveAttribute('aria-hidden', 'true');
    await expect(page.locator('#qf-honeypot')).toHaveAttribute('tabindex', '-1');
  });

  test('can be filled and sent with the keyboard alone, in a sensible order @down', async ({ page }) => {
    await open(page);
    const focused = () => page.evaluate(() => document.activeElement?.id ?? '');
    // Start at the last link before the form.
    await page.locator('.form-hero a').last().focus();
    await page.keyboard.press('Tab');
    expect(await focused()).toBe('qf-kind-0');
    // No kind is chosen yet: Space chooses the focused one, and the arrow keys move within the group.
    await page.keyboard.press('Space');
    await expect(page.locator('#qf-kind-0')).toBeChecked();
    await expect(page.locator('#qf-run-cat6')).toBeVisible();
    await page.keyboard.press('ArrowDown');
    expect(await focused()).toBe('qf-kind-1');
    await expect(page.locator('#qf-scope-networking')).toBeVisible();
    await page.keyboard.press('ArrowUp');
    expect(await focused()).toBe('qf-kind-0');
    await expect(page.locator('#qf-run-cat6')).toBeVisible();

    // One stop per control, in the order of the page. The price asks for a try again once the API says no.
    const steps: [string, string | 'space' | undefined][] = [
      ['qf-run-cat6', '2'],
      ['qf-run-cat6a', undefined],
      ['qf-run-coax', undefined],
      ['qf-run-fiber', undefined],
      ['qf-ap-mounts', undefined],
      ['qf-ethernet-relocations', undefined],
      ['qf-central-none', undefined],
      ['qf-price-retry', undefined],
      ['qf-home-age', '2000'],
      ['qf-stories', '2'],
      ['qf-attic-access', 'Walk'],
      ['qf-has-panel', undefined],
      ['qf-crawlspace', undefined],
      ['qf-street', '12 Main St'],
      ['qf-city', 'Columbia'],
      ['qf-state', 'MO'],
      ['qf-zip', '65201'],
      ['qf-ack', 'space'],
      ['qf-name', 'Ada Lovelace'],
      ['qf-email', 'ada@example.com'],
      ['qf-phone', undefined],
    ];
    for (const [id, action] of steps) {
      if (id === 'qf-price-retry') {
        // The request to price the 2 runs fails (the API is down in this run) 500 ms after the last key: the button is
        // there once it has, and the Tab below must find it.
        await expect(page.locator('#qf-price-retry')).toBeVisible({ timeout: 10_000 });
      }
      await page.keyboard.press('Tab');
      expect(await focused(), id).toBe(id);
      if (action === 'space') {
        await page.keyboard.press('Space');
      } else if (action) {
        await page.keyboard.type(action);
      }
    }
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: SUBMIT })).toBeFocused();
    await expect(page.locator('#qf-honeypot')).not.toBeFocused();
    // Enter sends. The API is down: the notice shows, and the keyboard is still on the button.
    await page.keyboard.press('Enter');
    await expect(alertRegion(page)).toContainText(OFFLINE);
    await expect(page.getByRole('button', { name: SUBMIT })).toBeFocused();
  });

  test('when the API is down a valid quote says so, keeps every value, and can be sent again @down', async ({ page, watched }) => {
    const api = trackApi(page);
    await open(page);
    await fillDrops(page, 'ada@example.com');
    await page.getByRole('textbox', { name: 'Phone (optional)', exact: true }).fill('(573) 555-0100');
    const send = page.getByRole('button', { name: SUBMIT });
    await send.click();
    await expect(alertRegion(page)).toContainText(OFFLINE);
    await expect(page.locator('aj-offline-banner [role="status"]')).toHaveText(OFFLINE);
    await expect(page.getByRole('textbox', { name: 'Cat6 runs' })).toHaveValue('2');
    await expect(page.getByRole('textbox', { name: 'Street address' })).toHaveValue('12 Main St');
    await expect(page.getByRole('combobox', { name: 'Stories' })).toHaveValue('2');
    await expect(ack(page)).toBeChecked();
    await expect(page.getByRole('textbox', { name: 'Email', exact: true })).toHaveValue('ada@example.com');
    await expect(page.getByRole('textbox', { name: 'Phone (optional)', exact: true })).toHaveValue('(573) 555-0100');
    await expect(send).toBeEnabled();
    await send.click();
    await expect.poll(() => api.filter((call) => call === 'POST /api/lan/quotes').length).toBe(2);
    await expect(alertRegion(page)).toContainText(OFFLINE);
    expect(await watched.problems([API_QUOTES, API_CALCULATE])).toEqual([]);
  });

  for (const [width, height] of [
    [320, 640],
    [640, 800],
  ] as const) {
    test(`has no horizontal scroll at ${width}px wide with a price, the errors and the choices showing @down`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await open(page);
      await kindRadio(page, 'Drops Only').check();
      await page.getByRole('textbox', { name: 'Cat6 runs' }).fill('2');
      await expect(price(page)).toContainText(UNAVAILABLE);
      await page.getByRole('button', { name: SUBMIT }).click();
      await expect(summary(page)).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);

      await kindRadio(page, 'Whole-Home').check();
      await page.getByRole('checkbox', { name: 'Networking' }).check();
      await page.getByRole('checkbox', { name: 'Security' }).check();
      await page.getByRole('checkbox', { name: 'VoIP' }).check();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);

      // A checkbox or radio and its label are on one line: the box is at the start of the first line of its text.
      const misplaced = await page.locator('label.cf-choice').evaluateAll((labels) =>
        labels.flatMap((label) => {
          const box = label.querySelector('input')!.getBoundingClientRect();
          const text = label.querySelector('span')!.getBoundingClientRect();
          const sameLine = text.top < box.bottom && box.top < text.top + 28;
          const beside = box.right <= text.left + 1;
          return sameLine && beside ? [] : [`${label.textContent!.trim().slice(0, 30)}: ${JSON.stringify({ box: [box.left, box.top], text: [text.left, text.top] })}`];
        }),
      );
      expect(misplaced).toEqual([]);
    });
  }

  for (const width of [320, 1280]) {
    test(`axe finds no violation at ${width}px, empty, with each kind chosen and with the errors showing @down`, async ({ page }) => {
      await page.setViewportSize({ width, height: width === 320 ? 640 : 800 });
      await open(page);
      await hydrated(page);
      expect(await axeViolations(page)).toEqual([]);
      await kindRadio(page, 'Drops Only').check();
      await page.getByRole('textbox', { name: 'Cat6 runs' }).fill('2');
      await expect(price(page)).toContainText(UNAVAILABLE);
      expect(await axeViolations(page)).toEqual([]);
      await kindRadio(page, 'Whole-Home').check();
      await page.getByRole('checkbox', { name: 'Networking' }).check();
      await page.getByRole('checkbox', { name: 'Security' }).check();
      await page.getByRole('checkbox', { name: 'I have my own equipment' }).check();
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
    test(`every piece of text meets AAA against what is drawn behind it, in each state of the quote form, ${name} @down`, async ({ page, browser }) => {
      test.setTimeout(180_000);
      await page.setViewportSize(size);
      await open(page);
      // Drops-only, the price unavailable, and the errors.
      await kindRadio(page, 'Drops Only').check();
      await page.getByRole('textbox', { name: 'Cat6 runs' }).fill('2');
      await expect(price(page)).toContainText(UNAVAILABLE);
      await page.getByRole('button', { name: SUBMIT }).click();
      await expect(summary(page)).toBeFocused();
      await atTop(page);
      expect(await contrastFailures(page, browser)).toEqual([]);

      // Whole-home, with its details and the equipment text showing, and the errors.
      await kindRadio(page, 'Whole-Home').check();
      await page.getByRole('checkbox', { name: 'Networking' }).check();
      await page.getByRole('checkbox', { name: 'Security' }).check();
      await page.getByRole('checkbox', { name: 'VoIP' }).check();
      await page.getByRole('checkbox', { name: 'I have my own equipment' }).check();
      await page.getByRole('button', { name: SUBMIT }).click();
      await expect(summary(page)).toBeFocused();
      await atTop(page);
      expect(await contrastFailures(page, browser)).toEqual([]);

      // The offline notice with every field filled, and the disabled submit (a state of its own).
      await fillWhole(page, 'ada@example.com');
      await page.getByRole('button', { name: SUBMIT }).click();
      await expect(alertRegion(page)).toContainText(OFFLINE);
      await atTop(page);
      expect(await contrastFailures(page, browser)).toEqual([]);
    });
  }
});

// Two quotes of this run, the quote number of the first one, in order: the whole block is serial, because the second test
// needs the first one's number (and the booking specs after it need the quote). This is the only ordered part of the run
// that touches the quote and booking endpoints.
//
// The API's limits are fixed (no bypass is added for tests) and every request of this run comes from one address. This block
// sends exactly: 2 POSTs to /api/lan/quotes (limit 3 per 15 minutes), and its price asks for the counts it types (the limit
// is 30 per minute: a handful). Nothing else in the run posts to quotes.
const STAMP = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const EMAIL_A = `e2e-quote-a-${STAMP}@example.com`;
const EMAIL_B = `e2e-quote-b-${STAMP}@example.com`;

interface Calculation {
  lines: { code: string; description: string; quantity: number; unitPrice: number; lineTotal: number }[];
  subtotal: number;
  total: number;
  deposit: number;
}

test.describe.serial('the quote builder against the real API @up', () => {
  test('shows the API\'s own lines and totals for two Cat6 runs, as the API wrote them', async ({ page, watched }) => {
    await open(page);
    await hydrated(page);
    await kindRadio(page, 'Drops Only').check();
    const answered = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/lan/quotes/calculate' && response.request().method() === 'POST');
    await page.getByRole('textbox', { name: 'Cat6 runs' }).fill('2');
    const response = await answered;
    expect(response.status()).toBe(200);
    const body = (await response.json()) as Calculation;
    // Two Cat6 runs: one line of two. The numbers are the API's, and the page must write exactly those.
    expect(body.lines.length).toBe(1);
    expect(body.lines[0].quantity).toBe(2);
    expect(body.total).toBeGreaterThan(0);
    const panel = price(page);
    await expect(panel.locator('.qf-line-name')).toHaveText(body.lines[0].description);
    await expect(panel.locator('.qf-line-math')).toHaveText(`2 × ${usd(body.lines[0].unitPrice)}`);
    await expect(panel.locator('.qf-line-total')).toHaveText(usd(body.lines[0].lineTotal));
    await expect(panel.locator('[data-row="total"] dd')).toHaveText(usd(body.total));
    if (body.deposit > 0) {
      await expect(panel.locator('[data-row="deposit"] dd')).toHaveText(usd(body.deposit));
    }
    await expect(page.locator('.qf-price-announce')).toContainText(usd(body.total));
    await expect(panel).not.toContainText(UNAVAILABLE);
    expect(await watched.problems()).toEqual([]);
    // The price panel is a state the audits must pass too.
    expect(await axeViolations(page)).toEqual([]);
  });

  test('creates a drops-only quote, shows its eight-digit number, and the total and deposit the API sent (201)', async ({ page, browser, watched }) => {
    test.setTimeout(120_000);
    await open(page);
    await fillDrops(page, EMAIL_A);
    const created = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/lan/quotes' && response.request().method() === 'POST');
    await page.getByRole('button', { name: SUBMIT }).click();
    const response = await created;
    expect(response.status()).toBe(201);
    const body = (await response.json()) as { quoteNumber: string; kind: string; total: number; deposit: number };
    expect(body.quoteNumber).toMatch(/^\d{8}$/);
    expect(body.kind).toBe('drops-only');

    const sent = page.locator('.cf-sent');
    await expect(sent.getByRole('heading', { level: 2 })).toHaveText('Quote created');
    await expect(sent.getByRole('heading', { level: 2 })).toBeFocused();
    await expect(sent.locator('strong.qf-number')).toHaveText(body.quoteNumber);
    await expect(sent).toContainText(usd(body.total));
    if (body.deposit > 0) {
      await expect(sent).toContainText(usd(body.deposit));
    }
    // What the API does is what the page says: no copy is emailed (there is none), and no time is promised.
    await expect(sent).toContainText('No copy of this quote is emailed to you.');
    expect(await sent.innerText()).not.toMatch(/within|hours|inbox|confirmation|check your/i);
    await expect(sent.getByRole('link', { name: 'Book an appointment' })).toHaveAttribute('href', `/book?quote=${body.quoteNumber}`);
    // The email is in no URL.
    expect(await sent.getByRole('link', { name: 'Book an appointment' }).getAttribute('href')).not.toContain(EMAIL_A);
    await expect(page.locator('form.cform')).toHaveCount(0);
    expect(await watched.problems()).toEqual([]);

    await atTop(page);
    expect(await axeViolations(page)).toEqual([]);
    expect(await contrastFailures(page, browser)).toEqual([]);
    await page.setViewportSize({ width: 390, height: 844 });
    await atTop(page);
    expect(await axeViolations(page)).toEqual([]);
    expect(await contrastFailures(page, browser)).toEqual([]);
  });

  test('creates a whole-home quote, shows only its deposit and never a $0 total (201)', async ({ page, browser, watched }) => {
    test.setTimeout(120_000);
    await open(page);
    await fillWhole(page, EMAIL_B);
    const created = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/lan/quotes' && response.request().method() === 'POST');
    await page.getByRole('button', { name: SUBMIT }).click();
    const response = await created;
    expect(response.status()).toBe(201);
    const body = (await response.json()) as { quoteNumber: string; kind: string; total: number; deposit: number };
    expect(body.kind).toBe('whole-home');
    // The API sends 0 for a whole-home total on purpose: the page must not show it.
    expect(body.total).toBe(0);
    expect(body.deposit).toBeGreaterThan(0);

    const sent = page.locator('.cf-sent');
    await expect(sent.locator('strong.qf-number')).toHaveText(body.quoteNumber);
    await expect(sent).toContainText(usd(body.deposit));
    await expect(sent).toContainText('is set after a site survey');
    const text = await sent.innerText();
    expect(text).not.toContain('$0');
    expect(text).not.toMatch(/total/i);
    expect(await watched.problems()).toEqual([]);
    await atTop(page);
    expect(await axeViolations(page)).toEqual([]);
    expect(await contrastFailures(page, browser)).toEqual([]);
  });
});

test.describe('the quote builder with the API behind the edge @up', () => {
  test('opens, switches on, and leaves the offline banner empty', async ({ page, watched }) => {
    await open(page);
    await hydrated(page);
    await expect(page.locator('aj-offline-banner [role="status"]')).toHaveText('');
    expect(await watched.problems()).toEqual([]);
  });
});
