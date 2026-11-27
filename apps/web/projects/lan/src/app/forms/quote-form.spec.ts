import { provideHttpClient, withFetch } from '@angular/common/http';
import { HttpTestingController, type TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { RouterLink, provideRouter } from '@angular/router';
import { OFFLINE_COPY, SITE_KEY } from '@aj/shared';
import { LIMITS, QUOTE_OPTIONS } from '../data/options';
import { QuoteForm } from './quote-form';

// The form in a browser-like page (jsdom), with the API answered by the test. The page never calls the API by itself.
async function setup() {
  // Only the clock's timers are fake: the price is asked for 500 ms after a change, and no test waits that long in real time.
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  TestBed.configureTestingModule({
    providers: [provideHttpClient(withFetch()), provideHttpClientTesting(), provideRouter([]), { provide: SITE_KEY, useValue: 'lan' }],
  });
  const fixture = TestBed.createComponent(QuoteForm);
  document.body.appendChild(fixture.nativeElement);
  await fixture.whenStable();
  const http = TestBed.inject(HttpTestingController);
  return { fixture, http, page: new Page(fixture) };
}

class Page {
  // True while the test runs on fake timers: a turn of the event loop is then a tick of the clock.
  fake = true;

  constructor(private readonly fixture: ComponentFixture<QuoteForm>) {}

  get root(): HTMLElement {
    return this.fixture.nativeElement as HTMLElement;
  }

  $<T extends HTMLElement = HTMLElement>(selector: string): T {
    const found = this.root.querySelector<T>(selector);
    if (!found) {
      throw new Error(`no element matches ${selector}`);
    }
    return found;
  }

  has(selector: string): boolean {
    return this.root.querySelector(selector) !== null;
  }

  get submitButton(): HTMLButtonElement {
    return this.$<HTMLButtonElement>('button[type="submit"]');
  }

  // A turn of the event loop: the answer of a request reaches the component through promises.
  async settle(): Promise<void> {
    if (this.fake) {
      await vi.advanceTimersByTimeAsync(0);
    } else {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    await this.fixture.whenStable();
  }

  // Moves the fake clock, then lets the component and its promises catch up.
  async tick(ms: number): Promise<void> {
    await vi.advanceTimersByTimeAsync(ms);
    await this.fixture.whenStable();
    await this.settle();
  }

  async type(id: string, value: string): Promise<void> {
    const input = this.$<HTMLInputElement | HTMLTextAreaElement>('#' + id);
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await this.settle();
  }

  async choose(id: string, value: string): Promise<void> {
    const select = this.$<HTMLSelectElement>('#' + id);
    select.value = value;
    select.dispatchEvent(new Event('input', { bubbles: true }));
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await this.settle();
  }

  async click(id: string): Promise<void> {
    this.$<HTMLInputElement>('#' + id).click();
    await this.settle();
  }

  async submit(): Promise<void> {
    this.submitButton.click();
    await this.settle();
  }

  // The home, address, acknowledgment and contact: what both kinds need.
  async fillCommon(): Promise<void> {
    await this.choose('qf-home-age', '2000-2020');
    await this.choose('qf-stories', '2');
    await this.choose('qf-attic-access', 'Walk-in attic');
    await this.type('qf-street', '12 Main St');
    await this.type('qf-city', 'Columbia');
    await this.type('qf-state', 'mo');
    await this.type('qf-zip', '65201');
    await this.click('qf-ack');
    await this.type('qf-name', 'Ada Lovelace');
    await this.type('qf-email', 'ada@example.com');
  }

  async fillDrops(): Promise<void> {
    await this.click('qf-kind-0');
    await this.type('qf-run-cat6', '2');
    await this.fillCommon();
  }

  async fillWhole(): Promise<void> {
    await this.click('qf-kind-1');
    await this.click('qf-scope-networking');
    await this.fillCommon();
  }

  summaryLinks(): string[] {
    return Array.from(this.root.querySelectorAll('.summary a')).map((a) => a.textContent!.replace(/\s+/g, ' ').trim());
  }

  text(selector: string): string {
    return this.$(selector).textContent!.replace(/\s+/g, ' ').trim();
  }
}

const money = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

const CALCULATED = {
  lines: [{ code: 'run-cat6', description: 'Cat6 run', quantity: 2, unitPrice: 123.45, lineTotal: 246.9 }],
  subtotal: 246.9,
  total: 246.9,
  deposit: 24.69,
};
const DROPS_CREATED = { quoteNumber: '10203040', kind: 'drops-only', subtotal: 246.9, total: 246.9, deposit: 24.69 };
const WHOLE_CREATED = { quoteNumber: '50607080', kind: 'whole-home', subtotal: 0, total: 0, deposit: 321.5 };

function expectCreate(http: HttpTestingController): TestRequest {
  const req = http.expectOne('/api/lan/quotes');
  expect(req.request.method).toBe('POST');
  return req;
}

function expectCalculate(http: HttpTestingController): TestRequest {
  const req = http.expectOne('/api/lan/quotes/calculate');
  expect(req.request.method).toBe('POST');
  return req;
}

function ok(req: TestRequest, body: object): void {
  req.flush(body, { status: req.request.url.endsWith('calculate') ? 200 : 201, statusText: 'x' });
}

function problem(req: TestRequest, status: number, body: object, headers: Record<string, string> = {}): void {
  req.flush(body, { status, statusText: 'x', headers: { 'content-type': 'application/problem+json', ...headers } });
}

describe('QuoteForm', () => {
  afterEach(() => {
    vi.useRealTimers();
    TestBed.inject(HttpTestingController).verify();
    document.body.replaceChildren();
  });

  it('has every option of the contract, from contracts/lan-options.json and nowhere else', async () => {
    const { page } = await setup();
    await page.click('qf-kind-0');
    const texts = (selector: string) => Array.from(page.root.querySelectorAll(selector)).map((e) => e.textContent!.trim());
    const labels = (options: readonly { label: string }[]) => options.map((o) => o.label);
    expect(texts('input[id^="qf-kind-"] + span .qf-kind-name')).toEqual(labels(QUOTE_OPTIONS.kinds));
    expect(texts('input[id^="qf-central-"] + span').slice(1)).toEqual(labels(QUOTE_OPTIONS.centralization));
    expect(texts('#qf-home-age option').slice(1)).toEqual(labels(QUOTE_OPTIONS.homeAge));
    expect(texts('#qf-attic-access option').slice(1)).toEqual(labels(QUOTE_OPTIONS.atticAccess));
    expect(texts('#qf-stories option').slice(1)).toEqual(['1', '2', '3', '4']);
    await page.click('qf-kind-1');
    expect(texts('#qf-networking-brand option').slice(1)).toEqual(labels(QUOTE_OPTIONS.networkingBrand));
    expect(texts('#qf-security-brand option').slice(1)).toEqual(labels(QUOTE_OPTIONS.securityBrand));
    expect(texts('#qf-survey-preference option').slice(1)).toEqual(labels(QUOTE_OPTIONS.surveyPreference));
  });

  it('is switched on once the app runs, and makes no request by itself', async () => {
    const { page, http } = await setup();
    expect(page.submitButton.disabled).toBe(false);
    expect(page.has('.cf-wait')).toBe(false);
    http.expectNone(() => true);
  });

  it('shows neither kind-specific section before a kind is chosen', async () => {
    const { page } = await setup();
    expect(page.has('#qf-run-cat6')).toBe(false);
    expect(page.has('#qf-scope-networking')).toBe(false);
  });

  it('puts every checkbox and radio on the same line as its label', async () => {
    const { page } = await setup();
    await page.click('qf-kind-1');
    await page.click('qf-own-equipment');
    await page.click('qf-has-panel');
    const inputs = Array.from(page.root.querySelectorAll<HTMLInputElement>('input[type="checkbox"], input[type="radio"]'));
    expect(inputs.length).toBeGreaterThan(8);
    for (const input of inputs) {
      const label = input.closest('label');
      expect(label, input.id).not.toBeNull();
      expect(label!.querySelectorAll('input').length).toBe(1);
      expect(label!.querySelector('span')!.textContent!.trim().length).toBeGreaterThan(0);
    }
  });

  it('keeps the trap field out of the tab order and the accessibility tree', async () => {
    const { page } = await setup();
    expect(page.$('.cf-trap').getAttribute('aria-hidden')).toBe('true');
    const input = page.$<HTMLInputElement>('input[name="honeypot"]');
    expect(input.tabIndex).toBe(-1);
    expect(input.getAttribute('autocomplete')).toBe('off');
  });

  it('gives the number inputs and texts their limits from the contract', async () => {
    const { page } = await setup();
    await page.click('qf-kind-1');
    expect(page.$('#qf-notes').getAttribute('maxlength')).toBe(String(LIMITS.wholeHomeTextLength));
    expect(page.$('#qf-internet-speed').getAttribute('maxlength')).toBe('200');
    expect(page.$('#qf-street').getAttribute('maxlength')).toBe('200');
    expect(page.$('#qf-city').getAttribute('maxlength')).toBe('100');
    await page.click('qf-kind-0');
    expect(page.$('#qf-run-cat6').getAttribute('inputmode')).toBe('numeric');
  });

  describe('client checks', () => {
    it('lists the missing kind, home, address, acknowledgment and contact fields, focuses the summary and sends nothing', async () => {
      const { page, http } = await setup();
      await page.submit();
      expect(page.summaryLinks()).toEqual([
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
      ]);
      expect(document.activeElement).toBe(page.$('.summary'));
      expect(page.$('#qf-street').getAttribute('aria-invalid')).toBe('true');
      expect(page.text('#qf-street-error')).toBe('Error: Enter the street address.');
      http.expectNone(() => true);
    });

    it('asks for at least one run or service when a drops-only quote has every count at 0', async () => {
      const { page, http } = await setup();
      await page.click('qf-kind-0');
      await page.fillCommon();
      await page.submit();
      expect(page.summaryLinks()).toEqual(['Cable runs and services: Enter at least one cable run or service.']);
      http.expectNone(() => true);
      await page.type('qf-ap-mounts', '1');
      await page.submit();
      problem(expectCreate(http), 500, { title: 'x' });
      await page.settle();
    });

    it('asks for at least one scope when a whole-home quote has none', async () => {
      const { page, http } = await setup();
      await page.click('qf-kind-1');
      await page.fillCommon();
      await page.submit();
      expect(page.summaryLinks()).toEqual(['Scope: Choose at least one scope.']);
      http.expectNone(() => true);
    });

    it('takes 0 to 50 of a run and 0 to 20 of a service, and says so on the field for more', async () => {
      const { page, http } = await setup();
      await page.fillDrops();
      await page.type('qf-run-cat6', '51');
      await page.type('qf-ap-mounts', '21');
      await page.type('qf-ethernet-relocations', 'x');
      await page.submit();
      expect(page.summaryLinks()).toEqual([
        'Cat6 runs: Enter a whole number from 0 to 50.',
        'AP mounts: Enter a whole number from 0 to 20.',
        'Ethernet relocations: Enter a whole number from 0 to 20.',
      ]);
      http.expectNone(() => true);
      await page.type('qf-run-cat6', '50');
      await page.type('qf-ap-mounts', '20');
      await page.type('qf-ethernet-relocations', '');
      await page.submit();
      const sent = expectCreate(http);
      expect(sent.request.body.runs.cat6).toBe(50);
      expect(sent.request.body.services).toEqual({ apMounts: 20, ethernetRelocations: 0 });
      problem(sent, 500, { title: 'x' });
      await page.settle();
    });

    it('checks only the chosen kind: a whole-home field left empty does not stop a drops-only quote', async () => {
      const { page, http } = await setup();
      await page.click('qf-kind-1');
      await page.click('qf-scope-security');
      await page.click('qf-kind-0');
      await page.fillDrops();
      await page.submit();
      const req = expectCreate(http);
      expect(req.request.body.wholeHome).toBeUndefined();
      ok(req, DROPS_CREATED);
      await page.settle();
    });

    it('treats a name of only spaces as missing, and checks only the shape of an email', async () => {
      const { page, http } = await setup();
      await page.fillDrops();
      await page.type('qf-name', '   ');
      await page.type('qf-email', 'nope');
      await page.submit();
      expect(page.summaryLinks()).toEqual(['Name: Enter your name.', 'Email: Enter a valid email address.']);
      http.expectNone(() => true);
    });
  });

  describe('a valid drops-only quote', () => {
    it('posts only the drops-only section: trimmed, optional fields left out, the trap field empty', async () => {
      const { page, http } = await setup();
      await page.fillDrops();
      await page.type('qf-name', '  Ada Lovelace ');
      await page.submit();
      const req = expectCreate(http);
      expect(req.request.headers.get('Content-Type')).toBe('application/json');
      expect(JSON.parse(JSON.stringify(req.request.body))).toEqual({
        customer: { name: 'Ada Lovelace', email: 'ada@example.com' },
        kind: 'drops-only',
        honeypot: '',
        runs: { cat6: 2, cat6a: 0, coax: 0, fiber: 0 },
        services: { apMounts: 0, ethernetRelocations: 0 },
        homeInfo: {
          liabilityAcknowledged: true,
          homeAge: '2000-2020',
          stories: 2,
          atticAccess: 'Walk-in attic',
          hasMediaPanel: false,
          hasCrawlspaceOrBasement: false,
          address: { street: '12 Main St', city: 'Columbia', state: 'mo', zip: '65201' },
        },
      });
      ok(req, DROPS_CREATED);
      await page.settle();
    });

    it('sends the optional fields when they are filled, and the location only while the panel box is ticked', async () => {
      const { page, http } = await setup();
      await page.fillDrops();
      await page.type('qf-phone', '(573) 555-0100');
      await page.click('qf-central-1');
      await page.click('qf-has-panel');
      await page.type('qf-panel-location', 'Garage');
      await page.click('qf-crawlspace');
      await page.submit();
      const req = expectCreate(http);
      expect(req.request.body.customer.phone).toBe('(573) 555-0100');
      expect(req.request.body.centralization).toBe('patch-panel');
      expect(req.request.body.homeInfo).toMatchObject({ hasMediaPanel: true, mediaPanelLocation: 'Garage', hasCrawlspaceOrBasement: true });
      problem(req, 500, { title: 'x' });
      await page.settle();
      await page.click('qf-has-panel');
      await page.submit();
      const again = expectCreate(http);
      expect(again.request.body.homeInfo.mediaPanelLocation).toBeUndefined();
      expect(again.request.body.homeInfo.hasMediaPanel).toBe(false);
      problem(again, 500, { title: 'x' });
      await page.settle();
    });

    it('sends what a bot typed into the trap field', async () => {
      const { page, http } = await setup();
      await page.fillDrops();
      page.$<HTMLInputElement>('#qf-honeypot').value = 'http://spam.example';
      await page.submit();
      const req = expectCreate(http);
      expect(req.request.body.honeypot).toBe('http://spam.example');
      problem(req, 400, { title: 'Invalid', errors: { honeypot: ['Bot detection triggered.'] } });
      await page.settle();
      expect(page.root.textContent).not.toMatch(/honeypot|Bot detection/i);
      expect(page.text('.summary')).toContain('Part of your request could not be accepted');
    });

    it('shows the number large, the total and the deposit as returned, no email promise, a link to book, and focuses the heading', async () => {
      const { page, http } = await setup();
      await page.fillDrops();
      await page.submit();
      expect(page.text('.sending')).toBe('Sending…');
      expect(page.submitButton.disabled).toBe(true);
      ok(expectCreate(http), DROPS_CREATED);
      await page.settle();
      expect(page.has('form')).toBe(false);
      const sent = page.text('.cf-sent');
      expect(sent).toContain('Quote created');
      expect(sent).toContain('10203040');
      expect(sent).toContain(money(246.9));
      expect(sent).toContain(money(24.69));
      expect(sent).toMatch(/needed to book|need it to book|to book an appointment/i);
      expect(sent).toMatch(/no copy of this quote is emailed|not emailed/i);
      expect(sent).not.toMatch(/within|hours|inbox|confirmation|check your/i);
      expect(page.$('.cf-sent a.btn').getAttribute('href')).toBe('/book?quote=10203040');
      expect(page.$('.cf-sent a.btn').getAttribute('href')).not.toContain('example.com');
      expect(document.activeElement).toBe(page.$('.cf-sent h2'));
    });

    it('builds the confirmation from what was sent, not from the form as it is edited while the request is out', async () => {
      const { page, http, fixture } = await setup();
      await page.fillWhole();
      await page.submit();
      const req = expectCreate(http);
      await page.click('qf-kind-0');
      await page.type('qf-email', 'someone-else@example.com');
      ok(req, WHOLE_CREATED);
      await page.settle();
      const sent = page.text('.cf-sent');
      expect(sent).toContain('50607080');
      expect(sent).toContain(money(321.5));
      expect(sent).not.toContain(money(0));
      const link = fixture.debugElement.query(By.directive(RouterLink)).injector.get(RouterLink);
      expect(link.state).toEqual({ email: 'ada@example.com' });
    });

    it('leaves the deposit line out when the deposit is 0, and never shows a total it was not sent', async () => {
      const { page, http } = await setup();
      await page.fillDrops();
      await page.submit();
      ok(expectCreate(http), { ...DROPS_CREATED, deposit: 0 });
      await page.settle();
      expect(page.text('.cf-sent')).toContain(money(246.9));
      expect(page.text('.cf-sent')).not.toMatch(/deposit/i);
    });

    for (const body of [{}, { quoteNumber: '<b>1</b>' }, { quoteNumber: 10203040 }, null]) {
      it(`shows the page without a number, a total or a link when the answer is ${JSON.stringify(body)}`, async () => {
        const { page, http } = await setup();
        await page.fillDrops();
        await page.submit();
        ok(expectCreate(http), body as object);
        await page.settle();
        expect(page.text('.cf-sent')).toContain('Your quote was created');
        expect(page.has('.cf-sent strong')).toBe(false);
        expect(page.has('.cf-sent a[href^="/book"]')).toBe(false);
        expect(page.text('.cf-sent')).not.toContain('$');
      });
    }

    it('sends once for a double click, and never lets the browser submit the form itself', async () => {
      const { page, http } = await setup();
      await page.fillDrops();
      page.submitButton.click();
      page.submitButton.click();
      const event = new Event('submit', { cancelable: true, bubbles: true });
      page.$('form').dispatchEvent(event);
      await page.settle();
      expect(event.defaultPrevented).toBe(true);
      expect(page.$('form').getAttribute('method')).toBe('post');
      ok(expectCreate(http), DROPS_CREATED);
      await page.settle();
    });
  });

  describe('a valid whole-home quote', () => {
    it('posts only the whole-home section, with a detail only for a ticked scope', async () => {
      const { page, http } = await setup();
      await page.fillWhole();
      await page.click('qf-scope-voip');
      await page.type('qf-networking-details', 'Mesh for three floors');
      await page.type('qf-voip-details', ' Four lines ');
      await page.type('qf-notes', '  Dogs  ');
      await page.type('qf-internet-speed', '1 Gbps');
      await page.choose('qf-networking-brand', 'UniFi');
      await page.choose('qf-security-brand', 'Reolink');
      await page.choose('qf-survey-preference', 'day-of');
      await page.submit();
      const req = expectCreate(http);
      expect(JSON.parse(JSON.stringify(req.request.body))).toEqual({
        customer: { name: 'Ada Lovelace', email: 'ada@example.com' },
        kind: 'whole-home',
        honeypot: '',
        homeInfo: {
          liabilityAcknowledged: true,
          homeAge: '2000-2020',
          stories: 2,
          atticAccess: 'Walk-in attic',
          hasMediaPanel: false,
          hasCrawlspaceOrBasement: false,
          address: { street: '12 Main St', city: 'Columbia', state: 'mo', zip: '65201' },
        },
        wholeHome: {
          scope: { networking: true, security: false, voip: true },
          internetSpeed: '1 Gbps',
          hasOwnEquipment: false,
          networkingBrand: 'UniFi',
          securityBrand: 'Reolink',
          surveyPreference: 'day-of',
          networkingDetails: 'Mesh for three floors',
          voipDetails: 'Four lines',
          notes: 'Dogs',
        },
      });
      expect(req.request.body.runs).toBeUndefined();
      expect(req.request.body.services).toBeUndefined();
      expect(req.request.body.centralization).toBeUndefined();
      ok(req, WHOLE_CREATED);
      await page.settle();
    });

    it('hides the detail of an unticked scope, and does not send what was typed there', async () => {
      const { page, http } = await setup();
      await page.fillWhole();
      expect(page.has('#qf-security-details')).toBe(false);
      await page.click('qf-scope-security');
      await page.type('qf-security-details', 'Four cameras');
      await page.click('qf-scope-security');
      expect(page.has('#qf-security-details')).toBe(false);
      await page.submit();
      const req = expectCreate(http);
      expect(req.request.body.wholeHome.securityDetails).toBeUndefined();
      expect(req.request.body.wholeHome.scope.security).toBe(false);
      problem(req, 500, { title: 'x' });
      await page.settle();
    });

    it('swaps the brands for the equipment description when the visitor has their own equipment, and back', async () => {
      const { page, http } = await setup();
      await page.fillWhole();
      await page.choose('qf-networking-brand', 'Omada');
      expect(page.has('#qf-networking-brand')).toBe(true);
      expect(page.has('#qf-equipment-description')).toBe(false);
      await page.click('qf-own-equipment');
      expect(page.has('#qf-networking-brand')).toBe(false);
      expect(page.has('#qf-security-brand')).toBe(false);
      await page.type('qf-equipment-description', 'UniFi gateway and switch');
      await page.submit();
      const own = expectCreate(http);
      expect(own.request.body.wholeHome).toMatchObject({ hasOwnEquipment: true, equipmentDescription: 'UniFi gateway and switch' });
      expect(own.request.body.wholeHome.networkingBrand).toBeUndefined();
      expect(own.request.body.wholeHome.securityBrand).toBeUndefined();
      problem(own, 500, { title: 'x' });
      await page.settle();

      await page.click('qf-own-equipment');
      expect(page.has('#qf-equipment-description')).toBe(false);
      await page.submit();
      const back = expectCreate(http);
      expect(back.request.body.wholeHome.hasOwnEquipment).toBe(false);
      expect(back.request.body.wholeHome.equipmentDescription).toBeUndefined();
      problem(back, 500, { title: 'x' });
      await page.settle();
    });

    it('says the price follows the survey and that a deposit is due, without an amount, and calls no price endpoint', async () => {
      const { page, http } = await setup();
      await page.click('qf-kind-1');
      expect(page.text('.qf-whole-note')).toMatch(/after a site survey/i);
      expect(page.text('.qf-whole-note')).toMatch(/deposit is due/i);
      expect(page.text('.qf-whole-note')).not.toMatch(/\$\d/);
      expect(page.has('.qf-price')).toBe(false);
      http.expectNone(() => true);
    });

    it('shows only the deposit, never the 0 total, and says the price follows the survey', async () => {
      const { page, http } = await setup();
      await page.fillWhole();
      await page.submit();
      ok(expectCreate(http), WHOLE_CREATED);
      await page.settle();
      const sent = page.text('.cf-sent');
      expect(sent).toContain('50607080');
      expect(sent).toContain(money(321.5));
      expect(sent).toMatch(/after (the|a) site survey/i);
      expect(sent).not.toContain('$0');
      expect(sent).not.toMatch(/total/i);
      expect(page.$('.cf-sent a.btn').getAttribute('href')).toBe('/book?quote=50607080');
    });
  });

  describe('the live price', () => {
    async function dropsSetup() {
      const made = await setup();
      await made.page.click('qf-kind-0');
      return made;
    }

    it('calls nothing while every count is 0, and says what to do', async () => {
      const { page, http } = await dropsSetup();
      await page.tick(2000);
      http.expectNone(() => true);
      expect(page.text('.qf-price')).toContain('Enter a number of cable runs or services to see the price.');
      await page.type('qf-run-cat6', '0');
      await page.tick(2000);
      http.expectNone(() => true);
    });

    it('calls calculate once, 500 ms after the last change, with only the counts, the centralization and the panel flag', async () => {
      const { page, http } = await dropsSetup();
      await page.type('qf-run-cat6', '2');
      await page.tick(400);
      await page.type('qf-run-cat6', '20');
      await page.tick(400);
      http.expectNone(() => true);
      await page.tick(100);
      const req = expectCalculate(http);
      expect(req.request.body).toEqual({
        runs: { cat6: 20, cat6a: 0, coax: 0, fiber: 0 },
        services: { apMounts: 0, ethernetRelocations: 0 },
        hasExistingPanel: false,
      });
      req.flush({ ...CALCULATED }, { status: 200, statusText: 'OK' });
      await page.settle();
    });

    it('lists the lines, subtotal, total and deposit exactly as the API returned them', async () => {
      const { page, http } = await dropsSetup();
      await page.type('qf-run-cat6', '2');
      await page.click('qf-central-0');
      await page.tick(500);
      const req = expectCalculate(http);
      expect(req.request.body.centralization).toBe('media-panel');
      ok(req, CALCULATED);
      await page.settle();
      const panel = page.text('.qf-price');
      expect(panel).toContain('Cat6 run');
      expect(panel).toContain(`2 × ${money(123.45)}`);
      expect(panel).toContain(money(246.9));
      expect(page.text('.qf-sum [data-row="deposit"] dd')).toBe(money(24.69));
      expect(page.text('.qf-sum [data-row="total"] dd')).toBe(money(246.9));
      expect(page.has('.qf-sum [data-row="subtotal"]')).toBe(false);
      expect(page.text('.qf-price-announce')).toBe(`Total ${money(246.9)}, deposit ${money(24.69)}.`);
    });

    it('sends hasExistingPanel from the media panel box', async () => {
      const { page, http } = await dropsSetup();
      await page.type('qf-run-cat6', '1');
      await page.click('qf-has-panel');
      await page.tick(500);
      const req = expectCalculate(http);
      expect(req.request.body.hasExistingPanel).toBe(true);
      ok(req, CALCULATED);
      await page.settle();
    });

    it('drops an answer that arrives after the counts changed again, and shows only the newest', async () => {
      const { page, http } = await dropsSetup();
      await page.type('qf-run-cat6', '1');
      await page.tick(500);
      const first = expectCalculate(http);
      await page.type('qf-run-cat6', '3');
      await page.tick(500);
      const second = expectCalculate(http);
      ok(second, { ...CALCULATED, lines: [{ ...CALCULATED.lines[0], quantity: 3, lineTotal: 370.35 }], subtotal: 370.35, total: 370.35, deposit: 37.04 });
      await page.settle();
      ok(first, { ...CALCULATED, total: 111, subtotal: 111, deposit: 11 });
      await page.settle();
      expect(page.text('.qf-price')).toContain(money(370.35));
      expect(page.text('.qf-price')).not.toContain(money(111));
    });

    it('does not show an older price as current once the counts changed: it says the price is updating', async () => {
      const { page, http } = await dropsSetup();
      await page.type('qf-run-cat6', '2');
      await page.tick(500);
      ok(expectCalculate(http), CALCULATED);
      await page.settle();
      expect(page.text('.qf-price')).toContain(money(246.9));
      await page.type('qf-run-cat6', '5');
      expect(page.text('.qf-price')).not.toContain(money(246.9));
      expect(page.text('.qf-price')).toContain('Updating the price');
      expect(page.text('.qf-price-announce')).toBe('');
      await page.tick(500);
      ok(expectCalculate(http), { ...CALCULATED, total: 600, subtotal: 600, deposit: 60 });
      await page.settle();
      expect(page.text('.qf-price')).toContain(money(600));
    });

    it('asks nothing again when the counts return to the ones already priced', async () => {
      const { page, http } = await dropsSetup();
      await page.type('qf-run-cat6', '2');
      await page.tick(500);
      ok(expectCalculate(http), CALCULATED);
      await page.settle();
      await page.type('qf-run-cat6', '3');
      await page.tick(200);
      await page.type('qf-run-cat6', '2');
      await page.tick(2000);
      http.expectNone(() => true);
      expect(page.text('.qf-price')).toContain(money(246.9));
    });

    it('drops the answer of a request that was out when the counts returned to the ones already priced', async () => {
      const { page, http } = await dropsSetup();
      await page.type('qf-run-cat6', '2');
      await page.tick(500);
      ok(expectCalculate(http), CALCULATED);
      await page.settle();
      await page.type('qf-run-cat6', '3');
      await page.tick(500);
      const pending = expectCalculate(http);
      await page.type('qf-run-cat6', '2');
      await page.tick(2000);
      http.expectNone(() => true);
      ok(pending, { ...CALCULATED, total: 600, subtotal: 600, deposit: 60 });
      await page.settle();
      // The panel stays on the counts that are on the page, with the answer that is theirs.
      expect(page.text('.qf-price')).toContain(money(246.9));
      expect(page.text('.qf-price')).not.toContain(money(600));
      expect(page.text('.qf-price')).not.toContain('Updating the price');
    });

    it('drops the answer of a request that was out when every count went back to 0', async () => {
      const { page, http } = await dropsSetup();
      await page.type('qf-run-cat6', '2');
      await page.tick(500);
      const pending = expectCalculate(http);
      await page.type('qf-run-cat6', '0');
      await page.tick(2000);
      ok(pending, CALCULATED);
      await page.settle();
      await page.type('qf-run-cat6', '2');
      await page.tick(500);
      // Nothing was kept from the dropped answer for the body that came back: it is asked for again.
      ok(expectCalculate(http), { ...CALCULATED, total: 999, subtotal: 999, deposit: 99 });
      await page.settle();
      expect(page.text('.qf-price')).toContain(money(999));
    });

    it('says the price cannot be shown, never $0, for an offline answer, and offers to try again', async () => {
      const { page, http } = await dropsSetup();
      await page.type('qf-run-cat6', '2');
      await page.tick(500);
      problem(expectCalculate(http), 503, { title: 'Service unavailable' }, { 'retry-after': '30' });
      await page.settle();
      expect(page.text('.qf-price')).toContain("The price can't be shown right now.");
      expect(page.text('.qf-price')).not.toContain('$');
      expect(page.text('.qf-price-announce')).toContain("The price can't be shown right now.");
      page.$('.qf-price-retry').click();
      await page.settle();
      ok(expectCalculate(http), CALCULATED);
      await page.settle();
      expect(page.text('.qf-price')).toContain(money(246.9));
      expect(page.has('.qf-price-retry')).toBe(false);
    });

    for (const [name, answer] of [
      ['a 400', { status: 400, body: { title: 'Invalid', errors: { runs: ['x'] } } }],
      ['a 429', { status: 429, body: { title: 'Too many' } }],
      ['a 500', { status: 500, body: { title: 'Boom' } }],
      ['an answer with no lines', { status: 200, body: { subtotal: 1, total: 1, deposit: 0 } }],
      ['an answer with a text for a total', { status: 200, body: { lines: [], subtotal: '1', total: '1', deposit: 0 } }],
    ] as const) {
      it(`says the price cannot be shown for ${name}`, async () => {
        const { page, http } = await dropsSetup();
        await page.type('qf-run-cat6', '2');
        await page.tick(500);
        const req = expectCalculate(http);
        req.flush(answer.body, { status: answer.status, statusText: 'x', headers: { 'content-type': 'application/problem+json' } });
        await page.settle();
        expect(page.text('.qf-price')).toContain("The price can't be shown right now.");
        expect(page.text('.qf-price')).not.toContain('$');
      });
    }

    it('leaves the price panel when the kind changes to whole-home, and asks nothing for it', async () => {
      const { page, http } = await dropsSetup();
      await page.type('qf-run-cat6', '2');
      await page.click('qf-kind-1');
      await page.tick(2000);
      http.expectNone(() => true);
      expect(page.has('.qf-price')).toBe(false);
    });
  });

  describe('when the API says no', () => {
    it('marks the fields of a 400 by their JSON path, keeps every value, and clears a field when it is edited', async () => {
      const { page, http } = await setup();
      await page.fillDrops();
      await page.type('qf-zip', '6520');
      await page.submit();
      problem(expectCreate(http), 400, {
        title: 'Invalid',
        errors: { 'homeInfo.address.zip': ['ZIP code must be in the format 12345 or 12345-6789.'], 'customer.phone': ['Please enter a valid phone number.'], runs: ['At least one cable run or service must be selected.'] },
      });
      await page.settle();
      expect(page.text('#qf-zip-error')).toBe('Error: ZIP code must be in the format 12345 or 12345-6789.');
      expect(page.text('#qf-phone-error')).toBe('Error: Please enter a valid phone number.');
      expect(page.text('#qf-runs-error')).toContain('At least one cable run or service must be selected.');
      expect(page.summaryLinks()).toEqual([
        'Cable runs and services: At least one cable run or service must be selected.',
        'ZIP code: ZIP code must be in the format 12345 or 12345-6789.',
        'Phone: Please enter a valid phone number.',
      ]);
      expect(document.activeElement).toBe(page.$('.summary'));
      expect(page.$<HTMLInputElement>('#qf-zip').value).toBe('6520');
      expect(page.$<HTMLInputElement>('#qf-run-cat6').value).toBe('2');
      expect(page.$<HTMLInputElement>('#qf-ack').checked).toBe(true);
      expect(page.submitButton.disabled).toBe(false);
      await page.type('qf-zip', '65201');
      expect(page.has('#qf-zip-error')).toBe(false);
    });

    it('puts the scope error of a whole-home 400 on the scope', async () => {
      const { page, http } = await setup();
      await page.fillWhole();
      await page.submit();
      problem(expectCreate(http), 400, { title: 'Invalid', errors: { 'wholeHome.scope': ['Select at least one scope (networking, security or VoIP).'] } });
      await page.settle();
      expect(page.summaryLinks()).toEqual(['Scope: Select at least one scope (networking, security or VoIP).']);
    });

    it('shows the 429 cooldown sentence as it is, and lets the visitor try again with every value kept', async () => {
      const { page, http } = await setup();
      await page.fillDrops();
      await page.submit();
      problem(expectCreate(http), 429, { title: 'Too Many Requests', detail: 'Please wait 10 minutes between requests.' });
      await page.settle();
      expect(page.text('[role="alert"]')).toContain('Please wait 10 minutes between requests.');
      expect(page.text('[role="alert"]')).not.toContain('try again in');
      expect(page.submitButton.disabled).toBe(false);
      expect(page.$<HTMLInputElement>('#qf-email').value).toBe('ada@example.com');
    });

    it('shows the limiter\'s wait in minutes', async () => {
      const { page, http } = await setup();
      await page.fillDrops();
      await page.submit();
      problem(expectCreate(http), 429, { title: 'Too Many Requests', detail: 'Too many quote requests.' }, { 'retry-after': '900' });
      await page.settle();
      expect(page.text('[role="alert"]')).toContain('try again in 15 minutes');
    });

    for (const answer of ['503 with a wait', 'network'] as const) {
      it(`says offline for ${answer === 'network' ? 'no answer' : 'the edge\'s 503'}, and keeps the input`, async () => {
        const { page, http } = await setup();
        await page.fillDrops();
        await page.submit();
        const req = expectCreate(http);
        if (answer === 'network') {
          req.error(new ProgressEvent('error'));
        } else {
          problem(req, 503, { title: 'Service unavailable', detail: 'The service is offline right now.' }, { 'retry-after': '30' });
        }
        await page.settle();
        expect(page.text('[role="alert"]')).toContain(OFFLINE_COPY);
        expect(page.$<HTMLInputElement>('#qf-email').value).toBe('ada@example.com');
        expect(page.submitButton.disabled).toBe(false);
      });
    }

    it('shows the API\'s own 503 (no wait) as a failure with its sentence, not as offline', async () => {
      const { page, http } = await setup();
      await page.fillDrops();
      await page.submit();
      problem(expectCreate(http), 503, { title: 'Service Unavailable', detail: "Pricing isn't available right now. Please try again later." });
      await page.settle();
      const alert = page.text('[role="alert"]');
      expect(alert).toContain("Pricing isn't available right now. Please try again later.");
      expect(alert).not.toContain(OFFLINE_COPY);
    });

    for (const status of [413, 415, 500]) {
      it(`takes a ${status} as a generic failure with the contact line, never showing the server text`, async () => {
        const { page, http } = await setup();
        await page.fillDrops();
        await page.submit();
        problem(expectCreate(http), status, { title: 'Stack trace here', detail: 'secret detail' });
        await page.settle();
        const alert = page.text('[role="alert"]');
        expect(alert).toContain('Your request could not be sent');
        expect(alert).toContain('jackson@actionjacksoninstalls.com');
        expect(alert).not.toMatch(/Stack trace|secret detail/);
      });
    }

    it('takes a 400 without usable errors as a generic failure', async () => {
      const { page, http } = await setup();
      await page.fillDrops();
      await page.submit();
      problem(expectCreate(http), 400, { title: 'Bad Request' });
      await page.settle();
      expect(page.text('[role="alert"]')).toContain('Your request could not be sent');
    });
  });
});
