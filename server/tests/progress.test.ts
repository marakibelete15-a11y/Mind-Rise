import test from 'node:test';
import assert from 'node:assert/strict';
import { Server } from 'http';
import { AddressInfo } from 'net';
import jwt from 'jsonwebtoken';
import prisma, { UserRole, AccountStatus, Language, RoutineStatus } from '@mindrise/database';
import { createApp } from '../src/app.js';
import { config } from '../src/config/index.js';
import { progressService, POINTS_PER_COMPLETION } from '../src/services/progress.service.js';

/**
 * Integration Test Suite for Part B Phase B2: Daily Check-in, Streaks, Points, and Badges
 *
 * WHY:
 * 1. Habits must strictly adhere to the Ethiopian local day (Africa/Addis_Ababa, UTC+3).
 * 2. Check-ins must be completely idempotent: retrying a check-in must not inflate points or streaks.
 * 3. Streaks increment at most once per calendar day, reset on missed days, and preserve longestStreak.
 * 4. Badges must unlock automatically and atomically when points thresholds are crossed.
 * 5. GET /routines/today must never be swallowed by GET /routines/:id.
 */

// Supertest-compatible lightweight client
class TestRequest {
  private headers: Record<string, string> = {};
  private payload: unknown = undefined;

  constructor(
    private method: string,
    private url: string
  ) {}

  set(name: string, value: string): this {
    this.headers[name.toLowerCase()] = value;
    return this;
  }

  send(data: unknown): this {
    this.payload = data;
    this.headers['content-type'] = 'application/json';
    return this;
  }

  async then<TResult1 = any, TResult2 = never>(
    onfulfilled?: (value: { status: number; body: any }) => TResult1 | PromiseLike<TResult1>,
    onrejected?: (reason: any) => TResult2 | PromiseLike<TResult2>
  ): Promise<TResult1 | TResult2> {
    try {
      const response = await fetch(this.url, {
        method: this.method,
        headers: this.headers,
        body: this.payload !== undefined ? JSON.stringify(this.payload) : undefined,
      });

      let body: any = null;
      const text = await response.text();
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        body = text;
      }

      const result = { status: response.status, body };
      return onfulfilled ? Promise.resolve(onfulfilled(result)) : (result as any);
    } catch (err) {
      if (onrejected) return Promise.resolve(onrejected(err));
      throw err;
    }
  }
}

function request(app: ReturnType<typeof createApp>, serverUrl: string) {
  return {
    get: (path: string) => new TestRequest('GET', `${serverUrl}${path}`),
    post: (path: string) => new TestRequest('POST', `${serverUrl}${path}`),
    patch: (path: string) => new TestRequest('PATCH', `${serverUrl}${path}`),
    delete: (path: string) => new TestRequest('DELETE', `${serverUrl}${path}`),
  };
}

const USER_A_ID = '00000000-0000-4000-a000-000000000021';
const USER_B_ID = '00000000-0000-4000-a000-000000000022';
const RESTRICTED_USER_ID = '00000000-0000-4000-a000-000000000023';

test('Phase B2: Check-in, Streaks, Points & Badges Tests', async (t) => {
  const app = createApp();
  let server: Server;
  let serverUrl = '';

  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address() as AddressInfo;
      serverUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });

  t.after(async () => {
    server.close();
    // Clean up test data
    await prisma.routineCompletion.deleteMany({
      where: { routine: { userId: { in: [USER_A_ID, USER_B_ID, RESTRICTED_USER_ID] } } },
    });
    await prisma.userBadge.deleteMany({
      where: { userId: { in: [USER_A_ID, USER_B_ID, RESTRICTED_USER_ID] } },
    });
    await prisma.userProgress.deleteMany({
      where: { userId: { in: [USER_A_ID, USER_B_ID, RESTRICTED_USER_ID] } },
    });
    await prisma.routine.deleteMany({
      where: { userId: { in: [USER_A_ID, USER_B_ID, RESTRICTED_USER_ID] } },
    });
  });

  // Setup test users
  await prisma.user.upsert({
    where: { id: USER_A_ID },
    update: { status: AccountStatus.ACTIVE, role: UserRole.USER, preferredLanguage: Language.EN },
    create: { id: USER_A_ID, status: AccountStatus.ACTIVE, role: UserRole.USER, preferredLanguage: Language.EN },
  });
  await prisma.user.upsert({
    where: { id: USER_B_ID },
    update: { status: AccountStatus.ACTIVE, role: UserRole.USER, preferredLanguage: Language.AM },
    create: { id: USER_B_ID, status: AccountStatus.ACTIVE, role: UserRole.USER, preferredLanguage: Language.AM },
  });
  await prisma.user.upsert({
    where: { id: RESTRICTED_USER_ID },
    update: { status: AccountStatus.RESTRICTED, role: UserRole.USER },
    create: { id: RESTRICTED_USER_ID, status: AccountStatus.RESTRICTED, role: UserRole.USER },
  });

  // Reset user data
  await prisma.routineCompletion.deleteMany({
    where: { routine: { userId: { in: [USER_A_ID, USER_B_ID, RESTRICTED_USER_ID] } } },
  });
  await prisma.userBadge.deleteMany({
    where: { userId: { in: [USER_A_ID, USER_B_ID, RESTRICTED_USER_ID] } },
  });
  await prisma.userProgress.deleteMany({
    where: { userId: { in: [USER_A_ID, USER_B_ID, RESTRICTED_USER_ID] } },
  });
  await prisma.routine.deleteMany({
    where: { userId: { in: [USER_A_ID, USER_B_ID, RESTRICTED_USER_ID] } },
  });

  const tokenUserA = jwt.sign({ id: USER_A_ID }, config.jwt.secret);
  const tokenUserB = jwt.sign({ id: USER_B_ID }, config.jwt.secret);
  const tokenRestricted = jwt.sign({ id: RESTRICTED_USER_ID }, config.jwt.secret);

  const api = request(app, serverUrl);

  // Create baseline routines for User A
  const routineA1 = await prisma.routine.create({
    data: { userId: USER_A_ID, title: 'Morning Water Habit', status: RoutineStatus.ACTIVE },
  });
  const routineA2 = await prisma.routine.create({
    data: { userId: USER_A_ID, title: 'Afternoon Breath Work', status: RoutineStatus.ACTIVE },
  });
  const routinePaused = await prisma.routine.create({
    data: { userId: USER_A_ID, title: 'Paused Routine', status: RoutineStatus.PAUSED },
  });
  const routineSoftDeleted = await prisma.routine.create({
    data: { userId: USER_A_ID, title: 'Deleted Routine', status: RoutineStatus.ACTIVE, deletedAt: new Date() },
  });

  // ---------------------------------------------------------------------------
  // 1. ROUTE ORDER & GET /routines/today NOT SWALLOWED BY :id
  // ---------------------------------------------------------------------------
  await t.test('GET /routines/today is not swallowed by /routines/:id and returns active routines with completedToday', async () => {
    const res = await api.get('/routines/today').set('Authorization', `Bearer ${tokenUserA}`);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data));
    // Should return the 2 active routines (not paused, not deleted)
    assert.equal(res.body.data.length, 2);
    for (const item of res.body.data) {
      assert.equal(typeof item.completedToday, 'boolean');
      assert.equal(item.completedToday, false);
      assert.equal(item.status, 'ACTIVE');
      assert.equal(item.deletedAt, null);
    }
  });

  // ---------------------------------------------------------------------------
  // 2. CHECK-IN HAPPY PATH & IDEMPOTENCY
  // ---------------------------------------------------------------------------
  await t.test('POST /routines/:id/checkin awards points (10), streak 1, and returns progress', async () => {
    const res = await api
      .post(`/routines/${routineA1.id}/checkin`)
      .set('Authorization', `Bearer ${tokenUserA}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.data.alreadyCompleted, false);
    assert.equal(res.body.data.pointsAwarded, POINTS_PER_COMPLETION);
    assert.equal(res.body.data.progress.points, POINTS_PER_COMPLETION);
    assert.equal(res.body.data.progress.currentStreak, 1);
    assert.equal(res.body.data.progress.longestStreak, 1);
    assert.ok(res.body.data.completion.id);
  });

  await t.test('POST /routines/:id/checkin on same routine same day is idempotent', async () => {
    const res = await api
      .post(`/routines/${routineA1.id}/checkin`)
      .set('Authorization', `Bearer ${tokenUserA}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.data.alreadyCompleted, true);
    assert.equal(res.body.data.pointsAwarded, 0);
    // Points and streak must not have incremented
    assert.equal(res.body.data.progress.points, POINTS_PER_COMPLETION);
    assert.equal(res.body.data.progress.currentStreak, 1);
  });

  await t.test('GET /routines/today now reflects completedToday: true for routineA1', async () => {
    const res = await api.get('/routines/today').set('Authorization', `Bearer ${tokenUserA}`);
    assert.equal(res.status, 200);

    const r1 = res.body.data.find((r: any) => r.id === routineA1.id);
    const r2 = res.body.data.find((r: any) => r.id === routineA2.id);

    assert.equal(r1.completedToday, true);
    assert.equal(r2.completedToday, false);
  });

  await t.test('Two DIFFERENT routines on same day give points for both, but streak increments only once', async () => {
    const res = await api
      .post(`/routines/${routineA2.id}/checkin`)
      .set('Authorization', `Bearer ${tokenUserA}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.data.alreadyCompleted, false);
    assert.equal(res.body.data.pointsAwarded, POINTS_PER_COMPLETION);
    // 10 + 10 = 20 points
    assert.equal(res.body.data.progress.points, 20);
    // Streak was already updated today, so it remains 1
    assert.equal(res.body.data.progress.currentStreak, 1);
    assert.equal(res.body.data.progress.longestStreak, 1);
  });

  // ---------------------------------------------------------------------------
  // 3. NEGATIVE CASES: PAUSED, DELETED, OTHER USER, RESTRICTED
  // ---------------------------------------------------------------------------
  await t.test('Cannot check in to a PAUSED routine (returns 400 ROUTINE_NOT_ACTIVE)', async () => {
    const res = await api
      .post(`/routines/${routinePaused.id}/checkin`)
      .set('Authorization', `Bearer ${tokenUserA}`);

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'ROUTINE_NOT_ACTIVE');
  });

  await t.test('Cannot check in to a soft-deleted routine (returns 404 ROUTINE_NOT_FOUND)', async () => {
    const res = await api
      .post(`/routines/${routineSoftDeleted.id}/checkin`)
      .set('Authorization', `Bearer ${tokenUserA}`);

    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, 'ROUTINE_NOT_FOUND');
  });

  await t.test('User B cannot check in to User A routine (returns 404 ROUTINE_NOT_FOUND)', async () => {
    const res = await api
      .post(`/routines/${routineA1.id}/checkin`)
      .set('Authorization', `Bearer ${tokenUserB}`);

    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, 'ROUTINE_NOT_FOUND');
  });

  await t.test('RESTRICTED user blocked from checkin (returns 403 ACCOUNT_RESTRICTED)', async () => {
    const res = await api
      .post(`/routines/${routineA1.id}/checkin`)
      .set('Authorization', `Bearer ${tokenRestricted}`);

    assert.equal(res.status, 403);
    assert.equal(res.body.error.code, 'ACCOUNT_RESTRICTED');
  });

  // ---------------------------------------------------------------------------
  // 4. PROGRESS & BADGES ENDPOINTS
  // ---------------------------------------------------------------------------
  await t.test('GET /api/progress returns points, effective streak, longestStreak, and earned badges', async () => {
    const res = await api.get('/api/progress').set('Authorization', `Bearer ${tokenUserA}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.points, 20);
    assert.equal(res.body.data.currentStreak, 1);
    assert.equal(res.body.data.longestStreak, 1);
    assert.ok(Array.isArray(res.body.data.earnedBadges));
    // User crossed 10 points on check-in, so 'first-routine' badge should be earned
    const firstStepBadge = res.body.data.earnedBadges.find((b: any) => b.slug === 'first-routine');
    assert.ok(firstStepBadge, 'Expected first-routine badge to be earned');
  });

  await t.test('GET /api/badges returns all badges with earned boolean and localization', async () => {
    // English
    const resEn = await api.get('/api/badges?lang=en').set('Authorization', `Bearer ${tokenUserA}`);
    assert.equal(resEn.status, 200);
    assert.ok(resEn.body.data.length >= 4);
    const firstStep = resEn.body.data.find((b: any) => b.slug === 'first-routine');
    assert.equal(firstStep.earned, true);
    assert.equal(firstStep.name, 'First Step');

    // Amharic
    const resAm = await api.get('/api/badges?lang=am').set('Authorization', `Bearer ${tokenUserA}`);
    assert.equal(resAm.status, 200);
    const firstStepAm = resAm.body.data.find((b: any) => b.slug === 'first-routine');
    assert.equal(firstStepAm.earned, true);
    assert.equal(firstStepAm.name, 'የመጀመሪያ እርምጃ');
  });

  // ---------------------------------------------------------------------------
  // 5. DETERMINISTIC MULTI-DAY STREAK & GAP SIMULATION (USING INJECTED CLOCKS)
  // ---------------------------------------------------------------------------
  await t.test('Multi-day streak simulation: consecutive days, gap reset, longestStreak preservation', async () => {
    // Clean user progress and completions for User B
    await prisma.routineCompletion.deleteMany({ where: { routine: { userId: USER_B_ID } } });
    await prisma.userProgress.deleteMany({ where: { userId: USER_B_ID } });
    await prisma.routine.deleteMany({ where: { userId: USER_B_ID } });

    const routineB = await prisma.routine.create({
      data: { userId: USER_B_ID, title: 'User B Daily Habit', status: RoutineStatus.ACTIVE },
    });

    // Day 1: 2026-10-01 (12:00 EAT)
    const clockDay1 = () => new Date('2026-10-01T09:00:00.000Z');
    const d1 = await progressService.checkIn(USER_B_ID, routineB.id, clockDay1);
    assert.equal(d1.progress.currentStreak, 1);
    assert.equal(d1.progress.longestStreak, 1);
    assert.equal(d1.progress.points, 10);

    // Day 2: 2026-10-02 (Consecutive day)
    const clockDay2 = () => new Date('2026-10-02T09:00:00.000Z');
    const d2 = await progressService.checkIn(USER_B_ID, routineB.id, clockDay2);
    assert.equal(d2.progress.currentStreak, 2);
    assert.equal(d2.progress.longestStreak, 2);
    assert.equal(d2.progress.points, 20);

    // Day 3: 2026-10-03 (Consecutive day)
    const clockDay3 = () => new Date('2026-10-03T09:00:00.000Z');
    const d3 = await progressService.checkIn(USER_B_ID, routineB.id, clockDay3);
    assert.equal(d3.progress.currentStreak, 3);
    assert.equal(d3.progress.longestStreak, 3);
    assert.equal(d3.progress.points, 30);

    // Skip Day 4 (2026-10-04)
    // On Day 5 (2026-10-05) BEFORE check-in: effective streak on read should be 0!
    const clockDay5Before = () => new Date('2026-10-05T08:00:00.000Z');
    const readDay5 = await progressService.getUserProgress(USER_B_ID, 'en', clockDay5Before);
    assert.equal(readDay5.currentStreak, 0, 'Effective streak on read must be 0 after a skipped day');
    assert.equal(readDay5.longestStreak, 3, 'longestStreak must be preserved');

    // Day 5 Check-in: resets current streak to 1, while longestStreak stays 3!
    const d5 = await progressService.checkIn(USER_B_ID, routineB.id, clockDay5Before);
    assert.equal(d5.progress.currentStreak, 1, 'Current streak should reset to 1 after gap');
    assert.equal(d5.progress.longestStreak, 3, 'longestStreak must remain 3');
    assert.equal(d5.progress.points, 40);
  });

  // ---------------------------------------------------------------------------
  // 6. ADDIS ABABA MIDNIGHT BOUNDARY (20:59 UTC vs 21:00 UTC)
  // ---------------------------------------------------------------------------
  await t.test('Addis midnight boundary: 20:59 UTC and 21:00 UTC on same UTC date are different Addis days', async () => {
    await prisma.routineCompletion.deleteMany({ where: { routine: { userId: USER_B_ID } } });
    await prisma.userProgress.deleteMany({ where: { userId: USER_B_ID } });

    const routine = await prisma.routine.findFirstOrThrow({ where: { userId: USER_B_ID } });

    // 20:59:00 UTC on Nov 10 is 23:59:00 EAT in Addis (Day 1)
    const clockBeforeMidnight = () => new Date('2026-11-10T20:59:00.000Z');
    const r1 = await progressService.checkIn(USER_B_ID, routine.id, clockBeforeMidnight);
    assert.equal(r1.progress.lastCompletedDate, '2026-11-10');
    assert.equal(r1.progress.currentStreak, 1);

    // 21:01:00 UTC on Nov 10 is 00:01:00 EAT on Nov 11 in Addis (Day 2 - Consecutive!)
    const clockAfterMidnight = () => new Date('2026-11-10T21:01:00.000Z');
    const r2 = await progressService.checkIn(USER_B_ID, routine.id, clockAfterMidnight);
    assert.equal(r2.progress.lastCompletedDate, '2026-11-11');
    assert.equal(r2.progress.currentStreak, 2, 'Streak should increment across Addis midnight');
  });

  // ---------------------------------------------------------------------------
  // 7. CONCURRENT DOUBLE CHECK-IN (RACE CONDITION DEFENSE)
  // ---------------------------------------------------------------------------
  await t.test('Concurrent double check-in (Promise.all) awards points exactly once', async () => {
    // New routine for test
    const concurrentRoutine = await prisma.routine.create({
      data: { userId: USER_A_ID, title: 'Concurrent Race Test', status: RoutineStatus.ACTIVE },
    });

    const clock = () => new Date('2026-12-25T10:00:00.000Z');

    // Fire 2 concurrent check-in requests simultaneously
    const [res1, res2] = await Promise.all([
      progressService.checkIn(USER_A_ID, concurrentRoutine.id, clock),
      progressService.checkIn(USER_A_ID, concurrentRoutine.id, clock),
    ]);

    // One must have succeeded with pointsAwarded = 10, the other must have alreadyCompleted = true with pointsAwarded = 0
    const alreadyCompletedCount = (res1.alreadyCompleted ? 1 : 0) + (res2.alreadyCompleted ? 1 : 0);
    const pointsAwardedTotal = res1.pointsAwarded + res2.pointsAwarded;

    assert.equal(alreadyCompletedCount, 1, 'Exactly one request must be marked alreadyCompleted');
    assert.equal(pointsAwardedTotal, 10, 'Total points awarded across both concurrent requests must be 10');
  });
});
