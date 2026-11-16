/**
 * Date utility for Addis Ababa calendar calculations.
 *
 * WHY: Ethiopia operates in East Africa Time (EAT), which is fixed at UTC+3 with
 * no Daylight Saving Time (DST). Daily mental health routines, streaks, and check-ins
 * must be anchored to the user's local day in Ethiopia rather than UTC midnight.
 * For example, 20:59:59 UTC is 23:59:59 in Addis (same day), while 21:00:00 UTC
 * is 00:00:00 in Addis (the start of the next day).
 */

export type ClockFn = () => Date;

// Default standard clock returning the current system instant
export const defaultClock: ClockFn = () => new Date();

// Intl formatter configured specifically for Africa/Addis_Ababa.
// 'en-CA' outputs ISO formatted YYYY-MM-DD.
const addisDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Africa/Addis_Ababa',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * Returns the calendar date string (YYYY-MM-DD) in Africa/Addis_Ababa for a given instant.
 * Accepts an optional clock function or Date instance for dependency injection in tests.
 */
export function getAddisDateString(instantOrClock?: Date | ClockFn): string {
  const instant =
    typeof instantOrClock === 'function'
      ? instantOrClock()
      : instantOrClock instanceof Date
        ? instantOrClock
        : defaultClock();

  return addisDateFormatter.format(instant);
}

/**
 * Returns the calendar date string (YYYY-MM-DD) for "yesterday" in Africa/Addis_Ababa.
 *
 * WHY: Streak calculation needs to know whether the user completed a routine yesterday.
 * Deriving yesterday by subtracting 1 day from the current Addis calendar date
 * guarantees accurate calendar arithmetic across month and leap-year boundaries.
 */
export function getAddisYesterdayString(instantOrClock?: Date | ClockFn): string {
  const todayStr = getAddisDateString(instantOrClock);
  const [year, month, day] = todayStr.split('-').map(Number);
  // Subtracting 1 day using UTC noon (12:00:00) avoids any daylight or boundary shifts
  const yesterdayUtc = new Date(Date.UTC(year, month - 1, day - 1, 12, 0, 0));
  return getAddisDateString(yesterdayUtc);
}

/**
 * Converts a YYYY-MM-DD date string into a Date object at UTC midnight.
 * Suitable for Prisma queries against @db.Date columns.
 */
export function parseDateStringToDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

/**
 * Formats a Date object into a YYYY-MM-DD date string using UTC fields.
 */
export function formatDateToDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}
