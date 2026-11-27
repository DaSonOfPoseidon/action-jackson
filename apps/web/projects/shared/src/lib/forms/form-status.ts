import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, Injector, afterNextRender, effect, inject, input, viewChild } from '@angular/core';
import { OFFLINE_COPY } from '../layout/offline-banner';

// One field error in the summary: the id of the control to focus, the field's label and the message.
export interface FormStatusError {
  readonly fieldId: string;
  readonly label: string;
  readonly message: string;
}

// What a form shows about its submit. The page decides the state; this component only says it, in one place, so the
// lan consultation form and the later forms (quote, booking, car) behave and read the same.
export type FormStatusState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'sending' }
  // The content projected into the component (the page's confirmation).
  | { readonly kind: 'sent' }
  // Field errors, plus generic messages for errors that belong to no field (see mapFieldErrors).
  | { readonly kind: 'invalid'; readonly errors: readonly FormStatusError[]; readonly other: readonly string[] }
  // A 429: the problem's own sentence, and the Retry-After in seconds when the answer had one.
  | { readonly kind: 'rate-limited'; readonly detail?: string; readonly retryAfter?: number }
  // The API cannot be reached (status 0 or 503).
  | { readonly kind: 'offline' }
  // Anything else (a 413, a 415, a 500, an answer that is not a problem). With a `detail` the page shows the API's own
  // sentence instead of the generic one: only for answers whose text is written for a visitor (a 404 or a 409 of a booking).
  | { readonly kind: 'failed'; readonly detail?: string };

// "try again in 2 minutes", rounded up, for a wait in seconds. Empty when the answer gave none.
export function retryText(seconds: number | undefined): string {
  if (seconds === undefined || seconds <= 0) {
    return '';
  }
  if (seconds <= 60) {
    return 'try again in about a minute';
  }
  return `try again in ${Math.ceil(seconds / 60)} minutes`;
}

// The one place a form says how its submit went. Both live regions are always in the page and only their content
// comes and goes, because a screen reader announces a change inside an existing region, not a region that appears
// with its text already in it. Progress and the confirmation are polite (role="status"); errors are assertive
// (role="alert"). The error summary takes focus when it appears, and each of its links focuses its field.
//
// It has no site copy: the page passes the contact line, and the confirmation is projected content. Colours are the
// theme's banner pair (the same as the offline notice), so no new pair needs checking.
@Component({
  selector: 'aj-form-status',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './form-status.css',
  template: `
    <div class="polite" role="status" aria-live="polite">
      @switch (state().kind) {
        @case ('sending') {
          <p class="sending">Sending…</p>
        }
        @case ('sent') {
          <ng-content />
        }
      }
    </div>
    <div class="assertive" role="alert">
      @let current = state();
      @switch (current.kind) {
        @case ('invalid') {
          <div #summary class="notice summary" tabindex="-1">
            <h2 class="summary-title">{{ problemCount(current) }}</h2>
            <ul class="summary-list">
              @for (error of current.errors; track error.fieldId) {
                <li>
                  <a [href]="'#' + error.fieldId" (click)="focusField($event, error.fieldId)">{{ error.label }}: {{ error.message }}</a>
                </li>
              }
              @for (message of current.other; track $index) {
                <li>{{ message }}</li>
              }
            </ul>
          </div>
        }
        @case ('rate-limited') {
          <p class="notice">
            {{ current.detail ?? 'Too many requests just now.' }}
            @if (retry(current.retryAfter); as when) {
              You can {{ when }}.
            }
          </p>
        }
        @case ('offline') {
          <p class="notice">{{ offline }} Your answers are still in the form, so you can try again.</p>
        }
        @case ('failed') {
          @if (current.detail) {
            <p class="notice">{{ current.detail }} Your answers are still in the form, so you can try again. {{ contact() }}</p>
          } @else {
            <p class="notice">Your request could not be sent. Your answers are still in the form, so you can try again. {{ contact() }}</p>
          }
        }
      }
    </div>
  `,
})
export class FormStatus {
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);

  readonly state = input.required<FormStatusState>();
  // The line that tells a visitor where else to reach the business, shown with a generic failure.
  readonly contact = input('');

  protected readonly offline = OFFLINE_COPY;
  private readonly summary = viewChild<ElementRef<HTMLElement>>('summary');

  constructor() {
    // Every new set of errors moves focus to the summary once it is in the page (also when the same errors come back
    // after another submit: the state is a new object each time).
    effect(() => {
      if (this.state().kind === 'invalid') {
        afterNextRender(() => this.summary()?.nativeElement.focus(), { injector: this.injector });
      }
    });
  }

  protected problemCount(state: Extract<FormStatusState, { kind: 'invalid' }>): string {
    const count = state.errors.length + state.other.length;
    return count === 1 ? '1 problem to fix' : `${count} problems to fix`;
  }

  protected retry(seconds: number | undefined): string {
    return retryText(seconds);
  }

  // The link goes to the control itself, never to the hash (a hash change would also move the page).
  protected focusField(event: Event, fieldId: string): void {
    event.preventDefault();
    this.document.getElementById(fieldId)?.focus();
  }
}
