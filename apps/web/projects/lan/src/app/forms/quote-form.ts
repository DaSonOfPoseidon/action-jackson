import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, Injector, afterNextRender, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
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
import { LIMITS, QUOTE_LIMITS, QUOTE_OPTIONS } from '../data/options';

// What the page keeps while a visitor fills the form: every field as typed (the counts are text, so "5x" can be told
// apart from 5), the boxes as booleans. The payload below keeps only the chosen kind's part of it.
interface QuoteModel {
  kind: string;
  runs: Record<string, string>;
  services: { apMounts: string; ethernetRelocations: string };
  centralization: string;
  scope: { networking: boolean; security: boolean; voip: boolean };
  internetSpeed: string;
  hasOwnEquipment: boolean;
  equipmentDescription: string;
  networkingBrand: string;
  securityBrand: string;
  surveyPreference: string;
  networkingDetails: string;
  securityDetails: string;
  voipDetails: string;
  notes: string;
  homeAge: string;
  stories: string;
  atticAccess: string;
  hasMediaPanel: boolean;
  mediaPanelLocation: string;
  hasCrawlspaceOrBasement: boolean;
  street: string;
  city: string;
  state: string;
  zip: string;
  liabilityAcknowledged: boolean;
  name: string;
  email: string;
  phone: string;
}

const EMPTY: QuoteModel = {
  kind: '',
  runs: Object.fromEntries(QUOTE_OPTIONS.runTypes.map((run) => [run.value, ''])),
  services: { apMounts: '', ethernetRelocations: '' },
  centralization: '',
  scope: { networking: false, security: false, voip: false },
  internetSpeed: '',
  hasOwnEquipment: false,
  equipmentDescription: '',
  networkingBrand: '',
  securityBrand: '',
  surveyPreference: '',
  networkingDetails: '',
  securityDetails: '',
  voipDetails: '',
  notes: '',
  homeAge: '',
  stories: '',
  atticAccess: '',
  hasMediaPanel: false,
  mediaPanelLocation: '',
  hasCrawlspaceOrBasement: false,
  street: '',
  city: '',
  state: '',
  zip: '',
  liabilityAcknowledged: false,
  name: '',
  email: '',
  phone: '',
};

const DROPS_ONLY = 'drops-only';
const WHOLE_HOME = 'whole-home';

// POST /api/lan/quotes answers 201 with the quote number: eight digits.
const QUOTE_NUMBER = /^\d{8}$/;

// The one sentence for an error that belongs to no field of the form (an unreadable body, the trap field, a path this
// page doesn't have). The API's own text for it, and its key, are never shown.
const OTHER_ERROR = 'Part of your request could not be accepted. Check your answers and send it again.';

const CONTACT_EMAIL = SOCIALS.find((social) => social.key === 'email')!;

// How long the counts must stay still before the price is asked for.
const PRICE_DEBOUNCE_MS = 500;
const PRICE_UNAVAILABLE = "The price can't be shown right now.";

// The three scope flags of a whole-home quote: the API's keys, and what the page calls them.
const SCOPES = [
  { key: 'networking', label: 'Networking', details: 'networkingDetails', detailsLabel: 'Networking details', id: 'qf-networking-details' },
  { key: 'security', label: 'Security', details: 'securityDetails', detailsLabel: 'Security details', id: 'qf-security-details' },
  { key: 'voip', label: 'VoIP', details: 'voipDetails', detailsLabel: 'VoIP details', id: 'qf-voip-details' },
] as const;

// The stories select: every whole number of the contract's range.
const STORIES = Array.from({ length: LIMITS.stories.max - LIMITS.stories.min + 1 }, (_, i) => String(LIMITS.stories.min + i));

// The calculate answer, as the page shows it. Every number comes from the API: nothing here is added up or rounded.
interface PriceLine {
  readonly description: string;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly lineTotal: number;
}

interface Price {
  readonly lines: readonly PriceLine[];
  readonly subtotal: number;
  readonly total: number;
  readonly deposit: number;
}

// What the last request for a body came to: the body's key, and its price (or null when it could not be priced).
interface PriceResult {
  readonly key: string | null;
  readonly price: Price | null;
}

const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

// The answer is untrusted input: a shape that is not exactly the contract's is no price at all, never a price of 0.
function parsePrice(body: unknown): Price | null {
  const record = body as Record<string, unknown> | null;
  if (typeof record !== 'object' || record === null || !Array.isArray(record['lines'])) {
    return null;
  }
  const lines: PriceLine[] = [];
  for (const line of record['lines'] as unknown[]) {
    const item = line as Record<string, unknown> | null;
    if (typeof item !== 'object' || item === null || typeof item['description'] !== 'string' || !isNumber(item['quantity']) || !isNumber(item['unitPrice']) || !isNumber(item['lineTotal'])) {
      return null;
    }
    lines.push({ description: item['description'], quantity: item['quantity'], unitPrice: item['unitPrice'], lineTotal: item['lineTotal'] });
  }
  const { subtotal, total, deposit } = record;
  if (lines.length === 0 || !isNumber(subtotal) || !isNumber(total) || !isNumber(deposit)) {
    return null;
  }
  return { lines, subtotal, total, deposit };
}

// What the confirmation shows of the 201: the number, and the amounts the API sent (only the ones it did send).
interface Created {
  readonly number: string;
  readonly kind: string;
  readonly total: number | null;
  readonly deposit: number | null;
  // The email the quote was made with, for the booking page to prefill (kept in the router's state, never in a URL).
  readonly email: string;
}

const CURRENCY = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

// A whole number of 0 to max in the text of a count. An empty count is 0 (the API takes a missing count as 0 too). Null
// when it is not a whole number in range.
function parseCount(text: string, max: number): number | null {
  const trimmed = text.trim();
  if (trimmed === '') {
    return 0;
  }
  return /^\d{1,3}$/.test(trimmed) && Number(trimmed) <= max ? Number(trimmed) : null;
}

// One place on the page an API error path can land: the JSON path the API uses, the id of the control to focus, the label,
// whether the field is on the page for the chosen kind, and the form's own state for it (client checks, touched).
interface FieldInfo {
  readonly path: string;
  readonly id: string;
  readonly label: string;
  readonly active: () => boolean;
  readonly state: () => { readonly errors: () => readonly { readonly message?: string }[]; readonly touched: () => boolean };
}

// The quote builder (POST /api/lan/quotes, with a live price from POST /api/lan/quotes/calculate for a drops-only quote).
// Its option lists and limits come from contracts/lan-options.json.
//
// The browser never computes a price: every amount on the page is a number of an API answer, formatted and nothing more
// (invariant 4). While there is no answer for the counts on the page (waiting, offline, any error), the panel says so: it
// never shows $0 and never an older answer as current.
//
// Like the consultation form, the page is prerendered, calls no API while it renders, and keeps its submit button disabled
// until the app runs. Client checks state only what the contract says; the formats are the API's, shown from its 400.
@Component({
  selector: 'aj-quote-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormField, FormStatus, RouterLink],
  template: `
    @if (!sent()) {
      <form class="cform" method="post" novalidate (submit)="submit($event)" aria-labelledby="qf-title">
        <h2 id="qf-title" class="sr-only">Quote request</h2>

        <!-- The trap for bots: off screen (not display: none), out of the tab order and the accessibility tree. It is always sent. -->
        <div class="cf-trap" aria-hidden="true">
          <label for="qf-honeypot">Leave this field blank</label>
          <input #honeypot id="qf-honeypot" type="text" name="honeypot" tabindex="-1" autocomplete="off" />
        </div>

        <p class="cf-note">Fields marked <span aria-hidden="true">*</span><span class="sr-only">with an asterisk</span> are required.</p>

        <fieldset class="cf-set" [attr.aria-describedby]="describedBy('kind', 'qf-kind-error')">
          <legend><span class="cf-step" aria-hidden="true">1</span><span>What do you need a quote for? <span aria-hidden="true">*</span></span></legend>
          <div class="cf-choices">
            @for (option of kinds; track option.value; let i = $index) {
              <label class="cf-choice">
                <input type="radio" [id]="'qf-kind-' + i" [value]="option.value" [formField]="f.kind" (change)="clearServer('kind')" />
                <span>
                  <span class="qf-kind-name">{{ option.label }}</span>
                  <span class="qf-kind-desc">{{ kindText[option.value] }}</span>
                </span>
              </label>
            }
          </div>
          @if (errorText('kind'); as text) {
            <p id="qf-kind-error" class="cf-error"><span class="sr-only">Error: </span>{{ text }}</p>
          }
        </fieldset>

        @if (model().kind === dropsOnly) {
          <fieldset class="cf-set" [attr.aria-describedby]="describedBy('runs', 'qf-runs-error', 'qf-runs-hint')">
            <legend><span class="cf-step" aria-hidden="true">2</span><span>Cable runs and services</span></legend>
            <p id="qf-runs-hint" class="cf-hint">
              How many of each? Up to {{ limits.runsPerType.max }} of each cable type, {{ limits.apMounts.max }} AP mounts and
              {{ limits.ethernetRelocations.max }} Ethernet relocations. Choose at least one.
            </p>
            <div class="cf-grid qf-counts">
              @for (run of runTypes; track run.value) {
                <div class="cf-field">
                  <label [for]="'qf-run-' + run.value">{{ run.label }} runs</label>
                  <input
                    [id]="'qf-run-' + run.value"
                    type="text"
                    inputmode="numeric"
                    autocomplete="off"
                    [formField]="runField(run.value)"
                    [attr.aria-invalid]="invalid('runs.' + run.value)"
                    [attr.aria-describedby]="describedBy('runs.' + run.value, 'qf-run-' + run.value + '-error')"
                    (input)="clearServer('runs.' + run.value); clearServer('runs')"
                  />
                  @if (errorText('runs.' + run.value); as text) {
                    <p [id]="'qf-run-' + run.value + '-error'" class="cf-error"><span class="sr-only">Error: </span>{{ text }}</p>
                  }
                </div>
              }
              <div class="cf-field">
                <label for="qf-ap-mounts">AP mounts</label>
                <input
                  id="qf-ap-mounts"
                  type="text"
                  inputmode="numeric"
                  autocomplete="off"
                  [formField]="f.services.apMounts"
                  [attr.aria-invalid]="invalid('services.apMounts')"
                  [attr.aria-describedby]="describedBy('services.apMounts', 'qf-ap-mounts-error')"
                  (input)="clearServer('services.apMounts'); clearServer('runs')"
                />
                @if (errorText('services.apMounts'); as text) {
                  <p id="qf-ap-mounts-error" class="cf-error"><span class="sr-only">Error: </span>{{ text }}</p>
                }
              </div>
              <div class="cf-field">
                <label for="qf-ethernet-relocations">Ethernet relocations</label>
                <input
                  id="qf-ethernet-relocations"
                  type="text"
                  inputmode="numeric"
                  autocomplete="off"
                  [formField]="f.services.ethernetRelocations"
                  [attr.aria-invalid]="invalid('services.ethernetRelocations')"
                  [attr.aria-describedby]="describedBy('services.ethernetRelocations', 'qf-ethernet-relocations-error')"
                  (input)="clearServer('services.ethernetRelocations'); clearServer('runs')"
                />
                @if (errorText('services.ethernetRelocations'); as text) {
                  <p id="qf-ethernet-relocations-error" class="cf-error"><span class="sr-only">Error: </span>{{ text }}</p>
                }
              </div>
            </div>
            @if (errorText('runs'); as text) {
              <p id="qf-runs-error" class="cf-error"><span class="sr-only">Error: </span>{{ text }}</p>
            }
          </fieldset>

          <fieldset class="cf-set" [attr.aria-describedby]="describedBy('centralization', 'qf-central-error')">
            <legend><span class="cf-step" aria-hidden="true">3</span><span>Where the cables end <span class="cf-optional">(optional)</span></span></legend>
            <div class="cf-choices">
              <label class="cf-choice">
                <input type="radio" id="qf-central-none" value="" [formField]="f.centralization" (change)="clearServer('centralization')" />
                <span>None</span>
              </label>
              @for (option of centralization; track option.value; let i = $index) {
                <label class="cf-choice">
                  <input type="radio" [id]="'qf-central-' + i" [value]="option.value" [formField]="f.centralization" (change)="clearServer('centralization')" />
                  <span>{{ option.label }}</span>
                </label>
              }
            </div>
            @if (errorText('centralization'); as text) {
              <p id="qf-central-error" class="cf-error"><span class="sr-only">Error: </span>{{ text }}</p>
            }
          </fieldset>

          <section class="qf-price" aria-labelledby="qf-price-title">
            <h3 id="qf-price-title">Your price</h3>
            @switch (panel().kind) {
              @case ('none') {
                <p class="qf-price-note">Enter a number of cable runs or services to see the price.</p>
              }
              @case ('updating') {
                <p class="qf-price-note">Updating the price…</p>
              }
              @case ('error') {
                <p class="qf-price-note">{{ unavailable }}</p>
                <button type="button" id="qf-price-retry" class="btn btn-outline btn-md qf-price-retry" (click)="retryPrice()">Try again</button>
              }
              @case ('ok') {
                @let price = okPrice()!;
                <ul class="qf-price-lines" role="list">
                  @for (line of price.lines; track $index) {
                    <li>
                      <span class="qf-line-name">{{ line.description }}</span>
                      <span class="qf-line-math">{{ line.quantity }} × {{ money(line.unitPrice) }}</span>
                      <span class="qf-line-total">{{ money(line.lineTotal) }}</span>
                    </li>
                  }
                </ul>
                <dl class="qf-sum">
                  @if (price.subtotal !== price.total) {
                    <div class="qf-sum-row" data-row="subtotal"><dt>Subtotal</dt><dd>{{ money(price.subtotal) }}</dd></div>
                  }
                  <div class="qf-sum-row qf-sum-main" data-row="total"><dt>Total</dt><dd>{{ money(price.total) }}</dd></div>
                  @if (price.deposit > 0) {
                    <div class="qf-sum-row" data-row="deposit"><dt>Deposit</dt><dd>{{ money(price.deposit) }}</dd></div>
                  }
                </dl>
              }
            }
            <!-- The one thing a screen reader hears about the price: the settled total, once per answer, never while it updates. -->
            <p class="sr-only qf-price-announce" role="status" aria-live="polite">{{ announcement() }}</p>
          </section>
        }

        @if (model().kind === wholeHome) {
          <fieldset class="cf-set" [attr.aria-describedby]="describedBy('wholeHome.scope', 'qf-scope-error', 'qf-whole-note')">
            <legend><span class="cf-step" aria-hidden="true">2</span><span>What the project covers <span aria-hidden="true">*</span></span></legend>
            <p id="qf-whole-note" class="cf-hint qf-whole-note">
              Whole-home installs are priced after a site survey. A deposit is due; you will see its amount once your quote is created.
              Choose at least one.
            </p>
            <div class="cf-choices">
              @for (scope of scopes; track scope.key) {
                <label class="cf-choice">
                  <input type="checkbox" [id]="'qf-scope-' + scope.key" [formField]="scopeField(scope.key)" (change)="clearServer('wholeHome.scope')" />
                  <span>{{ scope.label }}</span>
                </label>
              }
            </div>
            @if (errorText('wholeHome.scope'); as text) {
              <p id="qf-scope-error" class="cf-error"><span class="sr-only">Error: </span>{{ text }}</p>
            }
          </fieldset>

          <fieldset class="cf-set">
            <legend><span class="cf-step" aria-hidden="true">3</span><span>About the project <span class="cf-optional">(optional)</span></span></legend>
            <div class="cf-field">
              <label for="qf-internet-speed">Internet speed</label>
              <input
                id="qf-internet-speed"
                type="text"
                autocomplete="off"
                [formField]="f.internetSpeed"
                [attr.aria-invalid]="invalid('wholeHome.internetSpeed')"
                [attr.aria-describedby]="describedBy('wholeHome.internetSpeed', 'qf-internet-speed-error')"
                (input)="clearServer('wholeHome.internetSpeed')"
              />
              @if (errorText('wholeHome.internetSpeed'); as text) {
                <p id="qf-internet-speed-error" class="cf-error"><span class="sr-only">Error: </span>{{ text }}</p>
              }
            </div>

            <div class="cf-choices qf-gap">
              <label class="cf-choice">
                <input type="checkbox" id="qf-own-equipment" [formField]="f.hasOwnEquipment" (change)="clearServer('wholeHome.hasOwnEquipment')" />
                <span>I have my own equipment</span>
              </label>
            </div>

            @if (model().hasOwnEquipment) {
              <div class="cf-field qf-gap">
                <label for="qf-equipment-description">Your equipment</label>
                <textarea
                  id="qf-equipment-description"
                  rows="3"
                  [formField]="f.equipmentDescription"
                  [attr.aria-invalid]="invalid('wholeHome.equipmentDescription')"
                  [attr.aria-describedby]="describedBy('wholeHome.equipmentDescription', 'qf-equipment-description-error')"
                  (input)="clearServer('wholeHome.equipmentDescription')"
                ></textarea>
                @if (errorText('wholeHome.equipmentDescription'); as text) {
                  <p id="qf-equipment-description-error" class="cf-error"><span class="sr-only">Error: </span>{{ text }}</p>
                }
              </div>
            } @else {
              <div class="cf-grid qf-gap">
                <div class="cf-field">
                  <label for="qf-networking-brand">Networking brand</label>
                  <select
                    id="qf-networking-brand"
                    [formField]="f.networkingBrand"
                    [attr.aria-invalid]="invalid('wholeHome.networkingBrand')"
                    [attr.aria-describedby]="describedBy('wholeHome.networkingBrand', 'qf-networking-brand-error')"
                    (change)="clearServer('wholeHome.networkingBrand')"
                  >
                    <option value="">Choose a brand</option>
                    @for (option of networkingBrands; track option.value) {
                      <option [value]="option.value">{{ option.label }}</option>
                    }
                  </select>
                  @if (errorText('wholeHome.networkingBrand'); as text) {
                    <p id="qf-networking-brand-error" class="cf-error"><span class="sr-only">Error: </span>{{ text }}</p>
                  }
                </div>
                <div class="cf-field">
                  <label for="qf-security-brand">Security brand</label>
                  <select
                    id="qf-security-brand"
                    [formField]="f.securityBrand"
                    [attr.aria-invalid]="invalid('wholeHome.securityBrand')"
                    [attr.aria-describedby]="describedBy('wholeHome.securityBrand', 'qf-security-brand-error')"
                    (change)="clearServer('wholeHome.securityBrand')"
                  >
                    <option value="">Choose a brand</option>
                    @for (option of securityBrands; track option.value) {
                      <option [value]="option.value">{{ option.label }}</option>
                    }
                  </select>
                  @if (errorText('wholeHome.securityBrand'); as text) {
                    <p id="qf-security-brand-error" class="cf-error"><span class="sr-only">Error: </span>{{ text }}</p>
                  }
                </div>
              </div>
            }

            <div class="cf-field qf-gap">
              <label for="qf-survey-preference">When would you like the site survey?</label>
              <select
                id="qf-survey-preference"
                [formField]="f.surveyPreference"
                [attr.aria-invalid]="invalid('wholeHome.surveyPreference')"
                [attr.aria-describedby]="describedBy('wholeHome.surveyPreference', 'qf-survey-preference-error')"
                (change)="clearServer('wholeHome.surveyPreference')"
              >
                <option value="">No preference</option>
                @for (option of surveyPreferences; track option.value) {
                  <option [value]="option.value">{{ option.label }}</option>
                }
              </select>
              @if (errorText('wholeHome.surveyPreference'); as text) {
                <p id="qf-survey-preference-error" class="cf-error"><span class="sr-only">Error: </span>{{ text }}</p>
              }
            </div>

            @for (scope of scopes; track scope.key) {
              @if (model().scope[scope.key]) {
                <div class="cf-field qf-gap">
                  <label [for]="scope.id">{{ scope.detailsLabel }}</label>
                  <textarea
                    [id]="scope.id"
                    rows="3"
                    [formField]="detailsField(scope.details)"
                    [attr.aria-invalid]="invalid('wholeHome.' + scope.details)"
                    [attr.aria-describedby]="describedBy('wholeHome.' + scope.details, scope.id + '-error')"
                    (input)="clearServer('wholeHome.' + scope.details)"
                  ></textarea>
                  @if (errorText('wholeHome.' + scope.details); as text) {
                    <p [id]="scope.id + '-error'" class="cf-error"><span class="sr-only">Error: </span>{{ text }}</p>
                  }
                </div>
              }
            }

            <div class="cf-field qf-gap">
              <label for="qf-notes">Anything else we should know</label>
              <textarea
                id="qf-notes"
                rows="4"
                [formField]="f.notes"
                [attr.aria-invalid]="invalid('wholeHome.notes')"
                [attr.aria-describedby]="describedBy('wholeHome.notes', 'qf-notes-error')"
                (input)="clearServer('wholeHome.notes')"
              ></textarea>
              @if (errorText('wholeHome.notes'); as text) {
                <p id="qf-notes-error" class="cf-error"><span class="sr-only">Error: </span>{{ text }}</p>
              }
            </div>
          </fieldset>
        }

        <fieldset class="cf-set">
          <legend><span class="cf-step" aria-hidden="true">{{ model().kind ? 4 : 2 }}</span><span>Your home</span></legend>
          <div class="cf-grid">
            <div class="cf-field">
              <label for="qf-home-age">Age of the home <span aria-hidden="true">*</span></label>
              <select
                id="qf-home-age"
                aria-required="true"
                [formField]="f.homeAge"
                [attr.aria-invalid]="invalid('homeInfo.homeAge')"
                [attr.aria-describedby]="describedBy('homeInfo.homeAge', 'qf-home-age-error')"
                (change)="clearServer('homeInfo.homeAge')"
              >
                <option value="">Choose a range</option>
                @for (option of homeAges; track option.value) {
                  <option [value]="option.value">{{ option.label }}</option>
                }
              </select>
              @if (errorText('homeInfo.homeAge'); as text) {
                <p id="qf-home-age-error" class="cf-error"><span class="sr-only">Error: </span>{{ text }}</p>
              }
            </div>
            <div class="cf-field">
              <label for="qf-stories">Stories <span aria-hidden="true">*</span></label>
              <select
                id="qf-stories"
                aria-required="true"
                [formField]="f.stories"
                [attr.aria-invalid]="invalid('homeInfo.stories')"
                [attr.aria-describedby]="describedBy('homeInfo.stories', 'qf-stories-error')"
                (change)="clearServer('homeInfo.stories')"
              >
                <option value="">Choose</option>
                @for (count of stories; track count) {
                  <option [value]="count">{{ count }}</option>
                }
              </select>
              @if (errorText('homeInfo.stories'); as text) {
                <p id="qf-stories-error" class="cf-error"><span class="sr-only">Error: </span>{{ text }}</p>
              }
            </div>
          </div>
          <div class="cf-field qf-gap">
            <label for="qf-attic-access">Attic access <span aria-hidden="true">*</span></label>
            <select
              id="qf-attic-access"
              aria-required="true"
              [formField]="f.atticAccess"
              [attr.aria-invalid]="invalid('homeInfo.atticAccess')"
              [attr.aria-describedby]="describedBy('homeInfo.atticAccess', 'qf-attic-access-error')"
              (change)="clearServer('homeInfo.atticAccess')"
            >
              <option value="">Choose one</option>
              @for (option of atticAccess; track option.value) {
                <option [value]="option.value">{{ option.label }}</option>
              }
            </select>
            @if (errorText('homeInfo.atticAccess'); as text) {
              <p id="qf-attic-access-error" class="cf-error"><span class="sr-only">Error: </span>{{ text }}</p>
            }
          </div>

          <div class="cf-choices qf-gap">
            <label class="cf-choice">
              <input type="checkbox" id="qf-has-panel" [formField]="f.hasMediaPanel" (change)="clearServer('homeInfo.hasMediaPanel')" />
              <span>There is already a media panel in the home</span>
            </label>
            <label class="cf-choice">
              <input type="checkbox" id="qf-crawlspace" [formField]="f.hasCrawlspaceOrBasement" (change)="clearServer('homeInfo.hasCrawlspaceOrBasement')" />
              <span>The home has a crawl space or a basement</span>
            </label>
          </div>
          @if (model().hasMediaPanel) {
            <div class="cf-field qf-gap">
              <label for="qf-panel-location">Where is the media panel? <span class="cf-optional">(optional)</span></label>
              <input
                id="qf-panel-location"
                type="text"
                autocomplete="off"
                [formField]="f.mediaPanelLocation"
                [attr.aria-invalid]="invalid('homeInfo.mediaPanelLocation')"
                [attr.aria-describedby]="describedBy('homeInfo.mediaPanelLocation', 'qf-panel-location-error')"
                (input)="clearServer('homeInfo.mediaPanelLocation')"
              />
              @if (errorText('homeInfo.mediaPanelLocation'); as text) {
                <p id="qf-panel-location-error" class="cf-error"><span class="sr-only">Error: </span>{{ text }}</p>
              }
            </div>
          }
        </fieldset>

        <fieldset class="cf-set">
          <legend><span class="cf-step" aria-hidden="true">{{ model().kind ? 5 : 3 }}</span><span>Where the work is</span></legend>
          <div class="cf-field">
            <label for="qf-street">Street address <span aria-hidden="true">*</span></label>
            <input
              id="qf-street"
              type="text"
              autocomplete="street-address"
              aria-required="true"
              [formField]="f.street"
              [attr.aria-invalid]="invalid('homeInfo.address.street')"
              [attr.aria-describedby]="describedBy('homeInfo.address.street', 'qf-street-error')"
              (input)="clearServer('homeInfo.address.street')"
            />
            @if (errorText('homeInfo.address.street'); as text) {
              <p id="qf-street-error" class="cf-error"><span class="sr-only">Error: </span>{{ text }}</p>
            }
          </div>
          <div class="cf-grid qf-gap qf-address">
            <div class="cf-field">
              <label for="qf-city">City <span aria-hidden="true">*</span></label>
              <input
                id="qf-city"
                type="text"
                autocomplete="address-level2"
                aria-required="true"
                [formField]="f.city"
                [attr.aria-invalid]="invalid('homeInfo.address.city')"
                [attr.aria-describedby]="describedBy('homeInfo.address.city', 'qf-city-error')"
                (input)="clearServer('homeInfo.address.city')"
              />
              @if (errorText('homeInfo.address.city'); as text) {
                <p id="qf-city-error" class="cf-error"><span class="sr-only">Error: </span>{{ text }}</p>
              }
            </div>
            <div class="cf-field">
              <label for="qf-state">State (2 letters) <span aria-hidden="true">*</span></label>
              <input
                id="qf-state"
                type="text"
                autocomplete="address-level1"
                autocapitalize="characters"
                spellcheck="false"
                aria-required="true"
                [formField]="f.state"
                [attr.aria-invalid]="invalid('homeInfo.address.state')"
                [attr.aria-describedby]="describedBy('homeInfo.address.state', 'qf-state-error')"
                (input)="clearServer('homeInfo.address.state')"
              />
              @if (errorText('homeInfo.address.state'); as text) {
                <p id="qf-state-error" class="cf-error"><span class="sr-only">Error: </span>{{ text }}</p>
              }
            </div>
            <div class="cf-field">
              <label for="qf-zip">ZIP code <span aria-hidden="true">*</span></label>
              <input
                id="qf-zip"
                type="text"
                inputmode="numeric"
                autocomplete="postal-code"
                aria-required="true"
                [formField]="f.zip"
                [attr.aria-invalid]="invalid('homeInfo.address.zip')"
                [attr.aria-describedby]="describedBy('homeInfo.address.zip', 'qf-zip-error')"
                (input)="clearServer('homeInfo.address.zip')"
              />
              @if (errorText('homeInfo.address.zip'); as text) {
                <p id="qf-zip-error" class="cf-error"><span class="sr-only">Error: </span>{{ text }}</p>
              }
            </div>
          </div>
          <div class="cf-choices qf-gap" [attr.aria-describedby]="describedBy('homeInfo.liabilityAcknowledged', 'qf-ack-error')">
            <label class="cf-choice">
              <input
                type="checkbox"
                id="qf-ack"
                aria-required="true"
                [formField]="f.liabilityAcknowledged"
                [attr.aria-invalid]="invalid('homeInfo.liabilityAcknowledged')"
                [attr.aria-describedby]="describedBy('homeInfo.liabilityAcknowledged', 'qf-ack-error')"
                (change)="clearServer('homeInfo.liabilityAcknowledged')"
              />
              <span>{{ acknowledgment }} <span aria-hidden="true">*</span></span>
            </label>
          </div>
          @if (errorText('homeInfo.liabilityAcknowledged'); as text) {
            <p id="qf-ack-error" class="cf-error qf-gap"><span class="sr-only">Error: </span>{{ text }}</p>
          }
        </fieldset>

        <fieldset class="cf-set">
          <legend><span class="cf-step" aria-hidden="true">{{ model().kind ? 6 : 4 }}</span><span>Contact information</span></legend>
          <div class="cf-grid">
            <div class="cf-field">
              <label for="qf-name">Name <span aria-hidden="true">*</span></label>
              <input
                id="qf-name"
                type="text"
                autocomplete="name"
                aria-required="true"
                [formField]="f.name"
                [attr.aria-invalid]="invalid('customer.name')"
                [attr.aria-describedby]="describedBy('customer.name', 'qf-name-error')"
                (input)="clearServer('customer.name')"
              />
              @if (errorText('customer.name'); as text) {
                <p id="qf-name-error" class="cf-error"><span class="sr-only">Error: </span>{{ text }}</p>
              }
            </div>
            <div class="cf-field">
              <label for="qf-email">Email <span aria-hidden="true">*</span></label>
              <input
                id="qf-email"
                type="email"
                autocomplete="email"
                spellcheck="false"
                aria-required="true"
                [formField]="f.email"
                [attr.aria-invalid]="invalid('customer.email')"
                [attr.aria-describedby]="describedBy('customer.email', 'qf-email-error')"
                (input)="clearServer('customer.email')"
              />
              @if (errorText('customer.email'); as text) {
                <p id="qf-email-error" class="cf-error"><span class="sr-only">Error: </span>{{ text }}</p>
              }
            </div>
          </div>
          <div class="cf-field qf-gap">
            <label for="qf-phone">Phone <span class="cf-optional">(optional)</span></label>
            <input
              id="qf-phone"
              type="tel"
              autocomplete="tel"
              [formField]="f.phone"
              [attr.aria-invalid]="invalid('customer.phone')"
              [attr.aria-describedby]="describedBy('customer.phone', 'qf-phone-error')"
              (input)="clearServer('customer.phone')"
            />
            @if (errorText('customer.phone'); as text) {
              <p id="qf-phone-error" class="cf-error"><span class="sr-only">Error: </span>{{ text }}</p>
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
          {{ sending() ? 'Sending…' : 'Get My Quote' }}
        </button>
      </form>
    }

    <aj-form-status class="cf-status" [state]="status()" [contact]="'You can also email ' + contact.label + '.'">
      @if (created(); as quote) {
        <div class="cf-sent">
          <h2 #sentHeading tabindex="-1">Quote created</h2>
          @if (quote.number) {
            <p>Your quote number is <strong class="mono qf-number">{{ quote.number }}</strong>.</p>
            <p>Keep it: you need it to book an appointment. No copy of this quote is emailed to you.</p>
          } @else {
            <p>Your quote was created.</p>
          }
          @if (quote.kind === wholeHome) {
            <p>The price of a whole-home install is set after a site survey.</p>
            @if (quote.deposit !== null && quote.deposit > 0) {
              <p class="qf-amount">Deposit <strong>{{ money(quote.deposit) }}</strong></p>
            }
          } @else {
            @if (quote.total !== null) {
              <p class="qf-amount">Total <strong>{{ money(quote.total) }}</strong></p>
            }
            @if (quote.deposit !== null && quote.deposit > 0) {
              <p class="qf-amount">Deposit <strong>{{ money(quote.deposit) }}</strong></p>
            }
          }
          @if (quote.number) {
            <a class="btn btn-primary btn-lg" routerLink="/book" [queryParams]="{ quote: quote.number }" [state]="{ email: quote.email }">Book an appointment</a>
          }
          <a class="btn btn-outline btn-lg gradient-border" routerLink="/">Back to Home</a>
        </div>
      }
    </aj-form-status>
  `,
})
export class QuoteForm {
  private readonly api = inject(ApiClient);
  private readonly injector = inject(Injector);
  private readonly document = inject(DOCUMENT);

  protected readonly kinds = QUOTE_OPTIONS.kinds;
  protected readonly runTypes = QUOTE_OPTIONS.runTypes;
  protected readonly centralization = QUOTE_OPTIONS.centralization;
  protected readonly homeAges = QUOTE_OPTIONS.homeAge;
  protected readonly atticAccess = QUOTE_OPTIONS.atticAccess;
  protected readonly networkingBrands = QUOTE_OPTIONS.networkingBrand;
  protected readonly securityBrands = QUOTE_OPTIONS.securityBrand;
  protected readonly surveyPreferences = QUOTE_OPTIONS.surveyPreference;
  protected readonly limits = LIMITS;
  protected readonly stories = STORIES;
  protected readonly scopes = SCOPES;
  protected readonly dropsOnly = DROPS_ONLY;
  protected readonly wholeHome = WHOLE_HOME;
  protected readonly unavailable = PRICE_UNAVAILABLE;
  protected readonly contact = CONTACT_EMAIL;

  // One line on what each kind is, keyed by the contract's value. It promises no price but the one the page shows.
  protected readonly kindText: Readonly<Record<string, string>> = {
    [DROPS_ONLY]: 'Individual cable runs and services. The price shows as you fill in the form.',
    [WHOLE_HOME]: 'A whole-home install. The price follows a site survey.',
  };

  // The sentence the customer agrees to. The API stores only that it was acknowledged (homeInfo.liabilityAcknowledged).
  protected readonly acknowledgment = 'I agree that the installer will need access to my home, including the attic, crawl space or basement, to do this install.';

  protected readonly model = signal<QuoteModel>(structuredClone(EMPTY));
  protected readonly f = form(this.model, (path) => {
    validate(path.kind, ({ value }) => (value() ? undefined : { kind: 'required', message: 'Choose the kind of quote you want.' }));
    for (const run of QUOTE_OPTIONS.runTypes) {
      validate(path.runs[run.value], ({ value }) => this.countError(value(), LIMITS.runsPerType.max));
    }
    validate(path.services.apMounts, ({ value }) => this.countError(value(), LIMITS.apMounts.max));
    validate(path.services.ethernetRelocations, ({ value }) => this.countError(value(), LIMITS.ethernetRelocations.max));
    maxLength(path.internetSpeed, QUOTE_LIMITS.internetSpeed, { message: `Use at most ${QUOTE_LIMITS.internetSpeed} characters.` });
    for (const text of ['equipmentDescription', 'networkingDetails', 'securityDetails', 'voipDetails', 'notes'] as const) {
      maxLength(path[text], LIMITS.wholeHomeTextLength, { message: `Use at most ${LIMITS.wholeHomeTextLength} characters.` });
    }
    validate(path.homeAge, ({ value }) => (value() ? undefined : { kind: 'required', message: 'Choose the age of your home.' }));
    validate(path.stories, ({ value }) => (value() ? undefined : { kind: 'required', message: 'Choose the number of stories.' }));
    validate(path.atticAccess, ({ value }) => (value() ? undefined : { kind: 'required', message: 'Choose the attic access.' }));
    maxLength(path.mediaPanelLocation, QUOTE_LIMITS.mediaPanelLocation, { message: `Use at most ${QUOTE_LIMITS.mediaPanelLocation} characters.` });
    validate(path.street, ({ value }) => (value().trim() ? undefined : { kind: 'required', message: 'Enter the street address.' }));
    maxLength(path.street, QUOTE_LIMITS.street, { message: `Use at most ${QUOTE_LIMITS.street} characters.` });
    validate(path.city, ({ value }) => (value().trim() ? undefined : { kind: 'required', message: 'Enter the city.' }));
    maxLength(path.city, QUOTE_LIMITS.city, { message: `Use at most ${QUOTE_LIMITS.city} characters.` });
    validate(path.state, ({ value }) => (value().trim() ? undefined : { kind: 'required', message: 'Enter the state.' }));
    maxLength(path.state, 2, { message: 'Use the 2-letter state code.' });
    validate(path.zip, ({ value }) => (value().trim() ? undefined : { kind: 'required', message: 'Enter the ZIP code.' }));
    validate(path.liabilityAcknowledged, ({ value }) => (value() ? undefined : { kind: 'required', message: 'Confirm the acknowledgment to continue.' }));
    validate(path.name, ({ value }) => (value().trim() ? undefined : { kind: 'required', message: 'Enter your name.' }));
    validate(path.email, ({ value }) => {
      const email = value().trim();
      if (!email) {
        return { kind: 'required', message: 'Enter your email address.' };
      }
      // Only the shape: something, an @, something, a dot, something. The API decides what is a valid address.
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? undefined : { kind: 'email', message: 'Enter a valid email address.' };
    });
  });

  // The page makes no API call and sends nothing until the app is running in the browser.
  protected readonly ready = signal(false);
  protected readonly sending = signal(false);
  protected readonly status = signal<FormStatusState>({ kind: 'idle' });
  protected readonly sent = signal(false);
  protected readonly created = signal<Created | null>(null);

  // Set once a submit was tried: from then on every field shows its client error, not only the ones already left.
  private readonly attempted = signal(false);
  // The API's messages by field path, from its last 400. A field's messages go when the visitor changes it.
  private readonly serverErrors = signal<Readonly<Record<string, readonly string[]>>>({});
  // The fields edited since the request went out: the API judged their old values, so its errors for them are dropped.
  private readonly editedWhileSending = new Set<string>();

  private readonly honeypot = viewChild<ElementRef<HTMLInputElement>>('honeypot');
  private readonly sentHeading = viewChild<ElementRef<HTMLElement>>('sentHeading');
  private readonly submitButton = viewChild<ElementRef<HTMLButtonElement>>('submitButton');

  // The counts of a drops-only quote that can be asked for: every count a whole number in its range, at least one above 0.
  // Null otherwise (nothing to price yet, or a count the visitor is still fixing).
  private readonly priceBody = computed(() => {
    const model = this.model();
    if (model.kind !== DROPS_ONLY) {
      return null;
    }
    const counts = this.counts(model);
    if (counts === null || !counts.any) {
      return null;
    }
    return {
      runs: counts.runs,
      services: counts.services,
      ...(model.centralization ? { centralization: model.centralization } : {}),
      hasExistingPanel: model.hasMediaPanel,
    };
  });
  // A string, so the effect below runs again only when the body really changed, not on every key elsewhere in the form.
  private readonly priceKey = computed(() => {
    const body = this.priceBody();
    return body === null ? null : JSON.stringify(body);
  });

  // The last answer for a body (or its failure). It is shown only while it is for the body on the page.
  private readonly priceResult = signal<PriceResult>({ key: null, price: null });
  // Bumped for every change of the body, a return to an answered one included: an answer of an older request finds a
  // different number and is dropped.
  private requestId = 0;

  protected readonly panel = computed<{ kind: 'none' } | { kind: 'updating' } | { kind: 'error' } | { kind: 'ok'; price: Price }>(() => {
    const key = this.priceKey();
    if (key === null) {
      return { kind: 'none' };
    }
    const result = this.priceResult();
    if (result.key !== key) {
      return { kind: 'updating' };
    }
    return result.price ? { kind: 'ok', price: result.price } : { kind: 'error' };
  });

  protected readonly okPrice = computed(() => {
    const panel = this.panel();
    return panel.kind === 'ok' ? panel.price : null;
  });

  // What a screen reader hears: the settled total, or that there is none. Nothing while the price is updating.
  protected readonly announcement = computed(() => {
    const panel = this.panel();
    if (panel.kind === 'error') {
      return PRICE_UNAVAILABLE;
    }
    if (panel.kind !== 'ok') {
      return '';
    }
    const { total, deposit } = panel.price;
    return `Total ${CURRENCY.format(total)}${deposit > 0 ? `, deposit ${CURRENCY.format(deposit)}` : ''}.`;
  });

  // Every place an error can land, in the order of the page.
  private readonly fields: readonly FieldInfo[] = this.buildFields();

  // The messages each field shows now: its own client checks (once it was left, or a submit was tried), else what the API
  // said about it.
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
    afterNextRender(() => this.ready.set(true));

    // Asks for the price of the counts on the page once they have stayed the same for a moment. Nothing is asked before the
    // app runs, while every count is 0, or for a body whose answer is already there.
    effect((onCleanup) => {
      const key = this.priceKey();
      // Every run is a change of the counts (or the app starting): a request that is still out was for other counts, so its
      // answer is dropped, even when these counts already have an answer or none is asked for.
      const id = ++this.requestId;
      if (!this.ready() || key === null) {
        return;
      }
      if (untracked(this.priceResult).key === key) {
        return;
      }
      const timer = setTimeout(() => void this.fetchPrice(key, id), PRICE_DEBOUNCE_MS);
      onCleanup(() => clearTimeout(timer));
    });
  }

  private buildFields(): readonly FieldInfo[] {
    const always = () => true;
    const drops = () => this.model().kind === DROPS_ONLY;
    const whole = () => this.model().kind === WHOLE_HOME;
    const info = (path: string, id: string, label: string, state: FieldInfo['state'], active: () => boolean = always): FieldInfo => ({ path, id, label, state, active });
    // A rule the form has no single field for: its message shows only after a submit was tried.
    const group = (message: string, failing: () => boolean): FieldInfo['state'] => () => ({
      errors: () => (failing() ? [{ message }] : []),
      touched: () => false,
    });
    const noRuns = () => {
      const counts = this.counts(this.model());
      return counts !== null && !counts.any;
    };
    const noScope = () => {
      const scope = this.model().scope;
      return !scope.networking && !scope.security && !scope.voip;
    };
    return [
      info('kind', 'qf-kind-0', 'Quote type', () => this.f.kind()),
      info('runs', 'qf-run-' + QUOTE_OPTIONS.runTypes[0].value, 'Cable runs and services', group('Enter at least one cable run or service.', noRuns), drops),
      ...QUOTE_OPTIONS.runTypes.map((run) => info('runs.' + run.value, 'qf-run-' + run.value, `${run.label} runs`, () => this.runField(run.value)(), drops)),
      info('services.apMounts', 'qf-ap-mounts', 'AP mounts', () => this.f.services.apMounts(), drops),
      info('services.ethernetRelocations', 'qf-ethernet-relocations', 'Ethernet relocations', () => this.f.services.ethernetRelocations(), drops),
      info('centralization', 'qf-central-none', 'Where the cables end', () => this.f.centralization(), drops),
      info('wholeHome.scope', 'qf-scope-networking', 'Scope', group('Choose at least one scope.', noScope), whole),
      info('wholeHome.internetSpeed', 'qf-internet-speed', 'Internet speed', () => this.f.internetSpeed(), whole),
      info('wholeHome.equipmentDescription', 'qf-equipment-description', 'Your equipment', () => this.f.equipmentDescription(), () => whole() && this.model().hasOwnEquipment),
      info('wholeHome.networkingBrand', 'qf-networking-brand', 'Networking brand', () => this.f.networkingBrand(), () => whole() && !this.model().hasOwnEquipment),
      info('wholeHome.securityBrand', 'qf-security-brand', 'Security brand', () => this.f.securityBrand(), () => whole() && !this.model().hasOwnEquipment),
      info('wholeHome.surveyPreference', 'qf-survey-preference', 'Site survey', () => this.f.surveyPreference(), whole),
      ...SCOPES.map((scope) => info('wholeHome.' + scope.details, scope.id, scope.detailsLabel, () => this.detailsField(scope.details)(), () => whole() && this.model().scope[scope.key])),
      info('wholeHome.notes', 'qf-notes', 'Notes', () => this.f.notes(), whole),
      info('homeInfo.homeAge', 'qf-home-age', 'Age of the home', () => this.f.homeAge()),
      info('homeInfo.stories', 'qf-stories', 'Stories', () => this.f.stories()),
      info('homeInfo.atticAccess', 'qf-attic-access', 'Attic access', () => this.f.atticAccess()),
      info('homeInfo.mediaPanelLocation', 'qf-panel-location', 'Media panel location', () => this.f.mediaPanelLocation(), () => this.model().hasMediaPanel),
      info('homeInfo.address.street', 'qf-street', 'Street address', () => this.f.street()),
      info('homeInfo.address.city', 'qf-city', 'City', () => this.f.city()),
      info('homeInfo.address.state', 'qf-state', 'State', () => this.f.state()),
      info('homeInfo.address.zip', 'qf-zip', 'ZIP code', () => this.f.zip()),
      info('homeInfo.liabilityAcknowledged', 'qf-ack', 'Acknowledgment', () => this.f.liabilityAcknowledged()),
      info('customer.name', 'qf-name', 'Name', () => this.f.name()),
      info('customer.email', 'qf-email', 'Email', () => this.f.email()),
      info('customer.phone', 'qf-phone', 'Phone', () => this.f.phone()),
    ];
  }

  // The form's field for a run type, a scope flag and a detail text, by the contract's key.
  protected runField(value: string) {
    return this.f.runs[value];
  }

  protected scopeField(key: 'networking' | 'security' | 'voip') {
    return this.f.scope[key];
  }

  protected detailsField(key: 'networkingDetails' | 'securityDetails' | 'voipDetails') {
    return this.f[key];
  }

  // A count that is not a whole number from 0 to its maximum. Empty is fine: it is 0.
  private countError(text: string, max: number): { kind: string; message: string } | undefined {
    return parseCount(text, max) === null ? { kind: 'range', message: `Enter a whole number from 0 to ${max}.` } : undefined;
  }

  // The six counts as numbers, and whether any is above 0. Null when one of them is not a whole number in range.
  private counts(model: QuoteModel): { runs: Record<string, number>; services: { apMounts: number; ethernetRelocations: number }; any: boolean } | null {
    const runs: Record<string, number> = {};
    let any = false;
    for (const run of QUOTE_OPTIONS.runTypes) {
      const count = parseCount(model.runs[run.value] ?? '', LIMITS.runsPerType.max);
      if (count === null) {
        return null;
      }
      runs[run.value] = count;
      any ||= count > 0;
    }
    const apMounts = parseCount(model.services.apMounts, LIMITS.apMounts.max);
    const ethernetRelocations = parseCount(model.services.ethernetRelocations, LIMITS.ethernetRelocations.max);
    if (apMounts === null || ethernetRelocations === null) {
      return null;
    }
    return { runs, services: { apMounts, ethernetRelocations }, any: any || apMounts > 0 || ethernetRelocations > 0 };
  }

  protected money(amount: number): string {
    return CURRENCY.format(amount);
  }

  // The price of the counts that are on the page, now (the "Try again" button).
  protected retryPrice(): void {
    const key = untracked(this.priceKey);
    if (key === null) {
      return;
    }
    this.priceResult.set({ key: null, price: null });
    void this.fetchPrice(key, ++this.requestId);
  }

  // Asks for the price of one body. The answer counts only if it is still the newest request: counts that changed again
  // since have started a newer one.
  private async fetchPrice(key: string, id: number): Promise<void> {
    let price: Price | null = null;
    try {
      price = parsePrice(await firstValueFrom(this.api.post<unknown>('quotes/calculate', JSON.parse(key))));
    } catch {
      price = null;
    }
    if (id === this.requestId) {
      this.priceResult.set({ key, price });
    }
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

  // An edit makes what the API said about the field out of date. While a request is out, the answer is not here yet: the
  // field is noted, and its error is dropped when the answer comes (see `fail`).
  protected clearServer(path: string): void {
    if (this.sending()) {
      this.editedWhileSending.add(path);
    }
    if (this.serverErrors()[path]) {
      this.serverErrors.update(({ [path]: _gone, ...rest }) => rest);
    }
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
    this.editedWhileSending.clear();
    this.status.set({ kind: 'sending' });
    try {
      // What the quote is for, taken now: the form stays editable while the request is out.
      const sentKind = this.model().kind;
      const sentEmail = this.model().email.trim();
      const answer = await firstValueFrom(this.api.post<Record<string, unknown> | null>('quotes', this.payload()));
      this.created.set(this.createdFrom(answer, sentKind, sentEmail));
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

  // Only what the answer really holds: a number that is not eight digits, or an amount that is not a number, is left out
  // (never replaced by 0).
  private createdFrom(answer: Record<string, unknown> | null, kind: string, email: string): Created {
    const number = typeof answer?.['quoteNumber'] === 'string' && QUOTE_NUMBER.test(answer['quoteNumber']) ? answer['quoteNumber'] : '';
    const amount = (value: unknown): number | null => (isNumber(value) ? value : null);
    return { number, kind, total: amount(answer?.['total']), deposit: amount(answer?.['deposit']), email };
  }

  // The summary entries of the fields that show a message, in the order of the page.
  private summary(): FormStatusError[] {
    const shown = this.messages();
    return this.fields.flatMap((field) => (field.active() && shown[field.path] ? [{ fieldId: field.id, label: field.label, message: shown[field.path][0] }] : []));
  }

  // What the API accepts, for the chosen kind only: text is trimmed (the API trims too), optional fields left empty are left
  // out, a section that is not the kind's is not there, and the trap field is always sent.
  private payload(): object {
    const model = this.model();
    const text = (value: string): string | undefined => value.trim() || undefined;
    const base = {
      customer: { name: model.name.trim(), email: model.email.trim(), phone: text(model.phone) },
      kind: model.kind,
      honeypot: this.honeypot()?.nativeElement.value ?? '',
      homeInfo: {
        liabilityAcknowledged: model.liabilityAcknowledged,
        homeAge: model.homeAge,
        stories: Number(model.stories),
        atticAccess: model.atticAccess,
        hasMediaPanel: model.hasMediaPanel,
        mediaPanelLocation: model.hasMediaPanel ? text(model.mediaPanelLocation) : undefined,
        hasCrawlspaceOrBasement: model.hasCrawlspaceOrBasement,
        address: { street: model.street.trim(), city: model.city.trim(), state: model.state.trim(), zip: model.zip.trim() },
      },
    };
    if (model.kind === DROPS_ONLY) {
      const counts = this.counts(model)!;
      return { ...base, runs: counts.runs, services: counts.services, centralization: model.centralization || undefined };
    }
    const own = model.hasOwnEquipment;
    return {
      ...base,
      wholeHome: {
        scope: { networking: model.scope.networking, security: model.scope.security, voip: model.scope.voip },
        internetSpeed: text(model.internetSpeed),
        hasOwnEquipment: own,
        equipmentDescription: own ? text(model.equipmentDescription) : undefined,
        networkingBrand: own ? undefined : model.networkingBrand || undefined,
        securityBrand: own ? undefined : model.securityBrand || undefined,
        surveyPreference: model.surveyPreference || undefined,
        networkingDetails: model.scope.networking ? text(model.networkingDetails) : undefined,
        securityDetails: model.scope.security ? text(model.securityDetails) : undefined,
        voipDetails: model.scope.voip ? text(model.voipDetails) : undefined,
        notes: text(model.notes),
      },
    };
  }

  // What went wrong, said once: field errors on the fields, a limit or an outage as a notice, the rest as a generic one.
  // Everything the visitor typed stays, and they can send again.
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
        return;
      }
    }
    if (problem.status === 503 && problem.retryAfter === undefined && problem.detail) {
      // The API itself answered (it cannot price the request right now): the edge's "API is down" 503 always has a Retry-After.
      this.status.set({ kind: 'failed', detail: problem.detail });
    } else if (problem.status === 429) {
      this.status.set({ kind: 'rate-limited', detail: problem.detail, retryAfter: problem.retryAfter });
    } else if (isOffline(problem)) {
      this.status.set({ kind: 'offline' });
    } else {
      this.status.set({ kind: 'failed' });
    }
  }
}
