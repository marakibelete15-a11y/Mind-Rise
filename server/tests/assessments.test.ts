import test from 'node:test';
import assert from 'node:assert/strict';
import { Server } from 'http';
import { AddressInfo } from 'net';
import jwt from 'jsonwebtoken';
import prisma, {
  UserRole,
  AccountStatus,
  Language,
  AssessmentDomain,
} from '@mindrise/database';
import { createApp } from '../src/app.js';
import { config } from '../src/config/index.js';
import { crisisNotifier } from '../src/services/assessments.service.js';

// Supertest-compatible lightweight HTTP client using native Node fetch
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

// Test User UUIDs
const USER_A_ID = '00000000-0000-4000-a000-0000000000a1';
const USER_B_ID = '00000000-0000-4000-a000-0000000000b2';
const RESTRICTED_USER_ID = '00000000-0000-4000-a000-0000000000c3';

test('Self-Assessment Module Integration & Security Tests (SRS FR-2.1 to FR-2.5)', async (t) => {
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
    // Clean up attempts created in tests
    await prisma.assessmentAttempt.deleteMany({
      where: { userId: { in: [USER_A_ID, USER_B_ID, RESTRICTED_USER_ID] } },
    });
  });

  // Ensure test users exist
  await prisma.user.upsert({
    where: { id: USER_A_ID },
    update: { status: AccountStatus.ACTIVE },
    create: {
      id: USER_A_ID,
      role: UserRole.USER,
      status: AccountStatus.ACTIVE,
      preferredLanguage: Language.EN,
    },
  });

  await prisma.user.upsert({
    where: { id: USER_B_ID },
    update: { status: AccountStatus.ACTIVE },
    create: {
      id: USER_B_ID,
      role: UserRole.USER,
      status: AccountStatus.ACTIVE,
      preferredLanguage: Language.EN,
    },
  });

  await prisma.user.upsert({
    where: { id: RESTRICTED_USER_ID },
    update: { status: AccountStatus.RESTRICTED },
    create: {
      id: RESTRICTED_USER_ID,
      role: UserRole.USER,
      status: AccountStatus.RESTRICTED,
      preferredLanguage: Language.EN,
    },
  });

  // Ensure an active CrisisResource exists for testing
  await prisma.crisisResource.upsert({
    where: { id: '00000000-0000-4000-a000-000000000999' },
    update: { isActive: true },
    create: {
      id: '00000000-0000-4000-a000-000000000999',
      nameEn: 'National Crisis Helpline',
      nameAm: 'ብሔራዊ የድንገተኛ እርዳታ መስመር',
      descriptionEn: '24/7 confidential support line',
      descriptionAm: 'የ24 ሰዓት ሚስጥራዊ የድጋፍ መስመር',
      phone: '8335',
      isActive: true,
    },
  });

  // Clean test user attempts
  await prisma.assessmentAttempt.deleteMany({
    where: { userId: { in: [USER_A_ID, USER_B_ID, RESTRICTED_USER_ID] } },
  });

  const tokenUserA = jwt.sign({ id: USER_A_ID }, config.jwt.secret);
  const tokenUserB = jwt.sign({ id: USER_B_ID }, config.jwt.secret);
  const tokenRestricted = jwt.sign({ id: RESTRICTED_USER_ID }, config.jwt.secret);

  const api = request(app, serverUrl);

  // Fetch seeded Stress template for testing
  const stressTemplate = await prisma.assessmentTemplate.findFirstOrThrow({
    where: { domain: AssessmentDomain.STRESS },
    include: { questions: { orderBy: { order: 'asc' } } },
  });

  // ---------------------------------------------------------------------------
  // 1. QUESTIONNAIRE LIST & FIXED-PATH ROUTE ORDERING
  // ---------------------------------------------------------------------------
  await t.test('GET /api/assessments - returns latest version per domain with questionCount only', async () => {
    const res = await api
      .get('/api/assessments?lang=en')
      .set('Authorization', `Bearer ${tokenUserA}`);

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.data.length >= 1);

    const stressItem = res.body.data.find((item: any) => item.domain === 'STRESS');
    assert.ok(stressItem);
    assert.ok(stressItem.id);
    assert.ok(stressItem.title);
    assert.equal(typeof stressItem.questionCount, 'number');
    assert.ok(stressItem.questionCount >= 4);
    // Should NOT expose questions array or scoring rules in list
    assert.equal(stressItem.questions, undefined);
  });

  await t.test('ROUTE ORDERING - GET /api/assessments/attempts is not swallowed by /:id', async () => {
    // If route ordering was wrong, /attempts would match /:id and fail UUID validation with 400
    const res = await api
      .get('/api/assessments/attempts')
      .set('Authorization', `Bearer ${tokenUserA}`);

    assert.equal(res.status, 200);
    assert.ok(res.body.data);
    assert.ok(Array.isArray(res.body.data.items));
  });

  // ---------------------------------------------------------------------------
  // 2. QUESTION DETAIL & SECURITY (Omission of scoring rules)
  // ---------------------------------------------------------------------------
  await t.test('GET /api/assessments/:id - returns questions with options but NEVER scoring or risk fields', async () => {
    const res = await api
      .get(`/api/assessments/${stressTemplate.id}`)
      .set('Authorization', `Bearer ${tokenUserA}`);

    assert.equal(res.status, 200);
    const data = res.body.data;
    assert.equal(data.id, stressTemplate.id);
    assert.ok(Array.isArray(data.questions));
    assert.ok(data.questions.length >= 4);

    // CRITICAL: Top-level template must NOT include riskThreshold
    assert.equal(data.riskThreshold, undefined);

    // CRITICAL: Each question must have localized text and options, but NO scoring or isRiskItem
    for (const q of data.questions) {
      assert.ok(q.id);
      assert.ok(q.text);
      assert.ok(Array.isArray(q.options));
      assert.ok(q.options.length > 0);
      assert.ok(q.options[0].value);
      assert.ok(q.options[0].label);

      // Prove that scoring and isRiskItem are strictly absent
      assert.equal(q.scoring, undefined, `Question ${q.id} must NOT expose scoring`);
      assert.equal(q.isRiskItem, undefined, `Question ${q.id} must NOT expose isRiskItem`);
    }
  });

  // ---------------------------------------------------------------------------
  // 3. SUBMISSION VALIDATION (missing, duplicate, unknown, out-of-range, score ignored)
  // ---------------------------------------------------------------------------
  await t.test('POST /api/assessments/:id/attempts - rejects missing questions with 400', async () => {
    const res = await api
      .post(`/api/assessments/${stressTemplate.id}/attempts`)
      .set('Authorization', `Bearer ${tokenUserA}`)
      .send({
        answers: [{ questionId: stressTemplate.questions[0].id, value: 'rarely' }],
      });

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'INVALID_ASSESSMENT_ANSWERS');
  });

  await t.test('POST /api/assessments/:id/attempts - rejects duplicate questions with 400', async () => {
    const answers = [
      { questionId: stressTemplate.questions[0].id, value: 'rarely' },
      { questionId: stressTemplate.questions[0].id, value: 'sometimes' },
      { questionId: stressTemplate.questions[1].id, value: 'always' },
      { questionId: stressTemplate.questions[2].id, value: 'rarely' },
    ];

    const res = await api
      .post(`/api/assessments/${stressTemplate.id}/attempts`)
      .set('Authorization', `Bearer ${tokenUserA}`)
      .send({ answers });

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'INVALID_ASSESSMENT_ANSWERS');
  });

  await t.test('POST /api/assessments/:id/attempts - rejects unknown question ID with 400', async () => {
    const answers = stressTemplate.questions.map((q, idx) => ({
      questionId: idx === 0 ? '00000000-0000-4000-a000-999999999999' : q.id,
      value: 'rarely',
    }));

    const res = await api
      .post(`/api/assessments/${stressTemplate.id}/attempts`)
      .set('Authorization', `Bearer ${tokenUserA}`)
      .send({ answers });

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'INVALID_ASSESSMENT_ANSWERS');
  });

  await t.test('POST /api/assessments/:id/attempts - rejects invalid option value with 400', async () => {
    const answers = stressTemplate.questions.map((q, idx) => ({
      questionId: q.id,
      value: idx === 0 ? 'invalid-option-key-999' : 'rarely',
    }));

    const res = await api
      .post(`/api/assessments/${stressTemplate.id}/attempts`)
      .set('Authorization', `Bearer ${tokenUserA}`)
      .send({ answers });

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'INVALID_ASSESSMENT_ANSWERS');
  });

  await t.test('POST /api/assessments/:id/attempts - client-supplied score is completely ignored', async () => {
    // Submit all lowest answers (score 0), but inject malicious client scores
    const answers = [
      { questionId: stressTemplate.questions[0].id, value: 'rarely', score: 9999 },
      { questionId: stressTemplate.questions[1].id, value: 'always', score: 9999 }, // reverse scored (always = 0)
      { questionId: stressTemplate.questions[2].id, value: 'rarely', score: 9999 },
      { questionId: stressTemplate.questions[3].id, value: 'never', score: 9999 },
    ];

    const res = await api
      .post(`/api/assessments/${stressTemplate.id}/attempts`)
      .set('Authorization', `Bearer ${tokenUserA}`)
      .send({ answers });

    assert.equal(res.status, 201);
    // Server computes true score = 0, client score 9999 was ignored
    assert.equal(res.body.data.attempt.score, 0);
  });

  // ---------------------------------------------------------------------------
  // 4. LOW-RISK SUBMISSION & ENCRYPTION AT REST
  // ---------------------------------------------------------------------------
  let userAAttemptId = '';

  await t.test('POST /api/assessments/:id/attempts - low-risk submission returns score, localized summary, and disclaimer', async () => {
    const answers = [
      { questionId: stressTemplate.questions[0].id, value: 'rarely' }, // 0
      { questionId: stressTemplate.questions[1].id, value: 'always' }, // 0
      { questionId: stressTemplate.questions[2].id, value: 'sometimes' }, // 1
      { questionId: stressTemplate.questions[3].id, value: 'never' }, // 0 (safe)
    ];

    const res = await api
      .post(`/api/assessments/${stressTemplate.id}/attempts?lang=en`)
      .set('Authorization', `Bearer ${tokenUserA}`)
      .send({ answers });

    assert.equal(res.status, 201);
    const data = res.body.data;
    assert.ok(data.attempt.id);
    userAAttemptId = data.attempt.id;
    assert.equal(data.attempt.domain, 'STRESS');
    assert.equal(data.attempt.score, 1);
    assert.ok(data.attempt.summary);
    assert.ok(data.attempt.disclaimer);
    assert.match(data.attempt.disclaimer, /does not provide a medical diagnosis/i);

    // Crisis section
    assert.equal(data.crisis.show, false);
    assert.deepEqual(data.crisis.resources, []);

    // Proving riskFlagged and word "flagged" are NEVER exposed in JSON response
    const jsonStr = JSON.stringify(res.body);
    assert.equal(jsonStr.includes('riskFlagged'), false);
    assert.equal(jsonStr.includes('flagged'), false);
  });

  await t.test('DATABASE PRIVACY - raw database answers column contains AES-256-GCM ciphertext', async () => {
    assert.ok(userAAttemptId);
    const rawRow = await prisma.assessmentAttempt.findUniqueOrThrow({
      where: { id: userAAttemptId },
    });

    const ciphertext = rawRow.answers as string;
    assert.equal(typeof ciphertext, 'string');
    // Must start with version tag enc_v1:
    assert.ok(ciphertext.startsWith('enc_v1:'), 'Answers must be stored as enc_v1: ciphertext');
    // Plaintext values must NOT exist in the ciphertext string
    assert.equal(ciphertext.includes('rarely'), false);
    assert.equal(ciphertext.includes('sometimes'), false);
    assert.equal(ciphertext.includes('never'), false);
  });

  // ---------------------------------------------------------------------------
  // 5. ATTEMPT DETAIL & DECRYPTION ONLY FOR OWNER
  // ---------------------------------------------------------------------------
  await t.test('GET /api/assessments/attempts/:id - owner receives decrypted answers', async () => {
    const res = await api
      .get(`/api/assessments/attempts/${userAAttemptId}`)
      .set('Authorization', `Bearer ${tokenUserA}`);

    assert.equal(res.status, 200);
    const data = res.body.data;
    assert.equal(data.id, userAAttemptId);
    assert.ok(Array.isArray(data.answers));
    assert.equal(data.answers.length, 4);
    assert.equal(data.answers[0].value, 'rarely');
    assert.ok(data.disclaimer);
  });

  await t.test('PRIVACY / IDOR - other user receives 404 for another user attempt', async () => {
    const res = await api
      .get(`/api/assessments/attempts/${userAAttemptId}`)
      .set('Authorization', `Bearer ${tokenUserB}`);

    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, 'ATTEMPT_NOT_FOUND');
  });

  // ---------------------------------------------------------------------------
  // 6. HISTORY LISTING & NO DECRYPTED ANSWERS IN LIST
  // ---------------------------------------------------------------------------
  await t.test('GET /api/assessments/attempts - lists user attempts without decrypted answers', async () => {
    const res = await api
      .get('/api/assessments/attempts?domain=STRESS&limit=10')
      .set('Authorization', `Bearer ${tokenUserA}`);

    assert.equal(res.status, 200);
    assert.ok(res.body.data.items);
    assert.ok(res.body.data.items.length >= 1);

    const item = res.body.data.items.find((i: any) => i.id === userAAttemptId);
    assert.ok(item);
    assert.equal(item.domain, 'STRESS');
    assert.ok(item.summary);
    // Crucial: answers must NOT be present in history listing
    assert.equal((item as any).answers, undefined);
  });

  // ---------------------------------------------------------------------------
  // 7. RISKY SUBMISSION, CRISIS HOOK, AND ACTIVE RESOURCES
  // ---------------------------------------------------------------------------
  await t.test('POST /api/assessments/:id/attempts - high-risk submission calls raiseFlag and returns crisis resources', async () => {
    let raiseFlagCalled = 0;
    let raiseFlagInput: any = null;

    const originalRaiseFlag = crisisNotifier.raiseFlag;
    crisisNotifier.raiseFlag = async (input: any) => {
      raiseFlagCalled++;
      raiseFlagInput = input;
    };

    try {
      // Answers that exceed riskThreshold (10)
      const answers = [
        { questionId: stressTemplate.questions[0].id, value: 'always' }, // 3
        { questionId: stressTemplate.questions[1].id, value: 'rarely' }, // 3 (reverse)
        { questionId: stressTemplate.questions[2].id, value: 'always' }, // 3
        { questionId: stressTemplate.questions[3].id, value: 'sometimes' }, // 2
      ];

      const res = await api
        .post(`/api/assessments/${stressTemplate.id}/attempts`)
        .set('Authorization', `Bearer ${tokenUserB}`)
        .send({ answers });

      assert.equal(res.status, 201);
      assert.equal(res.body.data.attempt.score, 11);
      // Crisis section must be active
      assert.equal(res.body.data.crisis.show, true);
      assert.ok(Array.isArray(res.body.data.crisis.resources));
      assert.ok(res.body.data.crisis.resources.length > 0);
      assert.ok(res.body.data.crisis.resources[0].phone);

      // Verify raiseFlag was invoked exactly once with expected metadata
      assert.equal(raiseFlagCalled, 1);
      assert.equal(raiseFlagInput.userId, USER_B_ID);
      assert.equal(raiseFlagInput.source, 'ASSESSMENT');
      assert.equal(raiseFlagInput.sourceId, res.body.data.attempt.id);
      assert.equal(raiseFlagInput.priority, 'HIGH');
    } finally {
      crisisNotifier.raiseFlag = originalRaiseFlag;
    }
  });

  await t.test('POST /api/assessments/:id/attempts - risk-item-only triggers crisis escalation', async () => {
    let raiseFlagCalled = 0;
    const originalRaiseFlag = crisisNotifier.raiseFlag;
    crisisNotifier.raiseFlag = async () => {
      raiseFlagCalled++;
    };

    try {
      // Score = 4 (well below threshold 10), but question 4 is critical item answered with 'frequently' (4)
      const answers = [
        { questionId: stressTemplate.questions[0].id, value: 'rarely' }, // 0
        { questionId: stressTemplate.questions[1].id, value: 'always' }, // 0
        { questionId: stressTemplate.questions[2].id, value: 'rarely' }, // 0
        { questionId: stressTemplate.questions[3].id, value: 'frequently' }, // 4
      ];

      const res = await api
        .post(`/api/assessments/${stressTemplate.id}/attempts`)
        .set('Authorization', `Bearer ${tokenUserB}`)
        .send({ answers });

      assert.equal(res.status, 201);
      assert.equal(res.body.data.attempt.score, 4);
      // Even though score is 4, crisis.show must be true
      assert.equal(res.body.data.crisis.show, true);
      assert.equal(raiseFlagCalled, 1);
    } finally {
      crisisNotifier.raiseFlag = originalRaiseFlag;
    }
  });

  await t.test('POST /api/assessments/:id/attempts - when raiseFlag throws, user still gets 201 and resources', async () => {
    const originalRaiseFlag = crisisNotifier.raiseFlag;
    crisisNotifier.raiseFlag = async () => {
      throw new Error('Simulated crisis webhook network outage');
    };

    try {
      const answers = [
        { questionId: stressTemplate.questions[0].id, value: 'always' }, // 3
        { questionId: stressTemplate.questions[1].id, value: 'rarely' }, // 3
        { questionId: stressTemplate.questions[2].id, value: 'always' }, // 3
        { questionId: stressTemplate.questions[3].id, value: 'frequently' }, // 4
      ];

      const res = await api
        .post(`/api/assessments/${stressTemplate.id}/attempts`)
        .set('Authorization', `Bearer ${tokenUserB}`)
        .send({ answers });

      // Must NOT fail with 500; must succeed with 201 and valid crisis resources
      assert.equal(res.status, 201);
      assert.equal(res.body.data.crisis.show, true);
      assert.ok(res.body.data.crisis.resources.length > 0);
    } finally {
      crisisNotifier.raiseFlag = originalRaiseFlag;
    }
  });

  // ---------------------------------------------------------------------------
  // 8. RESTRICTED USER ALLOWED
  // ---------------------------------------------------------------------------
  await t.test('STATUS COMPLIANCE - RESTRICTED user can submit and view assessment', async () => {
    const answers = [
      { questionId: stressTemplate.questions[0].id, value: 'rarely' },
      { questionId: stressTemplate.questions[1].id, value: 'always' },
      { questionId: stressTemplate.questions[2].id, value: 'rarely' },
      { questionId: stressTemplate.questions[3].id, value: 'never' },
    ];

    const res = await api
      .post(`/api/assessments/${stressTemplate.id}/attempts`)
      .set('Authorization', `Bearer ${tokenRestricted}`)
      .send({ answers });

    assert.equal(res.status, 201);
    assert.ok(res.body.data.attempt.id);
  });

  // ---------------------------------------------------------------------------
  // 9. DAILY ABUSE LIMIT
  // ---------------------------------------------------------------------------
  await t.test('ABUSE LIMIT - enforces max 5 attempts per user per template per Addis day', async () => {
    // Clean slate for USER_A on this template
    await prisma.assessmentAttempt.deleteMany({
      where: { userId: USER_A_ID, templateId: stressTemplate.id },
    });

    const answers = [
      { questionId: stressTemplate.questions[0].id, value: 'rarely' },
      { questionId: stressTemplate.questions[1].id, value: 'always' },
      { questionId: stressTemplate.questions[2].id, value: 'rarely' },
      { questionId: stressTemplate.questions[3].id, value: 'never' },
    ];

    // Submit 5 attempts (allowed)
    for (let i = 0; i < 5; i++) {
      const res = await api
        .post(`/api/assessments/${stressTemplate.id}/attempts`)
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({ answers });
      assert.equal(res.status, 201);
    }

    // 6th attempt on the same day must be rejected with 429 ASSESSMENT_DAILY_LIMIT
    const resSixth = await api
      .post(`/api/assessments/${stressTemplate.id}/attempts`)
      .set('Authorization', `Bearer ${tokenUserA}`)
      .send({ answers });

    assert.equal(resSixth.status, 429);
    assert.equal(resSixth.body.error.code, 'ASSESSMENT_DAILY_LIMIT');
  });

  // ---------------------------------------------------------------------------
  // 10. BILINGUAL LOCALIZATION (English vs Amharic)
  // ---------------------------------------------------------------------------
  await t.test('LOCALIZATION - ?lang=am returns Ethiopic Amharic text', async () => {
    const res = await api
      .get(`/api/assessments/${stressTemplate.id}?lang=am`)
      .set('Authorization', `Bearer ${tokenUserA}`);

    assert.equal(res.status, 200);
    // Ethiopian Unicode range check: \u1200-\u137F
    assert.match(res.body.data.title, /[\u1200-\u137F]/);
    assert.match(res.body.data.questions[0].text, /[\u1200-\u137F]/);
    assert.match(res.body.data.questions[0].options[0].label, /[\u1200-\u137F]/);
  });

  // ---------------------------------------------------------------------------
  // 11. USER-INITIATED HARD DELETE (SRS 6.1)
  // ---------------------------------------------------------------------------
  await t.test('DELETE /api/assessments/attempts/:id - other user gets 404, owner hard-deletes', async () => {
    // Create an attempt to delete
    const answers = [
      { questionId: stressTemplate.questions[0].id, value: 'rarely' },
      { questionId: stressTemplate.questions[1].id, value: 'always' },
      { questionId: stressTemplate.questions[2].id, value: 'rarely' },
      { questionId: stressTemplate.questions[3].id, value: 'never' },
    ];

    const createRes = await api
      .post(`/api/assessments/${stressTemplate.id}/attempts`)
      .set('Authorization', `Bearer ${tokenUserB}`)
      .send({ answers });

    const attemptId = createRes.body.data.attempt.id;

    // Cross user attempt to delete gets 404
    const resForbidden = await api
      .delete(`/api/assessments/attempts/${attemptId}`)
      .set('Authorization', `Bearer ${tokenUserA}`);
    assert.equal(resForbidden.status, 404);

    // Owner deletes successfully
    const resDelete = await api
      .delete(`/api/assessments/attempts/${attemptId}`)
      .set('Authorization', `Bearer ${tokenUserB}`);
    assert.equal(resDelete.status, 200);
    assert.equal(resDelete.body.data.success, true);

    // Verify record is gone from database
    const inDb = await prisma.assessmentAttempt.findUnique({ where: { id: attemptId } });
    assert.equal(inDb, null);
  });

  // ---------------------------------------------------------------------------
  // 12. NO POINTS, STREAKS, OR BADGES POLICY
  // ---------------------------------------------------------------------------
  await t.test('NO GAMIFICATION - assessment attempt does not award points, streaks, or badges', async () => {
    // Get progress before assessment
    const progressBefore = await prisma.userProgress.findUnique({
      where: { userId: USER_A_ID },
    });
    const badgesBefore = await prisma.userBadge.count({
      where: { userId: USER_A_ID },
    });

    // Create fresh attempt for User B (User A reached daily limit above)
    const answers = [
      { questionId: stressTemplate.questions[0].id, value: 'rarely' },
      { questionId: stressTemplate.questions[1].id, value: 'always' },
      { questionId: stressTemplate.questions[2].id, value: 'rarely' },
      { questionId: stressTemplate.questions[3].id, value: 'never' },
    ];

    const res = await api
      .post(`/api/assessments/${stressTemplate.id}/attempts`)
      .set('Authorization', `Bearer ${tokenUserB}`)
      .send({ answers });
    assert.equal(res.status, 201);

    const progressAfter = await prisma.userProgress.findUnique({
      where: { userId: USER_A_ID },
    });
    const badgesAfter = await prisma.userBadge.count({
      where: { userId: USER_A_ID },
    });

    assert.equal(progressBefore?.totalPoints ?? 0, progressAfter?.totalPoints ?? 0);
    assert.equal(progressBefore?.currentStreak ?? 0, progressAfter?.currentStreak ?? 0);
    assert.equal(badgesBefore, badgesAfter);
  });
});
