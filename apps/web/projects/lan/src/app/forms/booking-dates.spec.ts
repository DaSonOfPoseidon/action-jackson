import { addDays, availabilityWindow, chicagoDate, chicagoWhen, formatDay, formatTime, isDay } from './booking-dates';

describe('chicagoWhen', () => {
  it('reads an instant in Chicago time, whatever offset it was written with', () => {
    expect(chicagoWhen(new Date('2026-11-30T09:00:00-06:00'))).toEqual({ date: 'Monday, November 30, 2026', time: '9:00 AM' });
    expect(chicagoWhen(new Date('2026-12-01T14:00:00+00:00'))).toEqual({ date: 'Tuesday, December 1, 2026', time: '8:00 AM' });
  });

  it('follows daylight saving time, and writes midnight and noon as 12', () => {
    // Summer: Chicago is UTC-5.
    expect(chicagoWhen(new Date('2026-07-01T17:00:00Z'))).toEqual({ date: 'Wednesday, July 1, 2026', time: '12:00 PM' });
    expect(chicagoWhen(new Date('2026-07-01T05:00:00Z'))).toEqual({ date: 'Wednesday, July 1, 2026', time: '12:00 AM' });
  });
});

describe('chicagoDate', () => {
  it('is the date in Chicago, not the UTC date, on a Chicago evening', () => {
    // 05:30 UTC on the 25th is 23:30 on the 24th in Chicago (CST, UTC-6): toISOString would say the 25th.
    const evening = new Date('2026-11-25T05:30:00Z');
    expect(evening.toISOString().slice(0, 10)).toBe('2026-11-25');
    expect(chicagoDate(evening)).toBe('2026-11-24');
  });

  it('follows daylight saving time: the same wall clock is a different UTC hour', () => {
    // 04:30 UTC on 2026-07-02 is 23:30 on the 1st in Chicago (CDT, UTC-5); 05:30 UTC is already 00:30 on the 2nd.
    expect(chicagoDate(new Date('2026-07-02T04:30:00Z'))).toBe('2026-07-01');
    expect(chicagoDate(new Date('2026-07-02T05:30:00Z'))).toBe('2026-07-02');
  });

  it('pads the month and the day', () => {
    expect(chicagoDate(new Date('2026-03-05T18:00:00Z'))).toBe('2026-03-05');
  });
});

describe('isDay', () => {
  it('is true for a real calendar day and false for anything else', () => {
    expect(isDay('2026-11-30')).toBe(true);
    expect(isDay('2028-02-29')).toBe(true);
    expect(isDay('2026-02-29')).toBe(false);
    expect(isDay('2026-13-45')).toBe(false);
    expect(isDay('<b>x</b>')).toBe(false);
    expect(isDay('')).toBe(false);
  });
});

describe('addDays', () => {
  it('adds days across a month and a year', () => {
    expect(addDays('2026-11-27', 3)).toBe('2026-11-30');
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('refuses a text that is not a date, before doing any arithmetic', () => {
    expect(() => addDays('2026-13-45', 1)).toThrow();
    expect(() => addDays('tomorrow', 1)).toThrow();
    expect(() => addDays('0001-01-01', -1)).toThrow();
  });
});

describe('availabilityWindow', () => {
  const TODAY = '2026-11-27';

  it('starts at today for the first window and holds 31 days', () => {
    expect(availabilityWindow(TODAY, 0, 90)).toEqual({ from: '2026-11-27', to: '2026-12-27' });
  });

  it('moves by 31 days, and the last window stops at the days-ahead limit', () => {
    expect(availabilityWindow(TODAY, 1, 90)).toEqual({ from: '2026-12-28', to: '2027-01-27' });
    // Day 62 to day 90: 29 days, because the API takes a `to` at most 90 days ahead.
    expect(availabilityWindow(TODAY, 2, 90)).toEqual({ from: '2027-01-28', to: '2027-02-25' });
  });

  it('has no window before today or past the limit', () => {
    expect(availabilityWindow(TODAY, -1, 90)).toBeNull();
    expect(availabilityWindow(TODAY, 3, 90)).toBeNull();
    // A window that would start exactly on the limit's last day is still one; one day past it is not.
    expect(availabilityWindow(TODAY, 1, 31)).toEqual({ from: '2026-12-28', to: '2026-12-28' });
    expect(availabilityWindow(TODAY, 1, 30)).toBeNull();
  });

  it('refuses a today that is not a date', () => {
    expect(() => availabilityWindow('9999-99-99', 0, 90)).toThrow();
  });
});

describe('formatDay and formatTime', () => {
  it('writes a date by its calendar day, whatever the time zone of the browser', () => {
    expect(formatDay('2026-11-28')).toBe('Sat, Nov 28');
    expect(formatDay('2027-01-01')).toBe('Fri, Jan 1');
  });

  it('writes a start time with am or pm', () => {
    expect(formatTime('08:00')).toBe('8:00 AM');
    expect(formatTime('12:00')).toBe('12:00 PM');
    expect(formatTime('17:30')).toBe('5:30 PM');
    expect(formatTime('00:05')).toBe('12:05 AM');
  });
});
