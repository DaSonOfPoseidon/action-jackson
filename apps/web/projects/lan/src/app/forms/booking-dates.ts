// Dates of the booking page. The business runs on Chicago time (the API takes and answers local dates and times), so every
// calendar day here is a Chicago day, written YYYY-MM-DD. A day is plain text: it is checked before any arithmetic is done
// with it (docs/pitfalls.md, "A query window built from a date before the date is checked").

const TIME_ZONE = 'America/Chicago';
const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

// The day it is in Chicago at an instant. Never toISOString(): that is the UTC day, which is already tomorrow on a Chicago
// evening.
export function chicagoDate(instant: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(instant);
  const part = (type: string): string => parts.find((p) => p.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

// The instant (UTC midnight) of a day, or throws when the text is not a real calendar day of years 1 to 9999.
function parseDay(day: string): Date {
  const match = DAY.exec(day);
  if (!match) {
    throw new Error(`Not a day: "${day}"`);
  }
  const [year, month, date] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const instant = new Date(0);
  instant.setUTCFullYear(year, month - 1, date);
  if (year < 1 || instant.getUTCFullYear() !== year || instant.getUTCMonth() !== month - 1 || instant.getUTCDate() !== date) {
    throw new Error(`Not a day: "${day}"`);
  }
  return instant;
}

// Whether the text is a real calendar day, in the shape the API writes it.
export function isDay(text: string): boolean {
  try {
    parseDay(text);
    return true;
  } catch {
    return false;
  }
}

function writeDay(instant: Date): string {
  const year = instant.getUTCFullYear();
  if (year < 1 || year > 9999) {
    throw new Error('Day out of range');
  }
  const two = (n: number): string => String(n).padStart(2, '0');
  return `${String(year).padStart(4, '0')}-${two(instant.getUTCMonth() + 1)}-${two(instant.getUTCDate())}`;
}

// A day plus (or minus) a whole number of days. Calendar arithmetic in UTC, so no time zone or daylight saving shifts it.
export function addDays(day: string, days: number): string {
  const instant = parseDay(day);
  instant.setUTCDate(instant.getUTCDate() + days);
  return writeDay(instant);
}

// Whole days from one day to another (negative when the second is earlier).
function daysBetween(from: string, to: string): number {
  return Math.round((parseDay(to).getTime() - parseDay(from).getTime()) / 86_400_000);
}

// The API takes at most 31 days (from and to included) in one call, and a `to` at most `daysAhead` days after today.
export const WINDOW_DAYS = 31;

// The `index`th window of open days: window 0 starts today, each next one starts 31 days later. Null for a window before
// today or one that starts past the limit; the last one ends at the limit. `today` is checked first.
export function availabilityWindow(today: string, index: number, daysAhead: number): { from: string; to: string } | null {
  parseDay(today);
  if (!Number.isInteger(index) || index < 0) {
    return null;
  }
  const from = addDays(today, index * WINDOW_DAYS);
  if (daysBetween(today, from) > daysAhead) {
    return null;
  }
  const last = addDays(today, daysAhead);
  const end = addDays(from, WINDOW_DAYS - 1);
  return { from, to: daysBetween(end, last) < 0 ? last : end };
}

// "Sat, Nov 28": a day by its calendar date, in UTC so the browser's own time zone cannot move it.
export function formatDay(day: string): string {
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(parseDay(day));
}

// "5:30 PM" for the API's local "HH:mm".
export function formatTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  return `${hours % 12 === 0 ? 12 : hours % 12}:${String(minutes).padStart(2, '0')} ${hours < 12 ? 'AM' : 'PM'}`;
}

// An instant as the customer reads it in Chicago: "Monday, November 30, 2026" and "9:00 AM". The time is built from the
// parts (not formatted as one string), because newer ICU puts a narrow no-break space before AM and PM.
export function chicagoWhen(instant: Date): { date: string; time: string } {
  const date = new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(instant);
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, hour: 'numeric', minute: '2-digit', hourCycle: 'h23' }).formatToParts(instant);
  const part = (type: string): number => Number(parts.find((p) => p.type === type)!.value);
  return { date, time: formatTime(`${String(part('hour')).padStart(2, '0')}:${String(part('minute')).padStart(2, '0')}`) };
}
