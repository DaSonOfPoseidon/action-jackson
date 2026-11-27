import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, Injector, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { FormField, form, maxLength, validate } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  type ApiProblem,
  ApiClient,
  FormStatus,
  type FormStatusError,
  type FormStatusState,
  SOCIALS,
  isOffline,
  mapFieldErrors,
} from '@aj/shared';
import { CONSULTATION_OPTIONS, ISP_MAX_LENGTH, type Option } from '../data/options';

// What the page keeps while a visitor fills the form. Optional text is kept as typed and trimmed when it is sent.
interface ConsultationModel {
  name: string;
  email: string;
  phone: string;
  squareFootage: string;
  isp: string;
  issues: string[];
  services: string[];
  interestedPackage: string;
}

const EMPTY: ConsultationModel = { name: '', email: '', phone: '', squareFootage: '', isp: '', issues: [], services: [], interestedPackage: '' };

// POST /api/lan/consultations answers 201 with the request number: eight digits.
const REQUEST_NUMBER = /^\d{8}$/;

// The one sentence for an error that belongs to no field of the form (an unreadable body, the trap field, a path this
// page doesn't have). The API's own text for it, and its key, are never shown.
const OTHER_ERROR = 'Part of your request could not be accepted. Check your answers and send it again.';

// The email address the page offers beside a failure and while the page is not yet running.
const CONTACT_EMAIL = SOCIALS.find((social) => social.key === 'email')!;

// One place on the page an API error path can land: the JSON path the API uses, the id of the control to focus, and the label.
interface FieldInfo {
  readonly path: string;
  readonly id: string;
  readonly label: string;
  // The form's own state for it (client checks, touched).
  readonly state: () => { readonly errors: () => readonly { readonly message?: string }[]; readonly touched: () => boolean };
}

// The consultation request form (POST /api/lan/consultations). Its option lists come from contracts/lan-options.json.
//
// The page is prerendered, so it never calls the API while it renders (invariant 6). Its submit button is disabled in the
// prerendered HTML and turns on only after the app has started in the browser: before that a click or Enter would
// submit the form natively, and a GET would put the visitor's email in the URL. The form is method="post" as a second
// guard, and a note says what is going on until it is ready.
//
// Client checks are only a convenience: they state what the contract says (what is required, how many choices, the ISP's
// length). The name and phone formats are the API's: its 400 is shown on the field.
@Component({
  selector: 'aj-consultation-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormField, FormStatus, RouterLink],
  template: `
    @if (!sent()) {
      <form class="cform" method="post" novalidate (submit)="submit($event)" aria-labelledby="cf-title">
        <h2 id="cf-title" class="sr-only">Consultation request</h2>

        <!-- The trap for bots: off screen (not display: none), out of the tab order and the accessibility tree. It is always sent. -->
        <div class="cf-trap" aria-hidden="true">
          <label for="cf-honeypot">Leave this field blank</label>
          <input #honeypot id="cf-honeypot" type="text" name="honeypot" tabindex="-1" autocomplete="off" />
        </div>

        <p class="cf-note">Fields marked <span aria-hidden="true">*</span><span class="sr-only">with an asterisk</span> are required.</p>

        <fieldset class="cf-set">
          <legend><span class="cf-step" aria-hidden="true">1</span><span>Contact information</span></legend>
          <div class="cf-grid">
            <div class="cf-field">
              <label for="cf-name">Name <span aria-hidden="true">*</span></label>
              <input
                id="cf-name"
                type="text"
                autocomplete="name"
                aria-required="true"
                [formField]="f.name"
                [attr.aria-invalid]="invalid('customer.name')"
                [attr.aria-describedby]="describedBy('customer.name', 'cf-name-error')"
                (input)="clearServer('customer.name')"
              />
              @if (errorText('customer.name'); as text) {
                <p id="cf-name-error" class="cf-error"><span class="sr-only">Error: </span>{{ text }}</p>
              }
            </div>
            <div class="cf-field">
              <label for="cf-email">Email <span aria-hidden="true">*</span></label>
              <input
                id="cf-email"
                type="email"
                autocomplete="email"
                spellcheck="false"
                aria-required="true"
                [formField]="f.email"
                [attr.aria-invalid]="invalid('customer.email')"
                [attr.aria-describedby]="describedBy('customer.email', 'cf-email-error')"
                (input)="clearServer('customer.email')"
              />
              @if (errorText('customer.email'); as text) {
                <p id="cf-email-error" class="cf-error"><span class="sr-only">Error: </span>{{ text }}</p>
              }
            </div>
          </div>
          <div class="cf-field">
            <label for="cf-phone">Phone <span class="cf-optional">(optional)</span></label>
            <input
              id="cf-phone"
              type="tel"
              autocomplete="tel"
              [formField]="f.phone"
              [attr.aria-invalid]="invalid('customer.phone')"
              [attr.aria-describedby]="describedBy('customer.phone', 'cf-phone-error')"
              (input)="clearServer('customer.phone')"
            />
            @if (errorText('customer.phone'); as text) {
              <p id="cf-phone-error" class="cf-error"><span class="sr-only">Error: </span>{{ text }}</p>
            }
          </div>
        </fieldset>

        <fieldset class="cf-set">
          <legend><span class="cf-step" aria-hidden="true">2</span><span>Your property</span></legend>
          <div class="cf-grid">
            <div class="cf-field">
              <label for="cf-square-footage">Square footage <span aria-hidden="true">*</span></label>
              <select
                id="cf-square-footage"
                aria-required="true"
                [formField]="f.squareFootage"
                [attr.aria-invalid]="invalid('property.squareFootage')"
                [attr.aria-describedby]="describedBy('property.squareFootage', 'cf-square-footage-error')"
                (change)="clearServer('property.squareFootage')"
              >
                <option value="">Choose a range</option>
                @for (option of squareFootage; track option.value) {
                  <option [value]="option.value">{{ option.label }}</option>
                }
              </select>
              @if (errorText('property.squareFootage'); as text) {
                <p id="cf-square-footage-error" class="cf-error"><span class="sr-only">Error: </span>{{ text }}</p>
              }
            </div>
            <div class="cf-field">
              <label for="cf-isp">Current internet provider <span class="cf-optional">(optional)</span></label>
              <input
                id="cf-isp"
                type="text"
                autocomplete="off"
                [formField]="f.isp"
                [attr.aria-invalid]="invalid('property.isp')"
                [attr.aria-describedby]="describedBy('property.isp', 'cf-isp-error')"
                (input)="clearServer('property.isp')"
              />
              @if (errorText('property.isp'); as text) {
                <p id="cf-isp-error" class="cf-error"><span class="sr-only">Error: </span>{{ text }}</p>
              }
            </div>
          </div>
        </fieldset>

        <fieldset class="cf-set" [attr.aria-describedby]="describedBy('property.currentIssues', 'cf-issues-error', 'cf-issues-hint')">
          <legend><span class="cf-step" aria-hidden="true">3</span><span>Current issues <span class="cf-optional">(optional)</span></span></legend>
          <p id="cf-issues-hint" class="cf-hint">Select all that apply.</p>
          <div class="cf-choices">
            @for (option of issues; track option.value; let i = $index) {
              <label class="cf-choice">
                <input
                  type="checkbox"
                  [id]="'cf-issue-' + i"
                  [value]="option.value"
                  [checked]="model().issues.includes(option.value)"
                  (change)="toggle('issues', option.value, $event); clearServer('property.currentIssues')"
                />
                <span>{{ option.label }}</span>
              </label>
            }
          </div>
          @if (errorText('property.currentIssues'); as text) {
            <p id="cf-issues-error" class="cf-error"><span class="sr-only">Error: </span>{{ text }}</p>
          }
        </fieldset>

        <fieldset class="cf-set" [attr.aria-describedby]="describedBy('interestedServices', 'cf-services-error', 'cf-services-hint')">
          <legend><span class="cf-step" aria-hidden="true">4</span><span>Services you are interested in <span aria-hidden="true">*</span></span></legend>
          <p id="cf-services-hint" class="cf-hint">Choose at least one.</p>
          <div class="cf-choices">
            @for (option of services; track option.value; let i = $index) {
              <label class="cf-choice">
                <input
                  type="checkbox"
                  [id]="'cf-service-' + i"
                  [value]="option.value"
                  [checked]="model().services.includes(option.value)"
                  (change)="toggle('services', option.value, $event); clearServer('interestedServices')"
                />
                <span>{{ option.label }}</span>
              </label>
            }
          </div>
          @if (errorText('interestedServices'); as text) {
            <p id="cf-services-error" class="cf-error"><span class="sr-only">Error: </span>{{ text }}</p>
          }
        </fieldset>

        <fieldset class="cf-set" [attr.aria-describedby]="describedBy('interestedPackage', 'cf-package-error')">
          <legend><span class="cf-step" aria-hidden="true">5</span><span>Package or scope <span class="cf-optional">(optional)</span></span></legend>
          <div class="cf-choices">
            @for (option of packages; track option.value; let i = $index) {
              <label class="cf-choice">
                <input type="radio" [id]="'cf-package-' + i" [value]="option.value" [formField]="f.interestedPackage" (change)="clearServer('interestedPackage')" />
                <span>{{ option.label }}</span>
              </label>
            }
          </div>
          @if (errorText('interestedPackage'); as text) {
            <p id="cf-package-error" class="cf-error"><span class="sr-only">Error: </span>{{ text }}</p>
          }
        </fieldset>

        @if (!ready()) {
          <p class="cf-wait">
            This form switches on once the page has loaded, and it needs JavaScript. Without it, email
            <a [href]="contact.href">{{ contact.label }}</a>.
          </p>
        }
        <button #submitButton type="submit" class="btn btn-primary btn-lg btn-block cf-submit" [disabled]="!ready() || sending()">
          {{ sending() ? 'Sending…' : 'Submit Consultation Request' }}
        </button>
      </form>
    }

    <aj-form-status class="cf-status" [state]="status()" [contact]="'You can also email ' + contact.label + '.'">
      <div class="cf-sent">
        <h2 #sentHeading tabindex="-1">Request received</h2>
        @if (requestNumber(); as number) {
          <p>Your request number is <strong class="mono">{{ number }}</strong>. Keep it for your records.</p>
        } @else {
          <p>Your request was received.</p>
        }
        <p>We'll review your request and contact you to schedule your consultation.</p>
        <p>Know what you need? <a class="accent-link" routerLink="/quote">Build a quote</a>.</p>
        <a class="btn btn-outline btn-lg gradient-border" routerLink="/">Back to Home</a>
      </div>
    </aj-form-status>
  `,
})
export class ConsultationForm {
  private readonly api = inject(ApiClient);
  private readonly injector = inject(Injector);
  private readonly document = inject(DOCUMENT);

  protected readonly squareFootage = CONSULTATION_OPTIONS.squareFootage;
  protected readonly issues = CONSULTATION_OPTIONS.currentIssues;
  protected readonly services = CONSULTATION_OPTIONS.interestedServices;
  protected readonly packages = CONSULTATION_OPTIONS.interestedPackage;
  protected readonly contact = CONTACT_EMAIL;

  protected readonly model = signal<ConsultationModel>({ ...EMPTY });
  protected readonly f = form(this.model, (path) => {
    validate(path.name, ({ value }) => (value().trim() ? undefined : { kind: 'required', message: 'Enter your name.' }));
    validate(path.email, ({ value }) => {
      const email = value().trim();
      if (!email) {
        return { kind: 'required', message: 'Enter your email address.' };
      }
      // Only the shape: something, an @, something, a dot, something. The API decides what is a valid address.
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? undefined : { kind: 'email', message: 'Enter a valid email address.' };
    });
    validate(path.squareFootage, ({ value }) => (value() ? undefined : { kind: 'required', message: 'Choose your square footage.' }));
    maxLength(path.isp, ISP_MAX_LENGTH, { message: `Use at most ${ISP_MAX_LENGTH} characters.` });
    validate(path.services, ({ value }) => (value().length > 0 ? undefined : { kind: 'required', message: 'Choose at least one service.' }));
  });

  // The page makes no API call and sends nothing until the app is running in the browser.
  protected readonly ready = signal(false);
  protected readonly sending = signal(false);
  protected readonly status = signal<FormStatusState>({ kind: 'idle' });
  // Set by a 201: the form is hidden and the confirmation shown. The number is empty when the answer carried none.
  protected readonly sent = signal(false);
  protected readonly requestNumber = signal('');

  // Set once a submit was tried: from then on every field shows its client error, not only the ones already left.
  private readonly attempted = signal(false);
  // The API's messages by field path, from its last 400. A field's messages go when the visitor changes it.
  private readonly serverErrors = signal<Readonly<Record<string, readonly string[]>>>({});

  private readonly honeypot = viewChild<ElementRef<HTMLInputElement>>('honeypot');
  private readonly sentHeading = viewChild<ElementRef<HTMLElement>>('sentHeading');
  private readonly submitButton = viewChild<ElementRef<HTMLButtonElement>>('submitButton');

  // Every place an error can land, in the order of the page.
  private readonly fields: readonly FieldInfo[] = [
    { path: 'customer.name', id: 'cf-name', label: 'Name', state: () => this.f.name() },
    { path: 'customer.email', id: 'cf-email', label: 'Email', state: () => this.f.email() },
    { path: 'customer.phone', id: 'cf-phone', label: 'Phone', state: () => this.f.phone() },
    { path: 'property.squareFootage', id: 'cf-square-footage', label: 'Square footage', state: () => this.f.squareFootage() },
    { path: 'property.isp', id: 'cf-isp', label: 'Current internet provider', state: () => this.f.isp() },
    { path: 'property.currentIssues', id: 'cf-issue-0', label: 'Current issues', state: () => this.f.issues() },
    { path: 'interestedServices', id: 'cf-service-0', label: 'Services', state: () => this.f.services() },
    { path: 'interestedPackage', id: 'cf-package-0', label: 'Package or scope', state: () => this.f.interestedPackage() },
  ];

  // The messages each field shows now: its own client checks (once it was left, or a submit was tried), else what the API
  // said about it.
  private readonly messages = computed(() => {
    const shown: Record<string, readonly string[]> = {};
    const attempted = this.attempted();
    const server = this.serverErrors();
    for (const field of this.fields) {
      const state = field.state();
      const client = attempted || state.touched() ? state.errors().flatMap((error) => (error.message ? [error.message] : [])) : [];
      const list = client.length > 0 ? client : (server[field.path] ?? []);
      if (list.length > 0) {
        shown[field.path] = list;
      }
    }
    return shown;
  });

  constructor() {
    afterNextRender(() => this.ready.set(true));
  }

  protected errorText(path: string): string {
    return this.messages()[path]?.join(' ') ?? '';
  }

  protected invalid(path: string): 'true' | null {
    return this.messages()[path] ? 'true' : null;
  }

  // The hint and the error message of a control, for aria-describedby; null when there is neither.
  protected describedBy(path: string, errorId: string, hintId?: string): string | null {
    const ids = [hintId, this.messages()[path] ? errorId : undefined].filter((id): id is string => !!id);
    return ids.length > 0 ? ids.join(' ') : null;
  }

  protected clearServer(path: string): void {
    if (this.serverErrors()[path]) {
      this.serverErrors.update(({ [path]: _gone, ...rest }) => rest);
    }
  }

  // A checkbox of a list: the model keeps the chosen values; the payload puts them in the contract's order.
  protected toggle(list: 'issues' | 'services', value: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.model.update((model) => ({
      ...model,
      [list]: checked ? [...model[list].filter((v) => v !== value), value] : model[list].filter((v) => v !== value),
    }));
  }

  protected async submit(event: Event): Promise<void> {
    // Never a native submit: the request is sent below, or nothing is.
    event.preventDefault();
    // One request at a time: this runs again for a second click before the button shows it is disabled.
    if (!this.ready() || this.sending()) {
      return;
    }
    this.attempted.set(true);
    const problems = this.summary();
    if (problems.length > 0) {
      this.status.set({ kind: 'invalid', errors: problems, other: [] });
      return;
    }

    // The button is disabled while the request is out, and a browser moves focus off a control that becomes disabled. When
    // the keyboard was on the button, it goes back there once the button is on again (a failure leaves the form in place).
    const keyboardOnButton = this.submitButton()?.nativeElement === this.document.activeElement;
    this.sending.set(true);
    this.serverErrors.set({});
    this.status.set({ kind: 'sending' });
    try {
      const created = await firstValueFrom(this.api.post<{ requestNumber?: unknown }>('consultations', this.payload()));
      const number = typeof created?.requestNumber === 'string' && REQUEST_NUMBER.test(created.requestNumber) ? created.requestNumber : '';
      this.requestNumber.set(number);
      this.sent.set(true);
      this.status.set({ kind: 'sent' });
      afterNextRender(() => this.sentHeading()?.nativeElement.focus(), { injector: this.injector });
    } catch (error) {
      this.fail(error as ApiProblem);
    } finally {
      this.sending.set(false);
      if (keyboardOnButton && !this.sent() && this.status().kind !== 'invalid') {
        afterNextRender(() => this.submitButton()?.nativeElement.focus(), { injector: this.injector });
      }
    }
  }

  // The summary entries of the fields that show a message, in the order of the page.
  private summary(): FormStatusError[] {
    const shown = this.messages();
    return this.fields.flatMap((field) => (shown[field.path] ? [{ fieldId: field.id, label: field.label, message: shown[field.path][0] }] : []));
  }

  // What the API accepts: optional fields left empty are left out, text is trimmed (the API trims too), the lists go in the
  // contract's order, and the trap field is always there.
  private payload(): object {
    const model = this.model();
    const text = (value: string): string | undefined => value.trim() || undefined;
    const chosen = (options: readonly Option[], values: readonly string[]): string[] =>
      options.filter((option) => values.includes(option.value)).map((option) => option.value);
    return {
      customer: { name: model.name.trim(), email: model.email.trim(), phone: text(model.phone) },
      property: { squareFootage: model.squareFootage, isp: text(model.isp), currentIssues: chosen(this.issues, model.issues) },
      interestedServices: chosen(this.services, model.services),
      interestedPackage: model.interestedPackage || undefined,
      honeypot: this.honeypot()?.nativeElement.value ?? '',
    };
  }

  // What went wrong, said once: field errors on the fields, a limit or an outage as a notice, the rest as a generic one.
  // Everything the visitor typed stays, and they can send again.
  private fail(problem: ApiProblem): void {
    if (problem.status === 400 && problem.errors) {
      const sorted = mapFieldErrors(problem.errors, this.fields.map((field) => field.path), OTHER_ERROR);
      if (Object.keys(sorted.byField).length > 0 || sorted.other.length > 0) {
        this.serverErrors.set(sorted.byField);
        this.status.set({ kind: 'invalid', errors: this.summary(), other: sorted.other });
        return;
      }
    }
    if (problem.status === 429) {
      this.status.set({ kind: 'rate-limited', detail: problem.detail, retryAfter: problem.retryAfter });
    } else if (isOffline(problem)) {
      this.status.set({ kind: 'offline' });
    } else {
      this.status.set({ kind: 'failed' });
    }
  }
}
