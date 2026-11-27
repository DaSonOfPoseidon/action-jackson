import lanOptions from '@contracts/lan-options.json';

// The lan forms' option lists, from the file the API embeds too (contracts/lan-options.json). The lists exist only
// there: a value or label edited in this app would drift from what the API accepts (docs/pitfalls.md, "Status lists that
// disagree"). `value` is what the API takes, `label` is what the page shows.
export interface Option {
  readonly value: string;
  readonly label: string;
}

export const CONSULTATION_OPTIONS: {
  readonly squareFootage: readonly Option[];
  readonly currentIssues: readonly Option[];
  readonly interestedServices: readonly Option[];
  readonly interestedPackage: readonly Option[];
} = lanOptions.consultation;

// The API's longest accepted ISP name (ConsultationValidator.MaxIspLength). The contract file has no limit for it, so this
// is the one number the page states itself: the input stops there, and the API still checks.
export const ISP_MAX_LENGTH = 200;

// The quote form's option lists (POST /api/lan/quotes), from the same file.
export const QUOTE_OPTIONS: {
  readonly kinds: readonly Option[];
  readonly runTypes: readonly Option[];
  readonly centralization: readonly Option[];
  readonly homeAge: readonly Option[];
  readonly atticAccess: readonly Option[];
  readonly networkingBrand: readonly Option[];
  readonly securityBrand: readonly Option[];
  readonly surveyPreference: readonly Option[];
} = lanOptions.quote;

// The booking form's kinds (POST /api/lan/appointments).
export const BOOKING_OPTIONS: { readonly kinds: readonly Option[] } = lanOptions.booking;

interface Range {
  readonly min: number;
  readonly max: number;
}

// The limits the API checks, from the same file. The forms state them (an input's range, a text's length) and the API
// still decides.
export const LIMITS: {
  readonly runsPerType: Range;
  readonly apMounts: Range;
  readonly ethernetRelocations: Range;
  readonly stories: Range;
  readonly wholeHomeTextLength: number;
  readonly booking: { readonly durationMinutes: Range; readonly daysAhead: number; readonly notesLength: number };
} = lanOptions.limits;

// The longest texts the quote API accepts (QuoteValidator): the contract file has no limit for them, so these are the numbers
// the page states itself. The inputs stop there, and the API still checks.
export const QUOTE_LIMITS = { internetSpeed: 200, mediaPanelLocation: 200, street: 200, city: 100 } as const;
