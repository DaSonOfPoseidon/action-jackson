import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, Injector, afterNextRender, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { FormField, form, maxLength, validate } from '@angular/forms/signals';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  type ApiProblem,
  ApiClient,
  FormStatus,
  type FormStatusError,
  type FormStatusState,
  OFFLINE_COPY,
  SOCIALS,
  isOffline,
  mapFieldErrors,
  retryText,
} from '@aj/shared';
import { BOOKING_OPTIONS, LIMITS } from '../data/options';
import { availabilityWindow, chicagoDate, chicagoWhen, formatDay, formatTime, isDay } from './booking-dates';
import { uuidV4 } from './uuid';

interface BookingModel {
  quoteNumber: string;
  email: string;
  kind: string;
  // Whole hours, as text, for a drops-only install.
  hours: string;
  phone: string;
  notes: string;
}

const EMPTY: BookingModel = { quoteNumber: '', email: '', kind: '', hours: '2', phone: '', notes: '' };

const SURVEY = 'survey';
const DROPS_ONLY_INSTALL = 'drops-only-install';

// A quote number: eight digits (it is also what POST /api/lan/quotes answers with, and what ?quote= carries).
const QUOTE_NUMBER = /^\d{8}$/;
const TIME = /^\d{2}:\d{2}$/;
// An instant with its offset, as the API writes it (2026-11-30T09:00:00-06:00).
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/;

const OTHER_ERROR = 'Part of your request could not be accepted. Check your answers and send it again.';
const CONTACT_EMAIL = SOCIALS.find((social) => social.key === 'email')!;

// The lengths a drops-only install can take: whole hours of the contract's range.
const HOURS = Array.from(
  { length: LIMITS.booking.durationMinutes.max / 60 - LIMITS.booking.durationMinutes.min / 60 + 1 },
  (_, i) => String(LIMITS.booking.durationMinutes.min / 60 + i),
);

// One line on each kind, keyed by the contract's value. They state what the API's rules are (BookingKinds), no more.
const KIND_TEXT: Readonly<Record<string, string>> = {
  [SURVEY]: 'A 2-hour visit to look at the home and plan the work.',
  [DROPS_ONLY_INSTALL]: 'A cable install. You choose how long it will take.',
  'whole-home-install': 'The whole day (12 hours), starting when we open.',
};

// One open day: its date and its start times ("HH:mm", Chicago time).
interface OpenDay {
  readonly date: string;
  readonly starts: readonly string[];
}

// The open times of the window on the page.
type Slots =
  | { readonly state: 'loading' }
  | { readonly state: 'ok'; readonly days: readonly OpenDay[] }
  // The API cannot be reached.
  | { readonly state: 'offline' }
  // The limiter said wait.
  | { readonly state: 'limited'; readonly retryAfter?: number }
  | { readonly state: 'failed' };

// What the confirmation shows of the 201: only what the answer really held.
interface Booked {
  readonly reference: string;
  readonly kindLabel: string;
  readonly starts: string;
  readonly ends: string;
}

// The answer is untrusted input: keep the days that are a date with a list of times, and the times that are "HH:mm".
function parseDays(body: unknown): OpenDay[] {
  const days = (body as { days?: unknown } | null)?.days;
  if (!Array.isArray(days)) {
    return [];
  }
  const open: OpenDay[] = [];
  for (const day of days as unknown[]) {
    const item = day as { date?: unknown; starts?: unknown } | null;
    if (typeof item?.date !== 'string' || !isDay(item.date) || !Array.isArray(item.starts)) {
      continue;
    }
    const starts = (item.starts as unknown[]).filter((start): start is string => typeof start === 'string' && isTime(start));
    if (starts.length > 0) {
      open.push({ date: item.date, starts });
    }
  }
  return open;
}

function isTime(text: string): boolean {
  const match = TIME.test(text) ? text.split(':').map(Number) : null;
  return match !== null && match[0] < 24 && match[1] < 60;
}

// "2026-11-30T09:00:00-06:00" as a Chicago day and time, or null when it is not an instant.
function when(value: unknown): { date: string; time: string } | null {
  if (typeof value !== 'string' || !INSTANT.test(value)) {
    return null;
  }
  const instant = new Date(value);
  return Number.isNaN(instant.getTime()) ? null : chicagoWhen(instant);
}

interface FieldInfo {
  readonly path: string;
  readonly id: string;
  readonly label: string;
  readonly active: () => boolean;
  readonly state: () => { readonly errors: () => readonly { readonly message?: string }[]; readonly touched: () => boolean };
}

// The booking form (POST /api/lan/appointments): a quote's number and email, a kind, and a day and time chosen from the
// open ones (GET /api/lan/availability). Its kinds and limits come from contracts/lan-options.json.
//
// Days and times are Chicago time, the business's (the API takes and answers local ones): the window of open days starts at
// today's date in Chicago, never the UTC date. The page is prerendered and calls no API while it renders: the open times are
// asked for only in the browser, once a kind is chosen.
//
// Each submit carries an Idempotency-Key. It stays the same while the request is the same, so a retry after an offline answer
// that did reach the API is answered with the first result and books once; any change makes a new key.
@Component({
  selector: 'aj-booking-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormField, FormStatus, RouterLink],
  template: `
    @if (!sent()) {
      <form class="cform" method="post" novalidate (submit)="submit($event)" aria-labelledby="bf-title">
        <h2 id="bf-title" class="sr-only">Appointment request</h2>

        <!-- The trap for bots: off screen (not display: none), out of the tab order and the accessibility tree. It is always sent. -->
        <div class="cf-trap" aria-hidden="true">
          <label for="bf-honeypot">Leave this field blank</label>
          <input #honeypot id="bf-honeypot" type="text" name="honeypot" tabindex="-1" autocomplete="off" />
        </div>

        <p class="cf-note">Fields marked <span aria-hidden="true">*</span><span class="sr-only">with an asterisk</span> are required.</p>

        <fieldset class="cf-set">
          <legend><span class="cf-step" aria-hidden="true">1</span><span>Your quote</span></legend>
          <div class="cf-grid">
            <div class="cf-field">
              <label for="bf-quote-number">Quote number <span aria-hidden="true">*</span></label>
              <input
                id="bf-quote-number"
                type="text"
                inputmode="numeric"
                autocomplete="off"
                aria-required="true"
                [formField]="f.quoteNumber"
                [attr.aria-invalid]="invalid('quoteNumber')"
                [attr.aria-describedby]="describedBy('quoteNumber', 'bf-quote-number-error')"
                (input)="clearServer('quoteNumber', 'kind')"
              />
              @if (errorText('quoteNumber'); as text) {
                <p id="bf-quote-number-error" class="cf-error"><span class="sr-only">Error: </span>{{ text }}</p>
              }
            </div>
            <div class="cf-field">
              <label for="bf-email">Email on the quote <span aria-hidden="true">*</span></label>
              <input
                id="bf-email"
                type="email"
                autocomplete="email"
                spellcheck="false"
                aria-required="true"
                [formField]="f.email"
                [attr.aria-invalid]="invalid('email')"
                [attr.aria-describedby]="describedBy('email', 'bf-email-error')"
                (input)="clearServer('email', 'kind')"
              />
              @if (errorText('email'); as text) {
                <p id="bf-email-error" class="cf-error"><span class="sr-only">Error: </span>{{ text }}</p>
              }
            </div>
          </div>
          <p class="cf-hint qf-gap">
            Don't have a quote number yet? <a class="accent-link" routerLink="/quote">Get a quote</a>.
          </p>
        </fieldset>

        <fieldset class="cf-set" [attr.aria-describedby]="describedBy('kind', 'bf-kind-error')">
          <legend><span class="cf-step" aria-hidden="true">2</span><span>What are you booking? <span aria-hidden="true">*</span></span></legend>
          <div class="cf-choices">
            @for (option of kinds; track option.value; let i = $index) {
              <label class="cf-choice">
                <input type="radio" [id]="'bf-kind-' + i" [value]="option.value" [formField]="f.kind" (change)="clearServer('kind', 'date', 'time')" />
                <span>
                  <span class="qf-kind-name">{{ option.label }}</span>
                  <span class="qf-kind-desc">{{ kindText[option.value] }}</span>
                </span>
              </label>
            }
          </div>
          @if (errorText('kind'); as text) {
            <p id="bf-kind-error" class="cf-error"><span class="sr-only">Error: </span>{{ text }}</p>
          }
          @if (model().kind === dropsOnlyInstall) {
            <div class="cf-field qf-gap">
              <label for="bf-hours">How long should we plan for?</label>
              <select
                id="bf-hours"
                [formField]="f.hours"
                [attr.aria-invalid]="invalid('durationMinutes')"
                [attr.aria-describedby]="describedBy('durationMinutes', 'bf-hours-error')"
                (change)="clearServer('durationMinutes', 'date', 'time')"
              >
                @for (hours of lengths; track hours) {
                  <option [value]="hours">{{ hours === '1' ? '1 hour' : hours + ' hours' }}</option>
                }
              </select>
              @if (errorText('durationMinutes'); as text) {
                <p id="bf-hours-error" class="cf-error"><span class="sr-only">Error: </span>{{ text }}</p>
              }
            </div>
          }
        </fieldset>

        <fieldset id="bf-slot" class="cf-set bf-slot" tabindex="-1" [attr.aria-describedby]="slotError() ? 'bf-slot-error' : null">
          <legend><span class="cf-step" aria-hidden="true">3</span><span>Choose a day and a time <span aria-hidden="true">*</span></span></legend>
          @if (!model().kind) {
            <p class="cf-hint">Choose what you are booking to see the open days. All times are Central Time.</p>
          } @else {
            <div class="bf-nav">
              <button type="button" id="bf-earlier" class="btn btn-outline btn-md" [disabled]="!hasEarlier()" (click)="move(-1)">Earlier</button>
              <p class="bf-window">{{ windowText() }}</p>
              <button type="button" id="bf-later" class="btn btn-outline btn-md" [disabled]="!hasLater()" (click)="move(1)">Later</button>
            </div>
            <div class="bf-slots-live" role="status" aria-live="polite">
              @switch (slots().state) {
                @case ('loading') {
                  <p class="bf-slots-note">Loading open times…</p>
                }
                @case ('offline') {
                  <p class="bf-slots-note">{{ offline }}</p>
                }
                @case ('limited') {
                  <p class="bf-slots-note">Too many requests just now.{{ waitText() }}</p>
                }
                @case ('failed') {
                  <p class="bf-slots-note">Open times can't be shown right now.</p>
                }
                @case ('ok') {
                  @if (openDays().length === 0) {
                    <p class="bf-slots-note">No open times in this window.{{ hasLater() ? ' Try the later days.' : '' }}</p>
                  }
                }
              }
            </div>
            @if (slotsFailed()) {
              <button type="button" id="bf-slots-retry" class="btn btn-outline btn-md" (click)="refreshSlots()">Try again</button>
            }
            @if (openDays().length > 0) {
              <ul class="bf-days" role="list">
                @for (day of openDays(); track day.date) {
                  <li>
                    <button
                      type="button"
                      class="bf-day"
                      [id]="'bf-day-' + day.date"
                      [attr.aria-pressed]="chosenDate() === day.date"
                      (click)="chooseDay(day.date)"
                    >{{ formatDay(day.date) }}</button>
                  </li>
                }
              </ul>
              @if (chosenTimes().length > 0) {
                <fieldset class="bf-times">
                  <legend>Start times on {{ formatDay(chosenDate()) }} (Central Time)</legend>
                  <div class="cf-choices">
                    @for (time of chosenTimes(); track time; let i = $index) {
                      <label class="cf-choice">
                        <input type="radio" name="bf-time" [id]="'bf-time-' + i" [attr.value]="time" [checked]="chosenTime() === time" (change)="chooseTime(time)" />
                        <span>{{ formatTime(time) }}</span>
                      </label>
                    }
                  </div>
                </fieldset>
              }
            }
          }
          @if (slotError(); as text) {
            <p id="bf-slot-error" class="cf-error qf-gap"><span class="sr-only">Error: </span>{{ text }}</p>
          }
        </fieldset>

        <fieldset class="cf-set">
          <legend><span class="cf-step" aria-hidden="true">4</span><span>Anything else <span class="cf-optional">(optional)</span></span></legend>
          <div class="cf-field">
            <label for="bf-phone">Phone</label>
            <input
              id="bf-phone"
              type="tel"
              autocomplete="tel"
              [formField]="f.phone"
              [attr.aria-invalid]="invalid('phone')"
              [attr.aria-describedby]="describedBy('phone', 'bf-phone-error')"
              (input)="clearServer('phone')"
            />
            @if (errorText('phone'); as text) {
              <p id="bf-phone-error" class="cf-error"><span class="sr-only">Error: </span>{{ text }}</p>
            }
          </div>
          <div class="cf-field qf-gap">
            <label for="bf-notes">Notes</label>
            <textarea
              id="bf-notes"
              rows="3"
              [formField]="f.notes"
              [attr.aria-invalid]="invalid('notes')"
              [attr.aria-describedby]="describedBy('notes', 'bf-notes-error')"
              (input)="clearServer('notes')"
            ></textarea>
            @if (errorText('notes'); as text) {
              <p id="bf-notes-error" class="cf-error"><span class="sr-only">Error: </span>{{ text }}</p>
            }
          </div>
        </fieldset>

        @if (!ready()) {
          <p class="cf-wait">
            This form switches on once the page has loaded, and it needs JavaScript. Without it, email
            <a [href]="contact.href">{{ contact.label }}</a>.
          </p>
        }
        <button #submitButton type="submit" class="btn btn-primary btn-lg btn-block cf-submit" [disabled]="!ready() || sending()">
          {{ sending() ? 'Sending…' : 'Book Appointment' }}
        </button>
      </form>
    }

    <aj-form-status class="cf-status" [state]="status()" [contact]="'You can also email ' + contact.label + '.'">
      @if (booked(); as appointment) {
        <div class="cf-sent">
          <h2 #sentHeading tabindex="-1">Appointment booked</h2>
          @if (appointment.reference) {
            <p>Your reference is <strong class="mono">{{ appointment.reference }}</strong>.</p>
          } @else {
            <p>Your appointment was booked.</p>
          }
          @if (appointment.kindLabel) {
            <p class="bf-kind-booked">{{ appointment.kindLabel }}</p>
          }
          @if (appointment.starts) {
            <dl class="bf-when">
              <div><dt>Starts</dt><dd>{{ appointment.starts }}</dd></div>
              @if (appointment.ends) {
                <div><dt>Ends</dt><dd>{{ appointment.ends }}</dd></div>
              }
            </dl>
          }
          <p>We'll contact you before the appointment to confirm.</p>
          <a class="btn btn-outline btn-lg gradient-border" routerLink="/">Back to Home</a>
        </div>
      }
    </aj-form-status>
  `,
})
export class BookingForm {
  private readonly api = inject(ApiClient);
  private readonly injector = inject(Injector);
  private readonly document = inject(DOCUMENT);
  private readonly route = inject(ActivatedRoute);

  protected readonly kinds = BOOKING_OPTIONS.kinds;
  protected readonly kindText = KIND_TEXT;
  protected readonly lengths = HOURS;
  protected readonly dropsOnlyInstall = DROPS_ONLY_INSTALL;
  protected readonly offline = OFFLINE_COPY;
  protected readonly contact = CONTACT_EMAIL;
  protected readonly formatDay = formatDay;
  protected readonly formatTime = formatTime;

  protected readonly model = signal<BookingModel>({ ...EMPTY, ...this.prefill() });
  protected readonly f = form(this.model, (path) => {
    validate(path.quoteNumber, ({ value }) => (QUOTE_NUMBER.test(value().trim()) ? undefined : { kind: 'quoteNumber', message: 'Enter the 8-digit quote number.' }));
    validate(path.email, ({ value }) => {
      const email = value().trim();
      if (!email) {
        return { kind: 'required', message: 'Enter your email address.' };
      }
      // Only the shape: something, an @, something, a dot, something. The API decides what is a valid address.
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? undefined : { kind: 'email', message: 'Enter a valid email address.' };
    });
    validate(path.kind, ({ value }) => (value() ? undefined : { kind: 'required', message: 'Choose the kind of appointment.' }));
    maxLength(path.notes, LIMITS.booking.notesLength, { message: `Use at most ${LIMITS.booking.notesLength} characters.` });
  });

  // The page makes no API call and sends nothing until the app is running in the browser.
  protected readonly ready = signal(false);
  protected readonly sending = signal(false);
  protected readonly status = signal<FormStatusState>({ kind: 'idle' });
  protected readonly sent = signal(false);
  protected readonly booked = signal<Booked | null>(null);

  // The day it is in Chicago (the window of open days starts there) and which window of 31 days is on the page.
  private readonly today = signal(chicagoDate(new Date()));
  protected readonly windowIndex = signal(0);
  protected readonly slots = signal<Slots>({ state: 'loading' });
  protected readonly chosenDate = signal('');
  protected readonly chosenTime = signal('');
  // Bumped for every request for open times: an answer of an older one finds a different number and is dropped.
  private slotRequest = 0;

  private readonly attempted = signal(false);
  private readonly serverErrors = signal<Readonly<Record<string, readonly string[]>>>({});
  // The fields edited since the request went out: the API judged their old values, so its errors for them are dropped.
  private readonly editedWhileSending = new Set<string>();

  // The Idempotency-Key of the request last sent, and the request (as text) it belongs to.
  private idempotencyKey = '';
  private sentSignature = '';

  private readonly honeypot = viewChild<ElementRef<HTMLInputElement>>('honeypot');
  private readonly sentHeading = viewChild<ElementRef<HTMLElement>>('sentHeading');
  private readonly submitButton = viewChild<ElementRef<HTMLButtonElement>>('submitButton');

  protected readonly openDays = computed(() => {
    const slots = this.slots();
    return slots.state === 'ok' ? slots.days : [];
  });
  protected readonly chosenTimes = computed(() => this.openDays().find((day) => day.date === this.chosenDate())?.starts ?? []);
  protected readonly slotsFailed = computed(() => ['offline', 'limited', 'failed'].includes(this.slots().state));
  protected readonly hasEarlier = computed(() => this.windowIndex() > 0);
  protected readonly hasLater = computed(() => availabilityWindow(this.today(), this.windowIndex() + 1, LIMITS.booking.daysAhead) !== null);
  protected readonly windowText = computed(() => {
    const window = availabilityWindow(this.today(), this.windowIndex(), LIMITS.booking.daysAhead);
    return window ? `${formatDay(window.from)} to ${formatDay(window.to)}` : '';
  });
  protected readonly waitText = computed(() => {
    const slots = this.slots();
    const wait = slots.state === 'limited' ? retryText(slots.retryAfter) : '';
    return wait ? ` You can ${wait}.` : '';
  });

  // What the open-times request depends on, as text: the effect below runs again only when this changes, not on every key
  // elsewhere in the form. Null before a kind is chosen.
  private readonly slotKey = computed(() => {
    const model = this.model();
    if (!model.kind) {
      return null;
    }
    const minutes = model.kind === DROPS_ONLY_INSTALL ? Number(model.hours) * 60 : undefined;
    return JSON.stringify({ kind: model.kind, minutes, index: this.windowIndex() });
  });

  // The day and time messages together, for the slot picker.
  protected readonly slotError = computed(() => [this.messages()['date'], this.messages()['time']].filter(Boolean).flat().join(' '));

  private readonly fields: readonly FieldInfo[] = this.buildFields();

  private readonly messages = computed(() => {
    const shown: Record<string, readonly string[]> = {};
    const attempted = this.attempted();
    const server = this.serverErrors();
    for (const field of this.fields) {
      if (!field.active()) {
        continue;
      }
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
    afterNextRender(() => {
      this.today.set(chicagoDate(new Date()));
      this.ready.set(true);
    });

    // Asks for the open times when a kind is chosen, and again when the kind, the length or the window changes.
    effect(() => {
      const key = this.slotKey();
      if (!this.ready() || key === null) {
        return;
      }
      untracked(() => void this.loadSlots(key));
    });
  }

  // The quote number from ?quote= (only when it is eight digits), and the email the quote page left in the navigation state.
  // Neither is ever written into a URL by this page.
  private prefill(): Partial<BookingModel> {
    const prefill: Partial<BookingModel> = {};
    const quote = this.route.snapshot.queryParamMap.get('quote');
    if (quote !== null && QUOTE_NUMBER.test(quote)) {
      prefill.quoteNumber = quote;
    }
    try {
      const email = (this.document.defaultView?.history.state as { email?: unknown } | null)?.email;
      if (typeof email === 'string') {
        prefill.email = email;
      }
    } catch {
      // No history (the page is being prerendered): nothing to prefill.
    }
    return prefill;
  }

  private buildFields(): readonly FieldInfo[] {
    const always = () => true;
    const info = (path: string, id: string, label: string, state: FieldInfo['state'], active: () => boolean = always): FieldInfo => ({ path, id, label, state, active });
    // A message the form has no field for (a limit of the API's, or a rule of the picker): it shows after a submit was tried.
    const rule = (message: string, failing: () => boolean): FieldInfo['state'] => () => ({
      errors: () => (failing() ? [{ message }] : []),
      touched: () => false,
    });
    // Nothing of the client's: only what the API says about it.
    const serverOnly: FieldInfo['state'] = () => ({ errors: () => [], touched: () => false });
    return [
      info('quoteNumber', 'bf-quote-number', 'Quote number', () => this.f.quoteNumber()),
      info('email', 'bf-email', 'Email', () => this.f.email()),
      info('kind', 'bf-kind-0', 'Appointment type', () => this.f.kind()),
      info('durationMinutes', 'bf-hours', 'Length', serverOnly, () => this.model().kind === DROPS_ONLY_INSTALL),
      info('date', 'bf-slot', 'Day', rule('Choose a day.', () => !this.chosenDate())),
      info('time', 'bf-slot', 'Time', rule('Choose a start time.', () => !!this.chosenDate() && !this.chosenTime())),
      info('phone', 'bf-phone', 'Phone', serverOnly),
      info('notes', 'bf-notes', 'Notes', () => this.f.notes()),
    ];
  }

  // Asks for the open days of the window and kind in `key`. The answer counts only if it is still the newest request.
  private async loadSlots(key: string): Promise<void> {
    const { kind, minutes, index } = JSON.parse(key) as { kind: string; minutes?: number; index: number };
    const id = ++this.slotRequest;
    this.today.set(chicagoDate(new Date()));
    const window = availabilityWindow(this.today(), index, LIMITS.booking.daysAhead);
    if (!window) {
      // The day moved on while the page was open and this window is now past the limit: start again from today.
      this.windowIndex.set(0);
      return;
    }
    this.slots.set({ state: 'loading' });
    const params: Record<string, string> = { from: window.from, to: window.to, kind };
    if (minutes !== undefined) {
      params['durationMinutes'] = String(minutes);
    }
    try {
      const days = parseDays(await firstValueFrom(this.api.get<unknown>('availability', params)));
      if (id !== this.slotRequest) {
        return;
      }
      this.slots.set({ state: 'ok', days });
      this.dropChoiceNotListed(days);
    } catch (error) {
      if (id !== this.slotRequest) {
        return;
      }
      const problem = error as ApiProblem;
      this.slots.set(problem.status === 429 ? { state: 'limited', retryAfter: problem.retryAfter } : isOffline(problem) ? { state: 'offline' } : { state: 'failed' });
      // The picker is gone, so the choice made in it is too: a day that is not on the page is never sent.
      this.chosenDate.set('');
      this.chosenTime.set('');
    }
  }

  // The chosen time goes when its day no longer lists it, and the chosen day when it is no longer open.
  private dropChoiceNotListed(days: readonly OpenDay[]): void {
    const day = days.find((open) => open.date === this.chosenDate());
    if (!day) {
      this.chosenDate.set('');
      this.chosenTime.set('');
    } else if (!day.starts.includes(this.chosenTime())) {
      this.chosenTime.set('');
    }
  }

  protected refreshSlots(): void {
    const key = untracked(this.slotKey);
    if (key !== null) {
      void this.loadSlots(key);
    }
  }

  protected move(step: number): void {
    this.windowIndex.update((index) => index + step);
  }

  protected chooseDay(date: string): void {
    if (this.chosenDate() !== date) {
      this.chosenDate.set(date);
      this.chosenTime.set('');
    }
    this.clearServer('date');
    this.clearServer('time');
  }

  protected chooseTime(time: string): void {
    this.chosenTime.set(time);
    this.clearServer('date');
    this.clearServer('time');
  }

  protected errorText(path: string): string {
    return this.messages()[path]?.join(' ') ?? '';
  }

  protected invalid(path: string): 'true' | null {
    return this.messages()[path] ? 'true' : null;
  }

  protected describedBy(path: string, errorId: string, hintId?: string): string | null {
    const ids = [hintId, this.messages()[path] ? errorId : undefined].filter((id): id is string => !!id);
    return ids.length > 0 ? ids.join(' ') : null;
  }

  // An edit makes what the API said about these fields out of date. The quote number and the email pick the quote, and the
  // "wrong kind of quote" answer on `kind` depends on that quote, so an edit of either clears it too.
  // While a request is out its answer is not here yet: the fields are noted, and their errors are dropped when it comes.
  protected clearServer(...paths: string[]): void {
    if (this.sending()) {
      paths.forEach((path) => this.editedWhileSending.add(path));
    }
    if (paths.some((path) => this.serverErrors()[path])) {
      this.serverErrors.update((errors) => Object.fromEntries(Object.entries(errors).filter(([path]) => !paths.includes(path))));
    }
  }

  protected async submit(event: Event): Promise<void> {
    // Never a native submit: the request is sent below, or nothing is.
    event.preventDefault();
    if (!this.ready() || this.sending()) {
      return;
    }
    this.attempted.set(true);
    const problems = this.summary();
    if (problems.length > 0) {
      this.status.set({ kind: 'invalid', errors: problems, other: [] });
      return;
    }

    const keyboardOnButton = this.submitButton()?.nativeElement === this.document.activeElement;
    this.sending.set(true);
    this.serverErrors.set({});
    this.editedWhileSending.clear();
    this.status.set({ kind: 'sending' });
    try {
      const body = this.payload();
      const answer = await firstValueFrom(
        this.api.post<Record<string, unknown> | null>('appointments', body, { headers: { 'Idempotency-Key': this.keyFor(body) } }),
      );
      this.booked.set(this.bookedFrom(answer));
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

  // The same request keeps its key, so a retry the API already saw is answered with the first result; any change to the
  // request makes a new one.
  private keyFor(body: object): string {
    const signature = JSON.stringify(body);
    if (signature !== this.sentSignature || !this.idempotencyKey) {
      this.sentSignature = signature;
      this.idempotencyKey = uuidV4();
    }
    return this.idempotencyKey;
  }

  private bookedFrom(answer: Record<string, unknown> | null): Booked {
    const reference = typeof answer?.['reference'] === 'string' && QUOTE_NUMBER.test(answer['reference']) ? answer['reference'] : '';
    const answered = BOOKING_OPTIONS.kinds.find((kind) => kind.value === answer?.['kind']);
    const kindLabel = (answered ?? BOOKING_OPTIONS.kinds.find((kind) => kind.value === this.model().kind))?.label ?? '';
    const start = when(answer?.['startsAt']);
    const end = when(answer?.['endsAt']);
    const text = (instant: { date: string; time: string } | null): string => (instant ? `${instant.date}, ${instant.time} Central Time` : '');
    return { reference, kindLabel, starts: text(start), ends: start ? text(end) : '' };
  }

  private summary(): FormStatusError[] {
    const shown = this.messages();
    return this.fields.flatMap((field) => (field.active() && shown[field.path] ? [{ fieldId: field.id, label: field.label, message: shown[field.path][0] }] : []));
  }

  // What the API accepts: text is trimmed, optional fields left empty are left out, the length is always sent for a drops-only
  // install (and for no other kind), and the trap field is always there.
  private payload(): object {
    const model = this.model();
    const text = (value: string): string | undefined => value.trim() || undefined;
    return {
      quoteNumber: model.quoteNumber.trim(),
      email: model.email.trim(),
      kind: model.kind,
      date: this.chosenDate(),
      time: this.chosenTime(),
      durationMinutes: model.kind === DROPS_ONLY_INSTALL ? Number(model.hours) * 60 : undefined,
      phone: text(model.phone),
      notes: text(model.notes),
      honeypot: this.honeypot()?.nativeElement.value ?? '',
    };
  }

  // What went wrong, said once. Field errors go on their fields (a day or time the API refused also refreshes the open
  // times); a refusal with its own sentence (no such quote, already booked, the time taken) shows that sentence, and a taken
  // time refreshes the list; a limit or an outage is a notice; the rest is a generic one. Everything typed stays.
  private fail(problem: ApiProblem): void {
    if (problem.status === 400 && problem.errors) {
      const sorted = mapFieldErrors(problem.errors, this.fields.map((field) => field.path), OTHER_ERROR);
      if (Object.keys(sorted.byField).length > 0 || sorted.other.length > 0) {
        // A field the visitor corrected while the request was out keeps no error: it was about the value they replaced.
        const byField = Object.fromEntries(Object.entries(sorted.byField).filter(([path]) => !this.editedWhileSending.has(path)));
        this.serverErrors.set(byField);
        if (Object.keys(byField).length === 0 && sorted.other.length === 0) {
          this.status.set({ kind: 'idle' });
          return;
        }
        this.status.set({ kind: 'invalid', errors: this.summary(), other: sorted.other });
        if (byField['date'] || byField['time']) {
          this.refreshSlots();
        }
        return;
      }
    }
    if (problem.status === 429) {
      this.status.set({ kind: 'rate-limited', detail: problem.detail, retryAfter: problem.retryAfter });
    } else if ([404, 409, 422].includes(problem.status) && problem.detail) {
      this.status.set({ kind: 'failed', detail: problem.detail });
      if (problem.status === 409) {
        this.refreshSlots();
      }
    } else if (isOffline(problem)) {
      this.status.set({ kind: 'offline' });
    } else {
      this.status.set({ kind: 'failed' });
    }
  }
}
