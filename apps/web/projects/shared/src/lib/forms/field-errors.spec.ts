import { mapFieldErrors } from './field-errors';

const FIELDS = ['customer.name', 'customer.email', 'property.currentIssues', 'interestedServices'];
const OTHER = 'Something could not be accepted.';

describe('mapFieldErrors', () => {
  it('puts the messages of a known path on that field', () => {
    const result = mapFieldErrors({ 'customer.email': ['Enter a valid email address.'] }, FIELDS, OTHER);
    expect(result.byField).toEqual({ 'customer.email': ['Enter a valid email address.'] });
    expect(result.other).toEqual([]);
  });

  it('sends an indexed path to its list field', () => {
    const result = mapFieldErrors(
      { 'property.currentIssues[2]': ['Select a valid current issues option.'], 'interestedServices[0]': ['Each services option can be chosen once.'] },
      FIELDS,
      OTHER,
    );
    expect(result.byField).toEqual({
      'property.currentIssues': ['Select a valid current issues option.'],
      interestedServices: ['Each services option can be chosen once.'],
    });
    expect(result.other).toEqual([]);
  });

  it('joins the list field and its indexed paths, without repeating a message', () => {
    const result = mapFieldErrors(
      {
        'property.currentIssues': ['Select at most 8 current issues.'],
        'property.currentIssues[1]': ['Select a valid current issues option.'],
        'property.currentIssues[5]': ['Select a valid current issues option.'],
      },
      FIELDS,
      OTHER,
    );
    expect(result.byField['property.currentIssues']).toEqual(['Select at most 8 current issues.', 'Select a valid current issues option.']);
  });

  it('sends an unknown path to other, with the generic message and never the raw key', () => {
    const result = mapFieldErrors({ honeypot: ['Bot detection triggered.'], body: ['A JSON object is required.'], 'property.nope': ['x'] }, FIELDS, OTHER);
    expect(result.byField).toEqual({});
    expect(result.other).toEqual([OTHER]);
    expect(JSON.stringify(result)).not.toMatch(/honeypot|body|nope|Bot detection|JSON object/);
  });

  it('keeps the known fields and adds the generic message when only some paths are unknown', () => {
    const result = mapFieldErrors({ 'customer.name': ['Name must be between 2 and 100 characters.'], honeypot: ['Bot detection triggered.'] }, FIELDS, OTHER);
    expect(result.byField).toEqual({ 'customer.name': ['Name must be between 2 and 100 characters.'] });
    expect(result.other).toEqual([OTHER]);
  });

  it('does not take a path that only looks like a known one', () => {
    const result = mapFieldErrors({ 'customer.name.first': ['x'], 'xcustomer.name': ['x'], 'customer.name[a]': ['x'], 'customer.name[1][2]x': ['x'] }, FIELDS, OTHER);
    expect(result.byField).toEqual({});
    expect(result.other).toEqual([OTHER]);
  });

  it('accepts a path with several indexes', () => {
    expect(mapFieldErrors({ 'interestedServices[1][0]': ['x'] }, FIELDS, OTHER).byField).toEqual({ interestedServices: ['x'] });
  });

  it('is empty for no errors', () => {
    for (const none of [undefined, {}]) {
      expect(mapFieldErrors(none, FIELDS, OTHER)).toEqual({ byField: {}, other: [] });
    }
  });

  it('does not treat names from the object prototype as fields', () => {
    const errors = Object.fromEntries([['__proto__', ['x']], ['constructor', ['y']], ['toString', ['z']]]);
    const result = mapFieldErrors(errors, FIELDS, OTHER);
    expect(Object.keys(result.byField)).toEqual([]);
    expect(result.other).toEqual([OTHER]);
    expect(({} as Record<string, unknown>)['x']).toBeUndefined();
  });
});
