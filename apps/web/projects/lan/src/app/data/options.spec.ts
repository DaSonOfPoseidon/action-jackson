import lanOptions from '@contracts/lan-options.json';
import { BOOKING_OPTIONS, CONSULTATION_OPTIONS, LIMITS, QUOTE_LIMITS, QUOTE_OPTIONS } from './options';

// The lists are the contract file's, not copies: an edit there reaches the forms, and nothing is written twice.
describe('options', () => {
  it('exports the consultation, quote and booking lists of the contract, by identity', () => {
    expect(CONSULTATION_OPTIONS).toBe(lanOptions.consultation);
    expect(QUOTE_OPTIONS).toBe(lanOptions.quote);
    expect(BOOKING_OPTIONS).toBe(lanOptions.booking);
  });

  it('has the quote lists the form needs, with the contract lengths', () => {
    expect(QUOTE_OPTIONS.kinds.map((o) => o.value)).toEqual(['drops-only', 'whole-home']);
    expect(QUOTE_OPTIONS.runTypes.map((o) => o.value)).toEqual(['cat6', 'cat6a', 'coax', 'fiber']);
    expect(QUOTE_OPTIONS.centralization.length).toBe(3);
    expect(QUOTE_OPTIONS.homeAge.length).toBe(5);
    expect(QUOTE_OPTIONS.atticAccess.length).toBe(4);
    expect(QUOTE_OPTIONS.networkingBrand.length).toBe(4);
    expect(QUOTE_OPTIONS.securityBrand.length).toBe(3);
    expect(QUOTE_OPTIONS.surveyPreference.length).toBe(2);
    expect(BOOKING_OPTIONS.kinds.map((o) => o.value)).toEqual(['survey', 'drops-only-install', 'whole-home-install']);
  });

  it('exports the limits of the contract, by identity', () => {
    expect(LIMITS).toBe(lanOptions.limits);
    expect(LIMITS.runsPerType).toEqual({ min: 0, max: 50 });
    expect(LIMITS.apMounts.max).toBe(20);
    expect(LIMITS.ethernetRelocations.max).toBe(20);
    expect(LIMITS.stories).toEqual({ min: 1, max: 4 });
    expect(LIMITS.wholeHomeTextLength).toBe(2000);
    expect(LIMITS.booking).toEqual({ durationMinutes: { min: 60, max: 720 }, daysAhead: 90, notesLength: 500 });
  });

  it('states the text limits the contract has no number for', () => {
    expect(QUOTE_LIMITS).toEqual({ internetSpeed: 200, mediaPanelLocation: 200, street: 200, city: 100 });
  });
});
