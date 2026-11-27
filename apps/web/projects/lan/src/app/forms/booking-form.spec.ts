import { provideHttpClient, withFetch } from '@angular/common/http';
import { HttpTestingController, type TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { OFFLINE_COPY, SITE_KEY } from '@aj/shared';
import { BOOKING_OPTIONS, LIMITS } from '../data/options';
import { BookingForm } from './booking-form';

// 23:30 on Friday 2026-11-27 in Chicago, when it is already the 28th in UTC: the window must start on the 27th.
const NOW = new Date('2026-11-28T05:30:00Z');
const TODAY = '2026-11-27';

interface SetupOptions {
  quote?: string;
  email?: string;
}

// The form in a browser-like page (jsdom), with the API answered by the test. The clock is fake, so the day is fixed.
async function setup(options: SetupOptions = {}) {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  vi.setSystemTime(NOW);
  history.replaceState(options.email ? { email: options.email } : null, '');
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withFetch()),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: SITE_KEY, useValue: 'lan' },
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(options.quote === undefined ? {} : { quote: options.quote }) } } },
    ],
  });
  const fixture = TestBed.createComponent(BookingForm);
  document.body.appendChild(fixture.nativeElement);
  await fixture.whenStable();
  const http = TestBed.inject(HttpTestingController);
  const page = new Page(fixture);
  await page.settle();
  return { fixture, http, page };
}

class Page {
  constructor(private readonly fixture: ComponentFixture<BookingForm>) {}

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

  async settle(): Promise<void> {
    await vi.advanceTimersByTimeAsync(0);
    await this.fixture.whenStable();
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

  async click(selector: string): Promise<void> {
    this.$<HTMLElement>(selector).click();
    await this.settle();
  }

  async submit(): Promise<void> {
    this.submitButton.click();
    await this.settle();
  }

  async kind(index: number): Promise<void> {
    await this.click('#bf-kind-' + index);
  }

  async day(date: string): Promise<void> {
    await this.click('#bf-day-' + date);
  }

  async time(value: string): Promise<void> {
    await this.click(`input[type="radio"][value="${value}"]`);
  }

  text(selector: string): string {
    return this.$(selector).textContent!.replace(/\s+/g, ' ').trim();
  }

  summaryLinks(): string[] {
    return Array.from(this.root.querySelectorAll('.summary a')).map((a) => a.textContent!.replace(/\s+/g, ' ').trim());
  }

  dayLabels(): string[] {
    return Array.from(this.root.querySelectorAll('button.bf-day')).map((b) => b.textContent!.trim());
  }

  timeLabels(): string[] {
    return Array.from(this.root.querySelectorAll('.bf-times label')).map((l) => l.textContent!.trim());
  }
}

const OPEN = [
  { date: '2026-11-27', starts: [] },
  { date: '2026-11-30', starts: ['08:00', '09:00', '10:00'] },
  { date: '2026-12-01', starts: ['08:00'] },
];

const BOOKED = { reference: '12345678', kind: 'survey', startsAt: '2026-11-30T09:00:00-06:00', endsAt: '2026-11-30T11:00:00-06:00' };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function expectAvailability(http: HttpTestingController): TestRequest {
  const req = http.expectOne((r) => r.url === '/api/lan/availability');
  expect(req.request.method).toBe('GET');
  return req;
}

function answer(req: TestRequest, days: readonly { date: string; starts: readonly string[] }[] = OPEN): void {
  req.flush({ timeZone: 'America/Chicago', days }, { status: 200, statusText: 'OK' });
}

function expectBook(http: HttpTestingController): TestRequest {
  const req = http.expectOne('/api/lan/appointments');
  expect(req.request.method).toBe('POST');
  return req;
}

function problem(req: TestRequest, status: number, body: object, headers: Record<string, string> = {}): void {
  req.flush(body, { status, statusText: 'x', headers: { 'content-type': 'application/problem+json', ...headers } });
}

// A valid request for a survey: the quote and the email, a kind, the first day, its first time.
async function fillSurvey(page: Page, http: HttpTestingController): Promise<void> {
  await page.type('bf-quote-number', '12345678');
  await page.type('bf-email', 'ada@example.com');
  await page.kind(0);
  answer(expectAvailability(http));
  await page.settle();
  await page.day('2026-11-30');
  await page.time('09:00');
}

describe('BookingForm', () => {
  afterEach(() => {
    vi.useRealTimers();
    TestBed.inject(HttpTestingController).verify();
    document.body.replaceChildren();
    history.replaceState(null, '');
  });

  it('has the booking kinds of the contract, and a length of whole hours from 1 to 12 with 2 chosen', async () => {
    const { page, http } = await setup();
    const labels = Array.from(page.root.querySelectorAll('input[id^="bf-kind-"] + span .qf-kind-name')).map((e) => e.textContent!.trim());
    expect(labels).toEqual(BOOKING_OPTIONS.kinds.map((k) => k.label));
    await page.kind(1);
    answer(expectAvailability(http));
    await page.settle();
    const hours = page.$<HTMLSelectElement>('#bf-hours');
    const options = Array.from(hours.options).map((o) => o.value);
    expect(options).toEqual(Array.from({ length: LIMITS.booking.durationMinutes.max / 60 }, (_, i) => String(i + 1)));
    expect(hours.value).toBe('2');
  });

  it('puts every radio on the same line as its label', async () => {
    const { page, http } = await setup();
    await page.kind(0);
    answer(expectAvailability(http));
    await page.settle();
    await page.day('2026-11-30');
    const inputs = Array.from(page.root.querySelectorAll<HTMLInputElement>('input[type="radio"]'));
    expect(inputs.length).toBe(BOOKING_OPTIONS.kinds.length + 3);
    for (const input of inputs) {
      const label = input.closest('label');
      expect(label, input.id).not.toBeNull();
      expect(label!.querySelectorAll('input').length).toBe(1);
    }
  });

  it('is switched on once the app runs, makes no request by itself, and keeps the trap field out of reach', async () => {
    const { page, http } = await setup();
    expect(page.submitButton.disabled).toBe(false);
    expect(page.has('.cf-wait')).toBe(false);
    http.expectNone(() => true);
    expect(page.$('.cf-trap').getAttribute('aria-hidden')).toBe('true');
    expect(page.$<HTMLInputElement>('#bf-honeypot').tabIndex).toBe(-1);
    expect(page.$('#bf-notes').getAttribute('maxlength')).toBe(String(LIMITS.booking.notesLength));
    expect(page.$('#bf-quote-number').getAttribute('inputmode')).toBe('numeric');
  });

  describe('prefill', () => {
    it('takes the quote number from ?quote= when it is eight digits, and the email from the navigation state', async () => {
      const { page } = await setup({ quote: '12345678', email: 'ada@example.com' });
      expect(page.$<HTMLInputElement>('#bf-quote-number').value).toBe('12345678');
      expect(page.$<HTMLInputElement>('#bf-email').value).toBe('ada@example.com');
    });

    for (const quote of ['abc', '123456789', '1234567', '12 345678', '']) {
      it(`does not prefill the quote number from "${quote}"`, async () => {
        const { page } = await setup({ quote });
        expect(page.$<HTMLInputElement>('#bf-quote-number').value).toBe('');
      });
    }

    it('leaves the email empty without a state, and ignores a state that has no text email', async () => {
      const { page } = await setup();
      expect(page.$<HTMLInputElement>('#bf-email').value).toBe('');
      TestBed.resetTestingModule();
      document.body.replaceChildren();
      history.replaceState({ email: 42 }, '');
      const again = await setup();
      expect(again.page.$<HTMLInputElement>('#bf-email').value).toBe('');
    });
  });

  describe('the open times', () => {
    it('asks for 31 days starting today in Chicago, not today in UTC, once a kind is chosen', async () => {
      const { page, http } = await setup();
      await page.kind(0);
      const req = expectAvailability(http);
      expect(req.request.params.get('from')).toBe(TODAY);
      expect(req.request.params.get('to')).toBe('2026-12-27');
      expect(req.request.params.get('kind')).toBe('survey');
      expect(req.request.params.has('durationMinutes')).toBe(false);
      answer(req);
      await page.settle();
    });

    it('sends the length for a drops-only install, and asks again when it changes, and not for a whole-home install', async () => {
      const { page, http } = await setup();
      await page.kind(1);
      const first = expectAvailability(http);
      expect(first.request.params.get('kind')).toBe('drops-only-install');
      expect(first.request.params.get('durationMinutes')).toBe('120');
      answer(first);
      await page.settle();
      await page.choose('bf-hours', '3');
      const second = expectAvailability(http);
      expect(second.request.params.get('durationMinutes')).toBe('180');
      answer(second);
      await page.settle();
      await page.kind(2);
      const third = expectAvailability(http);
      expect(third.request.params.get('kind')).toBe('whole-home-install');
      expect(third.request.params.has('durationMinutes')).toBe(false);
      answer(third);
      await page.settle();
    });

    it('asks nothing for a key typed elsewhere in the form, and nothing before the app runs or before a kind', async () => {
      const { page, http } = await setup();
      await page.type('bf-quote-number', '1234');
      await page.type('bf-email', 'a@b.co');
      http.expectNone(() => true);
      await page.kind(0);
      answer(expectAvailability(http));
      await page.settle();
      await page.type('bf-notes', 'Gate code 1234');
      await page.type('bf-phone', '5735550100');
      await page.type('bf-email', 'ada@example.com');
      http.expectNone(() => true);
    });

    it('lists only the days that have times as buttons, and a chosen day shows its times in Central Time', async () => {
      const { page, http } = await setup();
      await page.kind(0);
      answer(expectAvailability(http));
      await page.settle();
      expect(page.dayLabels()).toEqual(['Mon, Nov 30', 'Tue, Dec 1']);
      expect(page.$('#bf-day-2026-11-30').getAttribute('aria-pressed')).toBe('false');
      expect(page.has('.bf-times')).toBe(false);
      await page.day('2026-11-30');
      expect(page.$('#bf-day-2026-11-30').getAttribute('aria-pressed')).toBe('true');
      expect(page.$('#bf-day-2026-12-01').getAttribute('aria-pressed')).toBe('false');
      expect(page.timeLabels()).toEqual(['8:00 AM', '9:00 AM', '10:00 AM']);
      expect(page.text('.bf-times legend')).toContain('Central Time');
      await page.day('2026-12-01');
      expect(page.timeLabels()).toEqual(['8:00 AM']);
    });

    it('moves the window by 31 days, never before today and never past 90 days ahead', async () => {
      const { page, http } = await setup();
      await page.kind(0);
      answer(expectAvailability(http));
      await page.settle();
      expect(page.$<HTMLButtonElement>('#bf-earlier').disabled).toBe(true);
      expect(page.$<HTMLButtonElement>('#bf-later').disabled).toBe(false);

      await page.click('#bf-later');
      const second = expectAvailability(http);
      expect([second.request.params.get('from'), second.request.params.get('to')]).toEqual(['2026-12-28', '2027-01-27']);
      answer(second, [{ date: '2026-12-29', starts: ['08:00'] }]);
      await page.settle();
      expect(page.dayLabels()).toEqual(['Tue, Dec 29']);
      expect(page.$<HTMLButtonElement>('#bf-earlier').disabled).toBe(false);

      await page.click('#bf-later');
      const third = expectAvailability(http);
      expect([third.request.params.get('from'), third.request.params.get('to')]).toEqual(['2027-01-28', '2027-02-25']);
      answer(third, [{ date: '2027-02-01', starts: ['08:00'] }]);
      await page.settle();
      expect(page.$<HTMLButtonElement>('#bf-later').disabled).toBe(true);

      await page.click('#bf-earlier');
      const back = expectAvailability(http);
      expect(back.request.params.get('from')).toBe('2026-12-28');
      answer(back, [{ date: '2026-12-29', starts: ['08:00'] }]);
      await page.settle();
      await page.click('#bf-earlier');
      expect(expectAvailability(http).request.params.get('from')).toBe(TODAY);
    });

    it('says so when a window has no open day, and offers the later window', async () => {
      const { page, http } = await setup();
      await page.kind(0);
      answer(expectAvailability(http), [{ date: '2026-11-27', starts: [] }]);
      await page.settle();
      expect(page.text('.bf-slots-note')).toContain('No open times in this window.');
      expect(page.dayLabels()).toEqual([]);
      await page.click('#bf-later');
      answer(expectAvailability(http), []);
      await page.settle();
      await page.click('#bf-later');
      answer(expectAvailability(http), []);
      await page.settle();
      // The last window: nothing later to offer.
      expect(page.text('.bf-slots-note')).toContain('No open times in this window.');
      expect(page.$<HTMLButtonElement>('#bf-later').disabled).toBe(true);
    });

    it('clears a chosen time that the new list does not have, when the kind changes', async () => {
      const { page, http } = await setup();
      await fillSurvey(page, http);
      expect(page.$<HTMLInputElement>('input[type="radio"][value="09:00"]').checked).toBe(true);
      await page.kind(2);
      answer(expectAvailability(http), [{ date: '2026-11-30', starts: ['08:00'] }, { date: '2026-12-01', starts: ['08:00'] }]);
      await page.settle();
      // The day is still open, its 09:00 is not: the day stays chosen, the time goes.
      expect(page.$('#bf-day-2026-11-30').getAttribute('aria-pressed')).toBe('true');
      expect(page.has('input[type="radio"][value="09:00"]')).toBe(false);
      await page.submit();
      expect(page.summaryLinks()).toContain('Time: Choose a start time.');
      http.expectNone(() => true);
    });

    it('clears a chosen day that is no longer open, when the length changes', async () => {
      const { page, http } = await setup();
      await page.kind(1);
      answer(expectAvailability(http));
      await page.settle();
      await page.day('2026-12-01');
      await page.time('08:00');
      await page.choose('bf-hours', '6');
      answer(expectAvailability(http), [{ date: '2026-11-30', starts: ['08:00'] }]);
      await page.settle();
      expect(page.has('button.bf-day[aria-pressed="true"]')).toBe(false);
      expect(page.has('.bf-times')).toBe(false);
    });

    it('drops an answer that arrives after the kind changed, and shows only the newest', async () => {
      const { page, http } = await setup();
      await page.kind(0);
      const first = expectAvailability(http);
      await page.kind(2);
      const second = expectAvailability(http);
      answer(second, [{ date: '2026-12-01', starts: ['08:00'] }]);
      await page.settle();
      answer(first, [{ date: '2026-11-30', starts: ['09:00'] }]);
      await page.settle();
      expect(page.dayLabels()).toEqual(['Tue, Dec 1']);
    });

    it('shows the offline notice in the slot area for an offline answer, and asks again from its button', async () => {
      const { page, http } = await setup();
      await page.kind(0);
      problem(expectAvailability(http), 503, { title: 'Service unavailable' }, { 'retry-after': '30' });
      await page.settle();
      expect(page.text('.bf-slots-note')).toContain(OFFLINE_COPY);
      expect(page.has('button.bf-day')).toBe(false);
      await page.click('#bf-slots-retry');
      answer(expectAvailability(http));
      await page.settle();
      expect(page.has('.bf-slots-note')).toBe(false);
      expect(page.dayLabels().length).toBe(2);
    });

    it('drops the chosen day and time when the new list cannot be loaded, so a slot that is not on screen is never sent', async () => {
      const { page, http } = await setup();
      await fillSurvey(page, http);
      await page.kind(1);
      problem(expectAvailability(http), 503, { title: 'Service unavailable' }, { 'retry-after': '30' });
      await page.settle();
      expect(page.has('button.bf-day')).toBe(false);
      await page.submit();
      expect(page.summaryLinks()).toEqual(['Day: Choose a day.']);
      http.expectNone('/api/lan/appointments');
    });

    it('shows the offline notice when nothing answers', async () => {
      const { page, http } = await setup();
      await page.kind(0);
      expectAvailability(http).error(new ProgressEvent('error'));
      await page.settle();
      expect(page.text('.bf-slots-note')).toContain(OFFLINE_COPY);
    });

    it('shows the retry text for the limiter\'s 429, and a plain failure for the rest, never the server\'s text', async () => {
      const { page, http } = await setup();
      await page.kind(0);
      problem(expectAvailability(http), 429, { title: 'Too Many Requests', detail: 'Too many requests.' }, { 'retry-after': '120' });
      await page.settle();
      expect(page.text('.bf-slots-note')).toContain('try again in 2 minutes');
      await page.click('#bf-slots-retry');
      problem(expectAvailability(http), 500, { title: 'Stack trace', detail: 'secret detail' });
      await page.settle();
      expect(page.text('.bf-slots-note')).toContain("Open times can't be shown right now.");
      expect(page.text('.bf-slots-note')).not.toMatch(/Stack trace|secret detail/);
    });

    it('ignores days and times that are not in the answer\'s shape', async () => {
      const { page, http } = await setup();
      await page.kind(0);
      const req = expectAvailability(http);
      req.flush(
        {
          timeZone: 'America/Chicago',
          days: [
            { date: '<b>x</b>', starts: ['08:00'] },
            { date: '2026-13-45', starts: ['08:00'] },
            { date: '2026-11-30', starts: ['08:00', '99:99', 'soon', 7] },
            { date: '2026-12-01' },
            null,
          ],
        },
        { status: 200, statusText: 'OK' },
      );
      await page.settle();
      expect(page.dayLabels()).toEqual(['Mon, Nov 30']);
      await page.day('2026-11-30');
      expect(page.timeLabels()).toEqual(['8:00 AM']);
    });
  });

  describe('client checks', () => {
    it('lists the missing quote number, email, kind and day, focuses the summary and sends nothing', async () => {
      const { page, http } = await setup();
      await page.submit();
      expect(page.summaryLinks()).toEqual([
        'Quote number: Enter the 8-digit quote number.',
        'Email: Enter your email address.',
        'Appointment type: Choose the kind of appointment.',
        'Day: Choose a day.',
      ]);
      expect(document.activeElement).toBe(page.$('.summary'));
      expect(page.text('#bf-quote-number-error')).toBe('Error: Enter the 8-digit quote number.');
      http.expectNone(() => true);
    });

    it('wants exactly eight digits, and only the shape of an email', async () => {
      const { page, http } = await setup();
      await page.type('bf-quote-number', '1234567');
      await page.type('bf-email', 'nope');
      await page.submit();
      expect(page.summaryLinks().slice(0, 2)).toEqual(['Quote number: Enter the 8-digit quote number.', 'Email: Enter a valid email address.']);
      http.expectNone(() => true);
    });

    it('asks for a time once a day is chosen without one', async () => {
      const { page, http } = await setup();
      await page.type('bf-quote-number', '12345678');
      await page.type('bf-email', 'ada@example.com');
      await page.kind(0);
      answer(expectAvailability(http));
      await page.settle();
      await page.day('2026-11-30');
      await page.submit();
      expect(page.summaryLinks()).toEqual(['Time: Choose a start time.']);
    });

    it('focuses the day picker from its summary link', async () => {
      const { page } = await setup();
      await page.submit();
      Array.from(page.root.querySelectorAll<HTMLElement>('.summary a')).find((a) => a.textContent!.startsWith('Day'))!.click();
      expect(document.activeElement).toBe(page.$('#bf-slot'));
    });
  });

  describe('a valid booking', () => {
    it('posts what the API takes for a survey: trimmed, optional fields left out, no length, the trap field empty', async () => {
      const { page, http } = await setup();
      await fillSurvey(page, http);
      await page.type('bf-quote-number', ' 12345678 ');
      await page.type('bf-email', ' ada@example.com ');
      await page.submit();
      const req = expectBook(http);
      expect(req.request.headers.get('Content-Type')).toBe('application/json');
      expect(req.request.headers.get('Idempotency-Key')).toMatch(UUID);
      expect(JSON.parse(JSON.stringify(req.request.body))).toEqual({
        quoteNumber: '12345678',
        email: 'ada@example.com',
        kind: 'survey',
        date: '2026-11-30',
        time: '09:00',
        honeypot: '',
      });
      req.flush(BOOKED, { status: 201, statusText: 'Created' });
      await page.settle();
    });

    it('always sends the length of a drops-only install, in minutes, and the phone and notes when filled', async () => {
      const { page, http } = await setup();
      await page.type('bf-quote-number', '12345678');
      await page.type('bf-email', 'ada@example.com');
      await page.kind(1);
      answer(expectAvailability(http));
      await page.settle();
      await page.day('2026-11-30');
      await page.time('08:00');
      await page.type('bf-phone', ' (573) 555-0100 ');
      await page.type('bf-notes', '  Side gate  ');
      await page.submit();
      const req = expectBook(http);
      expect(req.request.body).toMatchObject({ kind: 'drops-only-install', durationMinutes: 120, phone: '(573) 555-0100', notes: 'Side gate' });
      problem(req, 500, { title: 'x' });
      await page.settle();
      // 12 hours is the longest the contract allows; the day and the time are still listed, so they stay chosen.
      await page.choose('bf-hours', '12');
      answer(expectAvailability(http));
      await page.settle();
      await page.submit();
      const longest = expectBook(http);
      expect(longest.request.body.durationMinutes).toBe(720);
      problem(longest, 500, { title: 'x' });
      await page.settle();
    });

    it('sends no length for a whole-home install', async () => {
      const { page, http } = await setup();
      await page.type('bf-quote-number', '12345678');
      await page.type('bf-email', 'ada@example.com');
      await page.kind(2);
      answer(expectAvailability(http), [{ date: '2026-11-30', starts: ['08:00'] }]);
      await page.settle();
      await page.day('2026-11-30');
      await page.time('08:00');
      await page.submit();
      const req = expectBook(http);
      expect(req.request.body.kind).toBe('whole-home-install');
      expect(JSON.parse(JSON.stringify(req.request.body)).durationMinutes).toBeUndefined();
      problem(req, 500, { title: 'x' });
      await page.settle();
    });

    it('sends what a bot typed into the trap field', async () => {
      const { page, http } = await setup();
      await fillSurvey(page, http);
      page.$<HTMLInputElement>('#bf-honeypot').value = 'http://spam.example';
      await page.submit();
      const req = expectBook(http);
      expect(req.request.body.honeypot).toBe('http://spam.example');
      problem(req, 400, { title: 'Invalid', errors: { honeypot: ['Bot detection triggered.'] } });
      await page.settle();
      expect(page.root.textContent).not.toMatch(/honeypot|Bot detection/i);
      expect(page.text('.summary')).toContain('Part of your request could not be accepted');
    });

    it('shows the reference, the kind, and the start and end in Central Time, with the contract-matching copy, and focuses the heading', async () => {
      const { page, http } = await setup();
      await fillSurvey(page, http);
      await page.submit();
      expect(page.text('.sending')).toBe('Sending…');
      expect(page.submitButton.disabled).toBe(true);
      expectBook(http).flush(BOOKED, { status: 201, statusText: 'Created' });
      await page.settle();
      expect(page.has('form')).toBe(false);
      const sent = page.text('.cf-sent');
      expect(sent).toContain('Appointment booked');
      expect(page.text('.cf-sent strong.mono')).toBe('12345678');
      expect(sent).toContain('Site Survey');
      expect(sent).toContain('Monday, November 30, 2026');
      expect(sent).toContain('9:00 AM');
      expect(sent).toContain('11:00 AM');
      expect(sent).toContain('Central Time');
      expect(sent).toContain("We'll contact you before the appointment to confirm.");
      expect(sent).not.toMatch(/inbox|emailed|confirmation email|check your|within/i);
      expect(document.activeElement).toBe(page.$('.cf-sent h2'));
    });

    it('writes an instant given in UTC in Chicago time too, and the end on its own day when it differs', async () => {
      const { page, http } = await setup();
      await fillSurvey(page, http);
      await page.submit();
      expectBook(http).flush(
        { reference: '12345678', kind: 'whole-home-install', startsAt: '2026-12-01T14:00:00+00:00', endsAt: '2026-12-02T02:00:00+00:00' },
        { status: 201, statusText: 'Created' },
      );
      await page.settle();
      const sent = page.text('.cf-sent');
      expect(sent).toContain('Whole-Home Install');
      expect(sent).toContain('Tuesday, December 1, 2026');
      expect(sent).toContain('8:00 AM');
      expect(sent).toContain('8:00 PM');
    });

    for (const body of [{}, { reference: '<b>1</b>', kind: 'x', startsAt: 'soon', endsAt: 5 }, null]) {
      it(`shows the page without a reference or times when the answer is ${JSON.stringify(body)}`, async () => {
        const { page, http } = await setup();
        await fillSurvey(page, http);
        await page.submit();
        expectBook(http).flush(body, { status: 201, statusText: 'Created' });
        await page.settle();
        const sent = page.text('.cf-sent');
        expect(sent).toContain('Your appointment was booked.');
        expect(sent).not.toMatch(/Invalid|NaN|undefined/);
        expect(page.has('.cf-sent strong')).toBe(false);
      });
    }

    it('sends once for a double click, and never lets the browser submit the form itself', async () => {
      const { page, http } = await setup();
      await fillSurvey(page, http);
      page.submitButton.click();
      page.submitButton.click();
      const event = new Event('submit', { cancelable: true, bubbles: true });
      page.$('form').dispatchEvent(event);
      await page.settle();
      expect(event.defaultPrevented).toBe(true);
      expect(page.$('form').getAttribute('method')).toBe('post');
      expectBook(http).flush(BOOKED, { status: 201, statusText: 'Created' });
      await page.settle();
    });
  });

  describe('the Idempotency-Key', () => {
    it('is the same for a retry of the same request after an offline answer, and new once a field changed', async () => {
      const { page, http } = await setup();
      await fillSurvey(page, http);
      await page.submit();
      const first = expectBook(http);
      const key = first.request.headers.get('Idempotency-Key')!;
      expect(key).toMatch(UUID);
      first.error(new ProgressEvent('error'));
      await page.settle();

      await page.submit();
      const retry = expectBook(http);
      expect(retry.request.headers.get('Idempotency-Key')).toBe(key);
      problem(retry, 503, { title: 'Service unavailable' }, { 'retry-after': '30' });
      await page.settle();

      await page.type('bf-notes', 'Call first');
      await page.submit();
      const changed = expectBook(http);
      const next = changed.request.headers.get('Idempotency-Key')!;
      expect(next).toMatch(UUID);
      expect(next).not.toBe(key);
      changed.error(new ProgressEvent('error'));
      await page.settle();

      await page.submit();
      const again = expectBook(http);
      expect(again.request.headers.get('Idempotency-Key')).toBe(next);
      again.flush(BOOKED, { status: 201, statusText: 'Created' });
      await page.settle();
    });

    it('is new when only the time, or the quote number, or the trap field changed', async () => {
      const { page, http } = await setup();
      await fillSurvey(page, http);
      const keys: string[] = [];
      const send = async () => {
        await page.submit();
        const req = expectBook(http);
        keys.push(req.request.headers.get('Idempotency-Key')!);
        req.error(new ProgressEvent('error'));
        await page.settle();
      };
      await send();
      await page.time('10:00');
      await send();
      await page.type('bf-quote-number', '12345679');
      await send();
      await send();
      expect(new Set(keys.slice(0, 3)).size).toBe(3);
      expect(keys[3]).toBe(keys[2]);
    });
  });

  describe('when the API says no', () => {
    it('marks the fields of a 400 by their JSON path, keeps every value, and clears a field when it is edited', async () => {
      const { page, http } = await setup();
      await fillSurvey(page, http);
      await page.type('bf-phone', 'abc1234');
      await page.submit();
      problem(expectBook(http), 400, {
        title: 'Invalid',
        errors: { phone: ['Please enter a valid phone number.'], quoteNumber: ['Quote number must be 8 digits.'], kind: ['Survey needs nothing.'], notes: ['Notes are too long.'], email: ['Enter a valid email address.'] },
      });
      await page.settle();
      expect(page.summaryLinks()).toEqual([
        'Quote number: Quote number must be 8 digits.',
        'Email: Enter a valid email address.',
        'Appointment type: Survey needs nothing.',
        'Phone: Please enter a valid phone number.',
        'Notes: Notes are too long.',
      ]);
      expect(page.text('#bf-phone-error')).toBe('Error: Please enter a valid phone number.');
      expect(document.activeElement).toBe(page.$('.summary'));
      expect(page.$<HTMLInputElement>('#bf-quote-number').value).toBe('12345678');
      expect(page.$<HTMLInputElement>('#bf-phone').value).toBe('abc1234');
      expect(page.submitButton.disabled).toBe(false);
      await page.type('bf-phone', '5735550100');
      expect(page.has('#bf-phone-error')).toBe(false);
    });

    it('drops the errors of fields that were edited while the request was out, and keeps the others', async () => {
      const { page, http } = await setup();
      await fillSurvey(page, http);
      await page.type('bf-phone', 'abc1234');
      await page.submit();
      const req = expectBook(http);
      await page.type('bf-phone', '5735550100');
      problem(req, 400, { title: 'Invalid', errors: { phone: ['Please enter a valid phone number.'], notes: ['Notes are too long.'] } });
      await page.settle();
      expect(page.has('#bf-phone-error')).toBe(false);
      expect(page.text('#bf-notes-error')).toBe('Error: Notes are too long.');
      expect(page.summaryLinks()).toEqual(['Notes: Notes are too long.']);
    });

    it('lets the corrected request be sent when every error was for a value edited while the request was out', async () => {
      const { page, http } = await setup();
      await fillSurvey(page, http);
      await page.type('bf-phone', 'abc1234');
      await page.submit();
      const req = expectBook(http);
      await page.type('bf-phone', '5735550100');
      problem(req, 400, { title: 'Invalid', errors: { phone: ['Please enter a valid phone number.'] } });
      await page.settle();
      expect(page.has('#bf-phone-error')).toBe(false);
      expect(page.summaryLinks()).toEqual([]);
      expect(page.submitButton.disabled).toBe(false);
      await page.submit();
      expectBook(http).flush(BOOKED, { status: 201, statusText: 'Created' });
      await page.settle();
    });

    it('does not refresh the open times for a day or time error when the day or time was changed while the request was out', async () => {
      const { page, http } = await setup();
      await fillSurvey(page, http);
      await page.submit();
      const req = expectBook(http);
      await page.time('10:00');
      problem(req, 400, { title: 'Invalid', errors: { time: ['That time is closed.'] } });
      await page.settle();
      http.expectNone(() => true);
      expect(page.has('#bf-slot-error')).toBe(false);
    });

    for (const [field, id, value] of [
      ['quote number', 'bf-quote-number', '87654321'],
      ['email', 'bf-email', 'grace@example.com'],
    ] as const) {
      it(`drops the "wrong kind of quote" error when the ${field} changes, so the corrected request is sent`, async () => {
        const { page, http } = await setup();
        await fillSurvey(page, http);
        await page.submit();
        problem(expectBook(http), 400, { title: 'Invalid', errors: { kind: ['Whole-home install needs a whole-home quote.'] } });
        await page.settle();
        expect(page.summaryLinks()).toEqual(['Appointment type: Whole-home install needs a whole-home quote.']);
        await page.type(id, value);
        expect(page.has('#bf-kind-error')).toBe(false);
        await page.submit();
        expect(page.summaryLinks()).toEqual([]);
        expectBook(http).flush(BOOKED, { status: 201, statusText: 'Created' });
        await page.settle();
      });
    }

    it('drops a day or time error when the kind changes, so the day that is still open can be sent again', async () => {
      const { page, http } = await setup();
      await fillSurvey(page, http);
      await page.submit();
      problem(expectBook(http), 400, { title: 'Invalid', errors: { time: ['That time is closed.'] } });
      await page.settle();
      answer(expectAvailability(http));
      await page.settle();
      expect(page.text('#bf-slot-error')).toContain('That time is closed.');
      await page.kind(1);
      answer(expectAvailability(http));
      await page.settle();
      expect(page.has('#bf-slot-error')).toBe(false);
    });

    it('puts a date or time error on the day picker and asks for the open times again', async () => {
      const { page, http } = await setup();
      await fillSurvey(page, http);
      await page.submit();
      problem(expectBook(http), 400, { title: 'Invalid', errors: { date: ['That date is outside the booking window.'], time: ['That time is closed.'] } });
      await page.settle();
      expect(page.summaryLinks()).toEqual(['Day: That date is outside the booking window.', 'Time: That time is closed.']);
      expect(page.text('#bf-slot-error')).toContain('That date is outside the booking window.');
      expect(page.text('#bf-slot-error')).toContain('That time is closed.');
      answer(expectAvailability(http), [{ date: '2026-12-01', starts: ['08:00'] }]);
      await page.settle();
      // The chosen day is gone from the new list: so is the choice.
      expect(page.has('button.bf-day[aria-pressed="true"]')).toBe(false);
    });

    for (const [status, detail] of [
      [404, 'No quote matches that number and email.'],
      [409, "This quote can't be booked."],
      [409, 'This quote already has an appointment.'],
      [422, 'This Idempotency-Key was already used for a different request.'],
      [429, 'You already booked an appointment in the last 24 hours.'],
    ] as const) {
      it(`shows the API's own sentence for a ${status} ("${detail}") with the contact line, and keeps every value`, async () => {
        const { page, http } = await setup();
        await fillSurvey(page, http);
        await page.submit();
        problem(expectBook(http), status, { title: 'x', detail });
        await page.settle();
        if (status === 409) {
          answer(expectAvailability(http));
          await page.settle();
        }
        const alert = page.text('[role="alert"]');
        expect(alert).toContain(detail);
        expect(alert).not.toContain('try again in');
        expect(alert).not.toContain('could not be sent');
        expect(page.$<HTMLInputElement>('#bf-quote-number').value).toBe('12345678');
        expect(page.submitButton.disabled).toBe(false);
      });
    }

    it('refetches the open times on a 409 and clears a slot that was taken', async () => {
      const { page, http } = await setup();
      await fillSurvey(page, http);
      await page.submit();
      problem(expectBook(http), 409, { title: 'Conflict', detail: "That time isn't available." });
      await page.settle();
      answer(expectAvailability(http), [{ date: '2026-11-30', starts: ['08:00', '10:00'] }]);
      await page.settle();
      expect(page.text('[role="alert"]')).toContain("That time isn't available.");
      expect(page.$('#bf-day-2026-11-30').getAttribute('aria-pressed')).toBe('true');
      expect(page.has('input[type="radio"][value="09:00"]')).toBe(false);
      expect(page.timeLabels()).toEqual(['8:00 AM', '10:00 AM']);
    });

    it('shows the limiter\'s wait in minutes for a 429 that has a Retry-After', async () => {
      const { page, http } = await setup();
      await fillSurvey(page, http);
      await page.submit();
      problem(expectBook(http), 429, { title: 'Too Many Requests', detail: 'Too many booking requests.' }, { 'retry-after': '900' });
      await page.settle();
      expect(page.text('[role="alert"]')).toContain('try again in 15 minutes');
    });

    for (const answerKind of ['503 with a wait', 'network'] as const) {
      it(`says offline for ${answerKind === 'network' ? 'no answer' : "the edge's 503"}, and keeps the input`, async () => {
        const { page, http } = await setup();
        await fillSurvey(page, http);
        await page.submit();
        const req = expectBook(http);
        if (answerKind === 'network') {
          req.error(new ProgressEvent('error'));
        } else {
          problem(req, 503, { title: 'Service unavailable' }, { 'retry-after': '30' });
        }
        await page.settle();
        expect(page.text('[role="alert"]')).toContain(OFFLINE_COPY);
        expect(page.$<HTMLInputElement>('#bf-email').value).toBe('ada@example.com');
        expect(page.submitButton.disabled).toBe(false);
      });
    }

    for (const status of [413, 415, 500]) {
      it(`takes a ${status} as a generic failure with the contact line, never showing the server text`, async () => {
        const { page, http } = await setup();
        await fillSurvey(page, http);
        await page.submit();
        problem(expectBook(http), status, { title: 'Stack trace here', detail: 'secret detail' });
        await page.settle();
        const alert = page.text('[role="alert"]');
        expect(alert).toContain('Your request could not be sent');
        expect(alert).toContain('jackson@actionjacksoninstalls.com');
        expect(alert).not.toMatch(/Stack trace|secret detail/);
      });
    }

    it('takes an Idempotency-Key 400 as a generic problem, never showing its name', async () => {
      const { page, http } = await setup();
      await fillSurvey(page, http);
      await page.submit();
      problem(expectBook(http), 400, { title: 'Invalid', errors: { 'Idempotency-Key': ['must be a UUID'] } });
      await page.settle();
      expect(page.text('.summary')).toContain('Part of your request could not be accepted');
      expect(page.root.textContent).not.toContain('Idempotency');
    });
  });
});
