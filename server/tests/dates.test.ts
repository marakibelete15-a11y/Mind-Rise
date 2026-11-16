import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getAddisDateString,
  getAddisYesterdayString,
  parseDateStringToDate,
  formatDateToDateString,
  getAddisDayRange,
} from '../src/utils/dates.js';

test('getAddisDateString resolves 20:59 UTC and 21:00 UTC to different Addis days (UTC+3)', () => {
  // 2026-11-16 at 20:59:59 UTC is 23:59:59 in Addis Ababa (same day)
  const instantBeforeMidnight = new Date('2026-11-16T20:59:59.000Z');
  assert.equal(getAddisDateString(instantBeforeMidnight), '2026-11-16');

  // 2026-11-16 at 21:00:00 UTC is 00:00:00 in Addis Ababa (next day: Nov 17)
  const instantAtMidnight = new Date('2026-11-16T21:00:00.000Z');
  assert.equal(getAddisDateString(instantAtMidnight), '2026-11-17');
});

test('getAddisDateString works with injectable clock functions', () => {
  let simulatedTime = new Date('2026-05-10T12:00:00.000Z');
  const clock = () => simulatedTime;

  assert.equal(getAddisDateString(clock), '2026-05-10');

  // Advance clock
  simulatedTime = new Date('2026-05-11T03:00:00.000Z');
  assert.equal(getAddisDateString(clock), '2026-05-11');
});

test('getAddisYesterdayString correctly calculates previous calendar day across boundaries', () => {
  // Regular day
  assert.equal(getAddisYesterdayString(new Date('2026-11-16T10:00:00.000Z')), '2026-11-15');

  // Month boundary (March 1 in non-leap year 2026 -> Feb 28)
  assert.equal(getAddisYesterdayString(new Date('2026-03-01T10:00:00.000Z')), '2026-02-28');

  // Leap year boundary (March 1 in leap year 2024 -> Feb 29)
  assert.equal(getAddisYesterdayString(new Date('2024-03-01T10:00:00.000Z')), '2024-02-29');

  // Year boundary (January 1 -> December 31)
  assert.equal(getAddisYesterdayString(new Date('2026-01-01T10:00:00.000Z')), '2025-12-31');
});

test('parseDateStringToDate and formatDateToDateString round-trip cleanly', () => {
  const dateStr = '2026-11-16';
  const parsed = parseDateStringToDate(dateStr);

  assert.equal(parsed.toISOString(), '2026-11-16T00:00:00.000Z');
  assert.equal(formatDateToDateString(parsed), dateStr);
});

test('getAddisDayRange returns exact UTC start and end bounds for the Addis day', () => {
  const now = new Date('2026-11-16T10:00:00.000Z');
  const { startUtc, endUtc, addisDateStr } = getAddisDayRange(now);

  assert.equal(addisDateStr, '2026-11-16');
  // 00:00:00 in Addis on Nov 16 is 21:00:00 UTC on Nov 15
  assert.equal(startUtc.toISOString(), '2026-11-15T21:00:00.000Z');
  // 23:59:59.999 in Addis on Nov 16 is 20:59:59.999 UTC on Nov 16
  assert.equal(endUtc.toISOString(), '2026-11-16T20:59:59.999Z');
  assert.equal(getAddisDateString(startUtc), '2026-11-16');
  assert.equal(getAddisDateString(endUtc), '2026-11-16');
});
