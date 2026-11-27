import { provideHttpClient, withFetch } from '@angular/common/http';
import { HttpTestingController, type TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { OFFLINE_COPY, SITE_KEY } from '@aj/shared';
import { CONSULTATION_OPTIONS } from '../data/options';
import { ConsultationForm } from './consultation-form';

// The form in a browser-like page (jsdom), with the API answered by the test. The API is never called by the page itself.
async function setup() {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(withFetch()), provideHttpClientTesting(), provideRouter([]), { provide: SITE_KEY, useValue: 'lan' }],
  });
  const fixture = TestBed.createComponent(ConsultationForm);
  document.body.appendChild(fixture.nativeElement);
  await fixture.whenStable();
  const http = TestBed.inject(HttpTestingController);
  return { fixture, http, page: new Page(fixture) };
}

class Page {
  constructor(private readonly fixture: ComponentFixture<ConsultationForm>) {}

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

  get submitButton(): HTMLButtonElement {
    return this.$<HTMLButtonElement>('button[type="submit"]');
  }

  // A turn of the event loop first: the answer of a request reaches the component through promises, which whenStable
  // does not wait for (nothing in the component is a pending task while it waits for the API).
  async settle(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await this.fixture.whenStable();
  }

  async type(id: string, value: string): Promise<void> {
    const input = this.$<HTMLInputElement>('#' + id);
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

  // Submits the way a visitor does: a click on the button.
  async submit(): Promise<void> {
    this.submitButton.click();
    await this.settle();
  }

  async fillValid(): Promise<void> {
    await this.type('cf-name', 'Ada Lovelace');
    await this.type('cf-email', 'ada@example.com');
    await this.choose('cf-square-footage', '1,500-2,500');
    await this.click('cf-service-0');
  }

  summaryLinks(): string[] {
    return Array.from(this.root.querySelectorAll('.summary a')).map((a) => a.textContent!.replace(/\s+/g, ' ').trim());
  }

  text(selector: string): string {
    return this.$(selector).textContent!.replace(/\s+/g, ' ').trim();
  }
}

const CREATED = { requestNumber: '12345678' };

function expectPost(http: HttpTestingController): TestRequest {
  const req = http.expectOne('/api/lan/consultations');
  expect(req.request.method).toBe('POST');
  return req;
}

function problem(req: TestRequest, status: number, body: object, headers: Record<string, string> = {}): void {
  req.flush(body, { status, statusText: 'x', headers: { 'content-type': 'application/problem+json', ...headers } });
}

describe('ConsultationForm', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    document.body.replaceChildren();
  });

  it('has every option of the contract, from contracts/lan-options.json and nowhere else', async () => {
    const { page } = await setup();
    const texts = (selector: string) => Array.from(page.root.querySelectorAll(selector)).map((e) => e.textContent!.trim());
    const labels = (options: readonly { label: string }[]) => options.map((o) => o.label);
    expect(texts('#cf-square-footage option').slice(1)).toEqual(labels(CONSULTATION_OPTIONS.squareFootage));
    expect(texts('input[id^="cf-issue-"] + span')).toEqual(labels(CONSULTATION_OPTIONS.currentIssues));
    expect(texts('input[id^="cf-service-"] + span')).toEqual(labels(CONSULTATION_OPTIONS.interestedServices));
    expect(texts('input[id^="cf-package-"] + span')).toEqual(labels(CONSULTATION_OPTIONS.interestedPackage));
  });

  it('is switched on once the app runs, and makes no request by itself', async () => {
    const { page, http } = await setup();
    expect(page.submitButton.disabled).toBe(false);
    expect(page.root.querySelector('.cf-wait')).toBeNull();
    http.expectNone(() => true);
  });

  it('puts every checkbox and radio on the same line as its label', async () => {
    const { page } = await setup();
    const choices = page.root.querySelectorAll('label.cf-choice');
    expect(choices.length).toBe(
      CONSULTATION_OPTIONS.currentIssues.length + CONSULTATION_OPTIONS.interestedServices.length + CONSULTATION_OPTIONS.interestedPackage.length,
    );
    for (const choice of Array.from(choices)) {
      expect(choice.querySelectorAll('input').length).toBe(1);
      expect(choice.querySelector('span')!.textContent!.trim().length).toBeGreaterThan(0);
    }
  });

  it('keeps the trap field out of the tab order and the accessibility tree', async () => {
    const { page } = await setup();
    const trap = page.$('.cf-trap');
    expect(trap.getAttribute('aria-hidden')).toBe('true');
    const input = page.$<HTMLInputElement>('input[name="honeypot"]');
    expect(input.tabIndex).toBe(-1);
    expect(input.getAttribute('autocomplete')).toBe('off');
    expect(input.closest('.cf-trap')).toBe(trap);
  });

  it('stops the ISP input at 200 characters', async () => {
    const { page } = await setup();
    expect(page.$('#cf-isp').getAttribute('maxlength')).toBe('200');
  });

  describe('client checks', () => {
    it('lists the missing name, email, square footage and services, focuses the summary and sends nothing', async () => {
      const { page, http } = await setup();
      await page.submit();
      expect(page.summaryLinks()).toEqual([
        'Name: Enter your name.',
        'Email: Enter your email address.',
        'Square footage: Choose your square footage.',
        'Services: Choose at least one service.',
      ]);
      expect(document.activeElement).toBe(page.$('.summary'));
      expect(page.$('#cf-name').getAttribute('aria-invalid')).toBe('true');
      expect(page.$('#cf-name').getAttribute('aria-describedby')).toBe('cf-name-error');
      expect(page.text('#cf-name-error')).toBe('Error: Enter your name.');
      expect(page.$('#cf-phone').getAttribute('aria-invalid')).toBeNull();
      http.expectNone(() => true);
    });

    it('treats a name of only spaces as missing', async () => {
      const { page } = await setup();
      await page.type('cf-name', '   ');
      await page.submit();
      expect(page.summaryLinks()[0]).toBe('Name: Enter your name.');
    });

    it('checks only the shape of an email, and says so on the field', async () => {
      const { page, http } = await setup();
      await page.fillValid();
      await page.type('cf-email', 'not-an-email');
      await page.submit();
      expect(page.summaryLinks()).toEqual(['Email: Enter a valid email address.']);
      http.expectNone(() => true);
    });

    it('focuses a field from its summary link', async () => {
      const { page } = await setup();
      await page.submit();
      (page.root.querySelector('.summary a') as HTMLElement).click();
      expect(document.activeElement).toBe(page.$('#cf-name'));
    });

    it('focuses the first checkbox from the services link', async () => {
      const { page } = await setup();
      await page.submit();
      const link = Array.from(page.root.querySelectorAll<HTMLElement>('.summary a')).find((a) => a.textContent!.startsWith('Services'))!;
      link.click();
      expect(document.activeElement).toBe(page.$('#cf-service-0'));
    });

    it('shows a field its error once it was left, before any submit', async () => {
      const { page } = await setup();
      const name = page.$<HTMLInputElement>('#cf-name');
      name.dispatchEvent(new Event('blur'));
      await page.settle();
      expect(page.text('#cf-name-error')).toBe('Error: Enter your name.');
      expect(page.root.querySelector('#cf-email-error')).toBeNull();
    });

    it('takes 0 and 8 current issues, and 1 and 4 services', async () => {
      const { page, http } = await setup();
      await page.fillValid();
      await page.submit();
      const none = expectPost(http);
      expect(none.request.body.property.currentIssues).toEqual([]);
      problem(none, 500, { title: 'x' });
      await page.settle();

      for (let i = 0; i < CONSULTATION_OPTIONS.currentIssues.length; i += 1) {
        await page.click(`cf-issue-${i}`);
      }
      for (let i = 1; i < CONSULTATION_OPTIONS.interestedServices.length; i += 1) {
        await page.click(`cf-service-${i}`);
      }
      await page.submit();
      const all = expectPost(http);
      expect(all.request.body.property.currentIssues).toEqual(CONSULTATION_OPTIONS.currentIssues.map((o) => o.value));
      expect(all.request.body.interestedServices).toEqual(CONSULTATION_OPTIONS.interestedServices.map((o) => o.value));
      all.flush(CREATED, { status: 201, statusText: 'Created' });
      await page.settle();
    });
  });

  describe('a valid request', () => {
    it('posts what the API takes: trimmed, optional fields left out, lists in the contract order, the trap field empty', async () => {
      const { page, http } = await setup();
      await page.type('cf-name', '  Ada Lovelace ');
      await page.type('cf-email', ' ada@example.com ');
      await page.choose('cf-square-footage', 'Over 5,000');
      // Clicked in the reverse of the contract's order.
      await page.click('cf-service-2');
      await page.click('cf-service-0');
      await page.click('cf-issue-3');
      await page.click('cf-issue-1');
      await page.submit();
      const req = expectPost(http);
      expect(req.request.headers.get('Content-Type')).toBe('application/json');
      // JSON.stringify drops undefined, which is how a left-out field leaves the body.
      expect(JSON.parse(JSON.stringify(req.request.body))).toEqual({
        customer: { name: 'Ada Lovelace', email: 'ada@example.com' },
        property: { squareFootage: 'Over 5,000', currentIssues: ['Dead zones', 'Too many devices'] },
        interestedServices: ['networking', 'cameras'],
        honeypot: '',
      });
      req.flush(CREATED, { status: 201, statusText: 'Created' });
      await page.settle();
    });

    it('sends the optional fields when they are filled', async () => {
      const { page, http } = await setup();
      await page.fillValid();
      await page.type('cf-phone', '(573) 555-0100');
      await page.type('cf-isp', 'Example Fiber');
      await page.click('cf-package-2');
      await page.submit();
      const req = expectPost(http);
      expect(req.request.body.customer.phone).toBe('(573) 555-0100');
      expect(req.request.body.property.isp).toBe('Example Fiber');
      expect(req.request.body.interestedPackage).toBe('foundation');
      req.flush(CREATED, { status: 201, statusText: 'Created' });
      await page.settle();
    });

    it('sends what a bot typed into the trap field', async () => {
      const { page, http } = await setup();
      await page.fillValid();
      page.$<HTMLInputElement>('#cf-honeypot').value = 'http://spam.example';
      await page.submit();
      const req = expectPost(http);
      expect(req.request.body.honeypot).toBe('http://spam.example');
      problem(req, 400, { title: 'One or more validation errors occurred.', errors: { honeypot: ['Bot detection triggered.'] } });
      await page.settle();
      // The raw key and the server's words for it never show.
      expect(page.root.textContent).not.toMatch(/honeypot|Bot detection/i);
      expect(page.summaryLinks()).toEqual([]);
      expect(page.text('.summary')).toContain('Part of your request could not be accepted');
    });

    it('shows the request number and the contract-matching copy, hides the form, and focuses the heading', async () => {
      const { page, http } = await setup();
      await page.fillValid();
      await page.submit();
      expect(page.text('.sending')).toBe('Sending…');
      expect(page.submitButton.disabled).toBe(true);
      expectPost(http).flush(CREATED, { status: 201, statusText: 'Created' });
      await page.settle();
      expect(page.root.querySelector('form')).toBeNull();
      const sent = page.text('.cf-sent');
      expect(sent).toContain('Request received');
      expect(sent).toContain('12345678');
      expect(sent).toContain("We'll review your request and contact you to schedule your consultation.");
      // No promise of a time, and none that an email was sent.
      expect(sent).not.toMatch(/within|hours|inbox|email(ed)? (was|has been)|confirmation|check your/i);
      expect(document.activeElement).toBe(page.$('.cf-sent h2'));
    });

    for (const body of [{}, { requestNumber: '<b>1</b>' }, { requestNumber: 12345678 }, null]) {
      it(`shows the page without a number when the answer is ${JSON.stringify(body)}`, async () => {
        const { page, http } = await setup();
        await page.fillValid();
        await page.submit();
        expectPost(http).flush(body, { status: 201, statusText: 'Created' });
        await page.settle();
        expect(page.text('.cf-sent')).toContain('Your request was received.');
        expect(page.root.querySelector('.cf-sent strong')).toBeNull();
      });
    }

    it('sends once for a double click', async () => {
      const { page, http } = await setup();
      await page.fillValid();
      page.submitButton.click();
      page.submitButton.click();
      page.root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
      await page.settle();
      const req = expectPost(http);
      req.flush(CREATED, { status: 201, statusText: 'Created' });
      await page.settle();
    });

    it('never lets the browser submit the form itself', async () => {
      const { page } = await setup();
      const event = new Event('submit', { cancelable: true, bubbles: true });
      page.$('form').dispatchEvent(event);
      await page.settle();
      expect(event.defaultPrevented).toBe(true);
      expect(page.$('form').getAttribute('method')).toBe('post');
    });
  });

  describe('when the API says no', () => {
    it('marks the fields of a 400, keeps every value, and clears a field when it is edited', async () => {
      const { page, http } = await setup();
      await page.fillValid();
      await page.type('cf-phone', 'abc1234');
      await page.submit();
      problem(expectPost(http), 400, {
        title: 'One or more validation errors occurred.',
        errors: { 'customer.phone': ['Please enter a valid phone number.'] },
      });
      await page.settle();
      expect(page.text('#cf-phone-error')).toBe('Error: Please enter a valid phone number.');
      expect(page.$('#cf-phone').getAttribute('aria-invalid')).toBe('true');
      expect(page.summaryLinks()).toEqual(['Phone: Please enter a valid phone number.']);
      expect(document.activeElement).toBe(page.$('.summary'));
      expect(page.$<HTMLInputElement>('#cf-name').value).toBe('Ada Lovelace');
      expect(page.$<HTMLInputElement>('#cf-email').value).toBe('ada@example.com');
      expect(page.$<HTMLInputElement>('#cf-phone').value).toBe('abc1234');
      expect(page.$<HTMLSelectElement>('#cf-square-footage').value).toBe('1,500-2,500');
      expect(page.$<HTMLInputElement>('#cf-service-0').checked).toBe(true);
      expect(page.submitButton.disabled).toBe(false);

      await page.type('cf-phone', '5735550100');
      expect(page.root.querySelector('#cf-phone-error')).toBeNull();
    });

    it('drops the errors of fields that were edited while the request was out, and keeps the others', async () => {
      const { page, http } = await setup();
      await page.fillValid();
      await page.type('cf-phone', 'abc1234');
      await page.submit();
      const req = expectPost(http);
      await page.type('cf-phone', '5735550100');
      problem(req, 400, {
        title: 'Invalid',
        errors: { 'customer.phone': ['Please enter a valid phone number.'], 'customer.email': ['Enter a valid email address.'] },
      });
      await page.settle();
      expect(page.root.querySelector('#cf-phone-error')).toBeNull();
      expect(page.text('#cf-email-error')).toBe('Error: Enter a valid email address.');
      expect(page.summaryLinks()).toEqual(['Email: Enter a valid email address.']);
    });

    it('lets the corrected request be sent when every error was for a value edited while the request was out', async () => {
      const { page, http } = await setup();
      await page.fillValid();
      await page.type('cf-phone', 'abc1234');
      await page.submit();
      const req = expectPost(http);
      await page.type('cf-phone', '5735550100');
      problem(req, 400, { title: 'Invalid', errors: { 'customer.phone': ['Please enter a valid phone number.'] } });
      await page.settle();
      expect(page.root.querySelector('#cf-phone-error')).toBeNull();
      expect(page.summaryLinks()).toEqual([]);
      await page.submit();
      expectPost(http).flush(CREATED, { status: 201, statusText: 'Created' });
      await page.settle();
      expect(page.text('.cf-sent')).toContain('12345678');
    });

    it('sends the current values when the visitor sends again', async () => {
      const { page, http } = await setup();
      await page.fillValid();
      await page.type('cf-phone', 'abc1234');
      await page.submit();
      problem(expectPost(http), 400, { title: 'Invalid', errors: { 'customer.phone': ['Please enter a valid phone number.'] } });
      await page.settle();
      await page.type('cf-phone', '5735550100');
      await page.submit();
      const again = expectPost(http);
      expect(again.request.body.customer.phone).toBe('5735550100');
      again.flush(CREATED, { status: 201, statusText: 'Created' });
      await page.settle();
      expect(page.text('.cf-sent')).toContain('12345678');
    });

    it('puts a list item error on its list, and an error of a field the page has not on no field, in the order of the page', async () => {
      const { page, http } = await setup();
      await page.fillValid();
      await page.submit();
      problem(expectPost(http), 400, {
        title: 'Invalid',
        errors: {
          'interestedServices[0]': ['Select a valid services option.'],
          'customer.name': ['Name must be between 2 and 100 characters.'],
          body: ['A JSON object is required.'],
        },
      });
      await page.settle();
      expect(page.summaryLinks()).toEqual(['Name: Name must be between 2 and 100 characters.', 'Services: Select a valid services option.']);
      expect(page.text('.summary')).toContain('3 problems to fix');
      expect(page.text('.summary')).not.toMatch(/JSON object|body/);
      expect(page.text('#cf-services-error')).toBe('Error: Select a valid services option.');
    });

    it('shows the 429 sentence and how long to wait, and lets the visitor try again', async () => {
      const { page, http } = await setup();
      await page.fillValid();
      await page.submit();
      problem(expectPost(http), 429, { title: 'Too Many Requests', detail: 'Too many consultation requests. Please try again later.' }, { 'retry-after': '600' });
      await page.settle();
      expect(page.text('[role="alert"]')).toContain('Too many consultation requests. Please try again later.');
      expect(page.text('[role="alert"]')).toContain('try again in 10 minutes');
      expect(page.submitButton.disabled).toBe(false);
      expect(page.$<HTMLInputElement>('#cf-name').value).toBe('Ada Lovelace');
    });

    it('shows the cooldown sentence of a 429 with no Retry-After as it is', async () => {
      const { page, http } = await setup();
      await page.fillValid();
      await page.submit();
      problem(expectPost(http), 429, { title: 'Too Many Requests', detail: 'Please wait 10 minutes between requests.' });
      await page.settle();
      expect(page.text('[role="alert"]')).toContain('Please wait 10 minutes between requests.');
      expect(page.text('[role="alert"]')).not.toContain('try again in');
    });

    for (const answer of ['503', 'network'] as const) {
      it(`says offline for ${answer === '503' ? 'a 503' : 'no answer'}, and keeps the input`, async () => {
        const { page, http } = await setup();
        await page.fillValid();
        await page.submit();
        const req = expectPost(http);
        if (answer === '503') {
          problem(req, 503, { title: 'Service unavailable' }, { 'retry-after': '30' });
        } else {
          req.error(new ProgressEvent('error'));
        }
        await page.settle();
        expect(page.text('[role="alert"]')).toContain(OFFLINE_COPY);
        expect(page.submitButton.disabled).toBe(false);
        expect(page.$<HTMLInputElement>('#cf-email').value).toBe('ada@example.com');
      });
    }

    for (const status of [413, 415, 500]) {
      it(`takes a ${status} as a generic failure with the contact line, never showing the server text`, async () => {
        const { page, http } = await setup();
        await page.fillValid();
        await page.submit();
        problem(expectPost(http), status, { title: 'Stack trace here', detail: 'secret detail' });
        await page.settle();
        const alert = page.text('[role="alert"]');
        expect(alert).toContain('Your request could not be sent');
        expect(alert).toContain('jackson@actionjacksoninstalls.com');
        expect(alert).not.toMatch(/Stack trace|secret detail/);
        expect(page.submitButton.disabled).toBe(false);
      });
    }

    it('takes a 400 without usable errors as a generic failure', async () => {
      const { page, http } = await setup();
      await page.fillValid();
      await page.submit();
      problem(expectPost(http), 400, { title: 'Bad Request' });
      await page.settle();
      expect(page.text('[role="alert"]')).toContain('Your request could not be sent');
    });
  });
});
