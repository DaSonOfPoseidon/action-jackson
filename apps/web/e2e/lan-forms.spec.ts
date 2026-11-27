// The lan consultation request form (/get-started), opened through a real edge by Host name lan.localhost.
//
// Two edges serve the same build (playwright.config.ts): one whose API is down, and one with the real API and a fresh
// database behind it. A test is tagged in its title, and the project that runs it follows the tag:
//   @down  runs on the API-down edge: the checks that send nothing, and the offline cases.
//   @up    runs on the edge with the API: real submissions.
// What the page must say is written out here on purpose, not imported from the app.
import type { Page } from '@playwright/test';
import { contrastFailures, settled } from './contrast-audit';
import { expect, test } from './fixtures';
import { axeViolations, hydrated } from './lan-helpers';
import { pageUrl } from './sites';

const HOST = 'lan.localhost';
const FORM_URL = pageUrl(HOST, '/get-started');
const API_URL = pageUrl(HOST, '/api/lan/consultations');
const SUBMIT = 'Submit Consultation Request';
const OFFLINE = "We can't reach our booking system right now. You can still browse; please try again later.";

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
  await page.goto(FORM_URL);
  await expect(page.getByRole('button', { name: SUBMIT })).toBeEnabled({ timeout: 15_000 });
}

async function fillValid(page: Page, email: string, phone?: string): Promise<void> {
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Ada Lovelace');
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(email);
  if (phone) {
    await page.getByRole('textbox', { name: 'Phone (optional)', exact: true }).fill(phone);
  }
  await page.getByRole('combobox', { name: 'Square footage' }).selectOption('1,500-2,500');
  await page.getByRole('checkbox', { name: 'Networking' }).check();
}

const summary = (page: Page) => page.locator('.summary');
const alertRegion = (page: Page) => page.locator('aj-form-status [role="alert"]');

test.describe('the consultation form, before the API is needed', () => {
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
      await page.goto(FORM_URL);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Get Started.');
      await expect(page.locator('form.cform')).toHaveAttribute('method', 'post');
      await expect(page.getByRole('button', { name: SUBMIT })).toBeDisabled();
      // The note says what is going on and where else to reach the business.
      await expect(page.locator('.cf-wait')).toContainText('needs JavaScript');
      await expect(page.locator('.cf-wait a[href^="mailto:"]')).toBeVisible();
      // Enter in a field submits nothing: a disabled submit button blocks it, so no GET puts the email in the URL.
      await page.getByRole('textbox', { name: 'Email', exact: true }).fill('someone@example.com');
      await page.keyboard.press('Enter');
      // There is nothing to wait for (nothing happens), so give a navigation, if one were coming, time to start.
      await page.waitForTimeout(500);
      expect(page.url()).toBe(FORM_URL);
      expect(sent).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('an empty submit lists what is missing, focuses the summary, and sends nothing @down', async ({ page, watched }) => {
    const api = trackApi(page);
    await open(page);
    await expect(page.locator('.cf-wait')).toHaveCount(0);
    await page.getByRole('button', { name: SUBMIT }).click();
    await expect(summary(page)).toBeFocused();
    await expect(summary(page).getByRole('heading', { level: 2 })).toHaveText('4 problems to fix');
    await expect(summary(page).getByRole('link')).toHaveText([
      'Name: Enter your name.',
      'Email: Enter your email address.',
      'Square footage: Choose your square footage.',
      'Services: Choose at least one service.',
    ]);
    // Each error is on its field too, and the control says so.
    await expect(page.locator('#cf-name-error')).toHaveText('Error: Enter your name.');
    await expect(page.getByRole('textbox', { name: 'Name', exact: true })).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByRole('textbox', { name: 'Phone (optional)', exact: true })).not.toHaveAttribute('aria-invalid', 'true');
    // A link takes the keyboard to its field, and a group's link to its first checkbox.
    await summary(page).getByRole('link', { name: /^Email/ }).click();
    await expect(page.locator('#cf-email')).toBeFocused();
    await summary(page).getByRole('link', { name: /^Services/ }).click();
    await expect(page.locator('#cf-service-0')).toBeFocused();
    expect(api).toEqual([]);
    expect(await watched.problems()).toEqual([]);
  });

  test('keeps the trap field out of reach: not focusable, not announced, and never in the tab order @down', async ({ page }) => {
    await open(page);
    await expect(page.getByRole('textbox', { name: 'Leave this field blank' })).toHaveCount(0);
    await expect(page.locator('.cf-trap')).toHaveAttribute('aria-hidden', 'true');
    await expect(page.locator('#cf-honeypot')).toHaveAttribute('tabindex', '-1');
    await expect(page.locator('#cf-honeypot')).toHaveAttribute('name', 'honeypot');
    // It is off screen, not display: none (a bot fills what it finds in the DOM).
    const box = await page.locator('#cf-honeypot').boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x + box!.width).toBeLessThan(0);
    expect(await page.locator('#cf-honeypot').evaluate((el) => getComputedStyle(el).display)).not.toBe('none');
  });

  test('can be filled and sent with the keyboard alone, in a sensible order @down', async ({ page }) => {
    await open(page);
    const focused = () => page.evaluate(() => document.activeElement?.id ?? '');
    // Start just before the form: a click on the heading sets where the next Tab goes from.
    await page.getByRole('heading', { level: 1 }).click();
    await page.keyboard.press('Tab');
    expect(await focused()).toBe('cf-name');
    await page.keyboard.type('Ada Lovelace');
    await page.keyboard.press('Tab');
    expect(await focused()).toBe('cf-email');
    await page.keyboard.type('ada@example.com');
    await page.keyboard.press('Tab');
    expect(await focused()).toBe('cf-phone');
    await page.keyboard.press('Tab');
    expect(await focused()).toBe('cf-square-footage');
    // A letter picks the option that starts with it: "1,500 - 2,500 sq ft".
    await page.keyboard.type('1');
    await page.keyboard.press('Tab');
    expect(await focused()).toBe('cf-isp');

    const order: string[] = [];
    for (let i = 0; i < 12; i += 1) {
      await page.keyboard.press('Tab');
      order.push(await focused());
    }
    expect(order).toEqual([...Array.from({ length: 8 }, (_, i) => `cf-issue-${i}`), ...Array.from({ length: 4 }, (_, i) => `cf-service-${i}`)]);

    // Space ticks a service. The radio group is one stop: an arrow key moves within it.
    await page.locator('#cf-service-0').focus();
    await page.keyboard.press('Space');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    expect(await focused()).toBe('cf-package-0');
    await page.keyboard.press('ArrowDown');
    expect(await focused()).toBe('cf-package-1');
    await expect(page.locator('#cf-package-1')).toBeChecked();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: SUBMIT })).toBeFocused();
    // The trap field was never reached (it would have shown up in the ids above).
    await expect(page.locator('#cf-honeypot')).not.toBeFocused();

    // Enter sends. The API is down in this run: the notice shows, and the keyboard is still on the button.
    await page.keyboard.press('Enter');
    await expect(alertRegion(page)).toContainText(OFFLINE);
    await expect(page.getByRole('button', { name: SUBMIT })).toBeFocused();
  });

  test('when the API is down it says so, in the form and in the frame, keeps every value, and can be sent again @down', async ({ page, watched }) => {
    const api = trackApi(page);
    await open(page);
    await fillValid(page, 'ada@example.com', '(573) 555-0100');
    await page.getByRole('textbox', { name: 'Current internet provider (optional)' }).fill('Example Fiber');
    await page.getByRole('radio', { name: 'Not sure yet' }).check();
    const send = page.getByRole('button', { name: SUBMIT });
    await send.click();

    await expect(alertRegion(page)).toContainText(OFFLINE);
    // The frame's banner (the shared offline banner) says it too: the API client noticed.
    await expect(page.locator('aj-offline-banner [role="status"]')).toHaveText(OFFLINE);
    // Nothing was lost, and the button is back.
    await expect(page.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue('Ada Lovelace');
    await expect(page.getByRole('textbox', { name: 'Email', exact: true })).toHaveValue('ada@example.com');
    await expect(page.getByRole('textbox', { name: 'Phone (optional)', exact: true })).toHaveValue('(573) 555-0100');
    await expect(page.getByRole('combobox', { name: 'Square footage' })).toHaveValue('1,500-2,500');
    await expect(page.getByRole('textbox', { name: 'Current internet provider (optional)' })).toHaveValue('Example Fiber');
    await expect(page.getByRole('checkbox', { name: 'Networking' })).toBeChecked();
    await expect(page.getByRole('radio', { name: 'Not sure yet' })).toBeChecked();
    await expect(send).toBeEnabled();
    await expect(send).toHaveText(SUBMIT);

    // Sent again (with a change), it asks again: the form was not locked by the failure.
    await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Ada King');
    await send.click();
    await expect.poll(() => api.length).toBe(2);
    await expect(alertRegion(page)).toContainText(OFFLINE);
    expect(api).toEqual(['POST /api/lan/consultations', 'POST /api/lan/consultations']);
    expect(await watched.problems([API_URL])).toEqual([]);
  });

  test('sends the request once for a double click @down', async ({ page }) => {
    const api = trackApi(page);
    await open(page);
    await fillValid(page, 'ada@example.com');
    await page.getByRole('button', { name: SUBMIT }).dblclick();
    await expect(alertRegion(page)).toContainText(OFFLINE);
    expect(api).toEqual(['POST /api/lan/consultations']);
  });

  for (const [width, height] of [
    [320, 640],
    [640, 800],
  ] as const) {
    test(`has no horizontal scroll at ${width}px wide with the errors showing, and its choices wrap beside their boxes @down`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await open(page);
      await page.getByRole('button', { name: SUBMIT }).click();
      await expect(summary(page)).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);

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
    test(`axe finds no violation at ${width}px, empty and with the errors showing @down`, async ({ page }) => {
      await page.setViewportSize({ width, height: width === 320 ? 640 : 800 });
      await open(page);
      await hydrated(page);
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
    test(`every piece of text meets AAA against what is drawn behind it, with the errors and the offline notice showing, ${name} @down`, async ({ page, browser }) => {
      test.setTimeout(120_000);
      await page.setViewportSize(size);
      await open(page);
      await page.getByRole('button', { name: SUBMIT }).click();
      await expect(summary(page)).toBeFocused();
      await settled(page);
      expect(await contrastFailures(page, browser)).toEqual([]);

      // The error state of the fields themselves: a field with its message, and the offline notice.
      await fillValid(page, 'ada@example.com');
      await page.getByRole('button', { name: SUBMIT }).click();
      await expect(alertRegion(page)).toContainText(OFFLINE);
      await settled(page);
      expect(await contrastFailures(page, browser)).toEqual([]);
    });
  }
});

// One email for the three submissions below. A rate limit of 3 requests per 15 minutes per client IP is fixed in the API
// (no bypass is added for tests), and every request of this run comes from one address, so this block sends exactly three
// POSTs, and they depend on each other in order: a 400, a 201, then the same email again for the 429 cooldown. That is why
// they are one serial block, and it is the only ordered part of the e2e run. Nothing else in the run posts to this edge.
const EMAIL = `e2e-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}@example.com`;

test.describe.serial('the consultation form against the real API @up', () => {
  test('shows a server-only error on its field and keeps every value (400)', async ({ page, watched }) => {
    await open(page);
    await fillValid(page, EMAIL, 'abc1234');
    await page.getByRole('button', { name: SUBMIT }).click();

    // The phone format is the API's rule: the client sent it, the 400 came back, and it sits on the phone field.
    await expect(page.locator('#cf-phone-error')).toContainText('Please enter a valid phone number.');
    await expect(page.getByRole('textbox', { name: 'Phone (optional)', exact: true })).toHaveAttribute('aria-invalid', 'true');
    await expect(summary(page)).toBeFocused();
    await expect(summary(page).getByRole('link')).toHaveText(['Phone: Please enter a valid phone number.']);
    await expect(page.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue('Ada Lovelace');
    await expect(page.getByRole('textbox', { name: 'Email', exact: true })).toHaveValue(EMAIL);
    await expect(page.getByRole('textbox', { name: 'Phone (optional)', exact: true })).toHaveValue('abc1234');
    await expect(page.getByRole('combobox', { name: 'Square footage' })).toHaveValue('1,500-2,500');
    await expect(page.getByRole('checkbox', { name: 'Networking' })).toBeChecked();
    await expect(page.getByRole('button', { name: SUBMIT })).toBeEnabled();
    // The offline banner stays empty: the API did answer.
    await expect(page.locator('aj-offline-banner [role="status"]')).toHaveText('');
    expect(await watched.problems([API_URL])).toEqual([]);

    // Editing the field clears its message.
    await page.getByRole('textbox', { name: 'Phone (optional)', exact: true }).fill('5735550100');
    await expect(page.locator('#cf-phone-error')).toHaveCount(0);
  });

  test('sends a valid request and shows its eight-digit number (201)', async ({ page, browser, watched }) => {
    test.setTimeout(120_000);
    const bodies: unknown[] = [];
    page.on('request', (request) => {
      if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/lan/consultations') {
        bodies.push(request.postDataJSON());
      }
    });
    await open(page);
    await fillValid(page, EMAIL, '(573) 555-0100');
    await page.getByRole('checkbox', { name: 'Dead zones' }).check();
    await page.getByRole('button', { name: SUBMIT }).click();

    const sent = page.locator('.cf-sent');
    await expect(sent).toBeVisible();
    await expect(sent.getByRole('heading', { level: 2 })).toHaveText('Request received');
    await expect(sent.getByRole('heading', { level: 2 })).toBeFocused();
    await expect(sent.locator('strong')).toHaveText(/^\d{8}$/);
    // What the API does is what the page says: no time, and no claim that an email has arrived (email is off, issue #15).
    await expect(sent).toContainText("We'll review your request and contact you to schedule your consultation.");
    const text = await sent.innerText();
    expect(text).not.toMatch(/within|hours|inbox|confirmation|check your|emailed/i);
    await expect(page.locator('form.cform')).toHaveCount(0);

    expect(bodies).toEqual([
      {
        customer: { name: 'Ada Lovelace', email: EMAIL, phone: '(573) 555-0100' },
        property: { squareFootage: '1,500-2,500', currentIssues: ['Dead zones'] },
        interestedServices: ['networking'],
        honeypot: '',
      },
    ]);
    expect(await watched.problems()).toEqual([]);

    // The confirmation is a state the audits must pass too.
    await settled(page);
    expect(await axeViolations(page)).toEqual([]);
    expect(await contrastFailures(page, browser)).toEqual([]);
    await page.setViewportSize({ width: 390, height: 844 });
    await settled(page);
    expect(await axeViolations(page)).toEqual([]);
    expect(await contrastFailures(page, browser)).toEqual([]);
  });

  test('says to wait when the same email asks again (429 cooldown), keeps the input, and does not send twice', async ({ page, watched }) => {
    await open(page);
    await fillValid(page, EMAIL);
    await page.getByRole('button', { name: SUBMIT }).click();

    await expect(alertRegion(page)).toContainText('Please wait 10 minutes between requests.');
    await expect(page.getByRole('textbox', { name: 'Email', exact: true })).toHaveValue(EMAIL);
    await expect(page.getByRole('button', { name: SUBMIT })).toBeEnabled();
    await expect(page.locator('.cf-sent')).toBeHidden();
    expect(await watched.problems([API_URL])).toEqual([]);
  });
});

// A last look at the whole page in its real-API state: the form is reachable and the same checks of the layout hold.
test.describe('the consultation form with the API behind the edge @up', () => {
  test('opens, switches on, and leaves the offline banner empty', async ({ page, watched }) => {
    await open(page);
    await hydrated(page);
    await expect(page.locator('aj-offline-banner [role="status"]')).toHaveText('');
    expect(await watched.problems()).toEqual([]);
  });
});
