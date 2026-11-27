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
