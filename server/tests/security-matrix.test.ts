/**
 * Comprehensive Security Matrix Test Suite (Phase B6).
 *
 * Verifies uniform security policy enforcement across ALL 27 Part B routes:
 * 1. Missing Authentication -> HTTP 401 INVALID_TOKEN across every endpoint.
 * 2. Status Enforcement -> HTTP 403 ACCOUNT_RESTRICTED on all write endpoints,
 *    EXCEPT confidential self-assessment submissions and attempt deletions (allowed per safety/privacy).
 * 3. Read Availability -> HTTP 200 on all read endpoints for RESTRICTED accounts.
 * 4. IDOR Defense -> HTTP 404 (never 403) when attempting to access/modify another user's resource.
 * 5. Input Validation -> HTTP 400 on malformed UUID path parameters and unknown body fields (.strict()).
 * 6. Production Hardening -> x-dev-user-id header is ignored when NODE_ENV=production (HTTP 401).
 * 7. Error Sanitization -> Error responses never leak stack traces or Prisma internals.
 * 8. DoS Defense -> Request bodies exceeding 100kb are rejected with HTTP 413 PAYLOAD_TOO_LARGE.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { Server } from 'http';
import { AddressInfo } from 'net';
import jwt from 'jsonwebtoken';
import prisma, { UserRole, AccountStatus, Language, AssessmentDomain } from '@mindrise/database';
import { createApp } from '../src/app.js';
import { config } from '../src/config/index.js';

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

function request(serverUrl: string) {
  return {
    get: (path: string) => new TestRequest('GET', `${serverUrl}${path}`),
    post: (path: string) => new TestRequest('POST', `${serverUrl}${path}`),
    patch: (path: string) => new TestRequest('PATCH', `${serverUrl}${path}`),
    put: (path: string) => new TestRequest('PUT', `${serverUrl}${path}`),
    delete: (path: string) => new TestRequest('DELETE', `${serverUrl}${path}`),
  };
}

// Distinct UUID fixtures to avoid collisions with parallel test files
const USER_A_ID = '00000000-0000-4000-b000-000000000001';
const USER_B_ID = '00000000-0000-4000-b000-000000000002';
const RESTRICTED_USER_ID = '00000000-0000-4000-b000-000000000003';

test('Security Matrix: Authorization, Status Guards, IDOR Defense, and Error Sanitization', async (t) => {
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
    await prisma.report.deleteMany({ where: { reporterId: { in: [USER_A_ID, USER_B_ID, RESTRICTED_USER_ID] } } });
    await prisma.reaction.deleteMany({ where: { userId: { in: [USER_A_ID, USER_B_ID, RESTRICTED_USER_ID] } } });
    await prisma.comment.deleteMany({ where: { authorId: { in: [USER_A_ID, USER_B_ID, RESTRICTED_USER_ID] } } });
    await prisma.post.deleteMany({ where: { authorId: { in: [USER_A_ID, USER_B_ID, RESTRICTED_USER_ID] } } });
    await prisma.assessmentAttempt.deleteMany({ where: { userId: { in: [USER_A_ID, USER_B_ID, RESTRICTED_USER_ID] } } });
    await prisma.routineCompletion.deleteMany({ where: { routine: { userId: { in: [USER_A_ID, USER_B_ID, RESTRICTED_USER_ID] } } } });
    await prisma.routine.deleteMany({ where: { userId: { in: [USER_A_ID, USER_B_ID, RESTRICTED_USER_ID] } } });
  });

  const api = request(serverUrl);

  // Setup test users & profiles
  for (const uid of [USER_A_ID, USER_B_ID]) {
    await prisma.user.upsert({
      where: { id: uid },
      create: {
        id: uid,
        role: UserRole.USER,
        status: AccountStatus.ACTIVE,
        preferredLanguage: Language.EN,
        profile: {
          create: {
            anonymousHandle: `sec_user_${uid.slice(-4)}`,
          },
        },
      },
      update: { status: AccountStatus.ACTIVE },
    });
  }

  await prisma.user.upsert({
    where: { id: RESTRICTED_USER_ID },
    create: {
      id: RESTRICTED_USER_ID,
      role: UserRole.USER,
      status: AccountStatus.RESTRICTED,
      preferredLanguage: Language.EN,
      profile: {
        create: {
          anonymousHandle: 'sec_restricted_user',
        },
      },
    },
    update: { status: AccountStatus.RESTRICTED },
  });

  // Ensure topic and template exist
  const topic = await prisma.topic.upsert({
    where: { slug: 'sec-matrix-topic' },
    create: { slug: 'sec-matrix-topic', nameEn: 'Security Matrix Topic', nameAm: 'የደህንነት ማትሪክስ ርዕስ' },
    update: {},
  });

  const template = await prisma.assessmentTemplate.findFirstOrThrow({
    where: { domain: AssessmentDomain.STRESS, version: 1 },
    include: { questions: true },
  });

  const tokenUserA = jwt.sign({ id: USER_A_ID, role: UserRole.USER, status: AccountStatus.ACTIVE }, config.jwt.secret, { expiresIn: '1h' });
  const tokenUserB = jwt.sign({ id: USER_B_ID, role: UserRole.USER, status: AccountStatus.ACTIVE }, config.jwt.secret, { expiresIn: '1h' });
  const tokenRestricted = jwt.sign({ id: RESTRICTED_USER_ID, role: UserRole.USER, status: AccountStatus.RESTRICTED }, config.jwt.secret, { expiresIn: '1h' });

  // Create User A baseline test resources for IDOR checks
  const routineA = await prisma.routine.create({
    data: { userId: USER_A_ID, title: 'User A Routine' },
  });
  const postA = await prisma.post.create({
    data: { authorId: USER_A_ID, topicId: topic.id, title: 'User A Post', content: 'Baseline post for User A' },
  });
  const commentA = await prisma.comment.create({
    data: { authorId: USER_A_ID, postId: postA.id, content: 'Baseline comment for User A' },
  });
  const attemptA = await prisma.assessmentAttempt.create({
    data: { userId: USER_A_ID, templateId: template.id, answers: 'enc_v1:mock', score: 3, summaryKey: 'LOW' },
  });

  // ---------------------------------------------------------------------------
  // 1. AUTHENTICATION ENFORCEMENT: 401 ON ALL 27 PART B ROUTES
  // ---------------------------------------------------------------------------
  await t.test('AUTH MATRIX - unauthenticated requests receive 401 INVALID_TOKEN across all 27 Part B routes', async () => {
    const unauthChecks = [
      // Routines (8)
      api.get('/api/routines/starter'),
      api.get('/api/routines/today'),
      api.get('/api/routines'),
      api.post('/api/routines').send({ title: 'Routine' }),
      api.get(`/api/routines/${routineA.id}`),
      api.patch(`/api/routines/${routineA.id}`).send({ title: 'Updated' }),
      api.delete(`/api/routines/${routineA.id}`),
      api.post(`/api/routines/${routineA.id}/checkin`),
      // Progress & Badges (2)
      api.get('/api/progress'),
      api.get('/api/badges'),
      // Assessments (6)
      api.get('/api/assessments'),
      api.get(`/api/assessments/${template.id}`),
      api.post(`/api/assessments/${template.id}/attempts`).send({ answers: [] }),
      api.get('/api/assessments/attempts'),
      api.get(`/api/assessments/attempts/${attemptA.id}`),
      api.delete(`/api/assessments/attempts/${attemptA.id}`),
      // Community (10)
      api.get('/api/community/topics'),
      api.get('/api/community/posts'),
      api.post('/api/community/posts').send({ topicId: topic.id, title: 'Title', content: 'Content' }),
      api.get(`/api/community/posts/${postA.id}`),
      api.delete(`/api/community/posts/${postA.id}`),
      api.get(`/api/community/posts/${postA.id}/comments`),
      api.post(`/api/community/posts/${postA.id}/comments`).send({ content: 'Comment' }),
      api.delete(`/api/community/comments/${commentA.id}`),
      api.put(`/api/community/posts/${postA.id}/reactions/support`),
      api.delete(`/api/community/posts/${postA.id}/reactions/support`),
      // Reports (1)
      api.post('/api/reports').send({ targetType: 'POST', targetId: postA.id, reason: 'Reason' }),
    ];

    assert.equal(unauthChecks.length, 27, 'Security matrix must cover exactly 27 Part B routes');

    for (const reqPromise of unauthChecks) {
      const res = await reqPromise;
      assert.equal(res.status, 401);
      assert.equal(res.body.error.code, 'INVALID_TOKEN');
    }
  });

  // ---------------------------------------------------------------------------
  // 2. STATUS ENFORCEMENT & WRITE RESTRICTIONS (403 vs 200/201 EXCEPTIONS)
  // ---------------------------------------------------------------------------
  await t.test('STATUS MATRIX - RESTRICTED users receive 403 on writes, with documented assessment exceptions', async () => {
    // 11 write endpoints requiring requireActive -> 403
    const restrictedWrites = [
      api.post('/api/routines').set('Authorization', `Bearer ${tokenRestricted}`).send({ title: 'Restricted Routine' }),
      api.patch(`/api/routines/${routineA.id}`).set('Authorization', `Bearer ${tokenRestricted}`).send({ title: 'New' }),
      api.delete(`/api/routines/${routineA.id}`).set('Authorization', `Bearer ${tokenRestricted}`),
      api.post(`/api/routines/${routineA.id}/checkin`).set('Authorization', `Bearer ${tokenRestricted}`),
      api.post('/api/community/posts').set('Authorization', `Bearer ${tokenRestricted}`).send({ topicId: topic.id, title: 'Title', content: 'Body' }),
      api.delete(`/api/community/posts/${postA.id}`).set('Authorization', `Bearer ${tokenRestricted}`),
      api.post(`/api/community/posts/${postA.id}/comments`).set('Authorization', `Bearer ${tokenRestricted}`).send({ content: 'Comment' }),
      api.delete(`/api/community/comments/${commentA.id}`).set('Authorization', `Bearer ${tokenRestricted}`),
      api.put(`/api/community/posts/${postA.id}/reactions/support`).set('Authorization', `Bearer ${tokenRestricted}`),
      api.delete(`/api/community/posts/${postA.id}/reactions/support`).set('Authorization', `Bearer ${tokenRestricted}`),
      api.post('/api/reports').set('Authorization', `Bearer ${tokenRestricted}`).send({ targetType: 'POST', targetId: postA.id, reason: 'Reason' }),
    ];

    for (const reqPromise of restrictedWrites) {
      const res = await reqPromise;
      assert.equal(res.status, 403);
      assert.equal(res.body.error.code, 'ACCOUNT_RESTRICTED');
    }

    // Documented Exception 1: POST /api/assessments/:id/attempts allows RESTRICTED users (SRS FR-2.1)
    const validAnswers = template.questions.map((q) => {
      const scoring = q.scoring as Record<string, number>;
      const firstKey = Object.keys(scoring)[0];
      return { questionId: q.id, value: firstKey };
    });
    const resSubmit = await api
      .post(`/api/assessments/${template.id}/attempts`)
      .set('Authorization', `Bearer ${tokenRestricted}`)
      .send({ answers: validAnswers });
    assert.equal(resSubmit.status, 201, 'Restricted users must be permitted to submit self-assessments');
    const restrictedAttemptId = resSubmit.body.data.attempt.id;

    // Documented Exception 2: DELETE /api/assessments/attempts/:id allows RESTRICTED users (GDPR/privacy sovereignty)
    const resDelete = await api
      .delete(`/api/assessments/attempts/${restrictedAttemptId}`)
      .set('Authorization', `Bearer ${tokenRestricted}`);
    assert.equal(resDelete.status, 200, 'Restricted users must be permitted to delete their assessment data');
  });

  // ---------------------------------------------------------------------------
  // 3. READ AVAILABILITY: RESTRICTED USERS CAN READ ALL GET ENDPOINTS
  // ---------------------------------------------------------------------------
  await t.test('STATUS MATRIX - RESTRICTED users can access all 14 read endpoints', async () => {
    const readChecks = [
      api.get('/api/routines/starter').set('Authorization', `Bearer ${tokenRestricted}`),
      api.get('/api/routines/today').set('Authorization', `Bearer ${tokenRestricted}`),
      api.get('/api/routines').set('Authorization', `Bearer ${tokenRestricted}`),
      api.get('/api/progress').set('Authorization', `Bearer ${tokenRestricted}`),
      api.get('/api/badges').set('Authorization', `Bearer ${tokenRestricted}`),
      api.get('/api/assessments').set('Authorization', `Bearer ${tokenRestricted}`),
      api.get(`/api/assessments/${template.id}`).set('Authorization', `Bearer ${tokenRestricted}`),
      api.get('/api/assessments/attempts').set('Authorization', `Bearer ${tokenRestricted}`),
      api.get('/api/community/topics').set('Authorization', `Bearer ${tokenRestricted}`),
      api.get('/api/community/posts').set('Authorization', `Bearer ${tokenRestricted}`),
      api.get(`/api/community/posts/${postA.id}`).set('Authorization', `Bearer ${tokenRestricted}`),
      api.get(`/api/community/posts/${postA.id}/comments`).set('Authorization', `Bearer ${tokenRestricted}`),
    ];

    for (const reqPromise of readChecks) {
      const res = await reqPromise;
      assert.equal(res.status, 200);
      assert.ok(res.body.data !== undefined);
    }
  });

  // ---------------------------------------------------------------------------
  // 4. IDOR DEFENSE: 404 (NEVER 403) ON OWNER-ONLY RESOURCES
  // ---------------------------------------------------------------------------
  await t.test('IDOR MATRIX - accessing or mutating another user resource returns 404 (never 403)', async () => {
    // User B attempts to access or mutate User A's private resources
    const idorChecks = [
      api.get(`/api/routines/${routineA.id}`).set('Authorization', `Bearer ${tokenUserB}`),
      api.patch(`/api/routines/${routineA.id}`).set('Authorization', `Bearer ${tokenUserB}`).send({ title: 'Tamper' }),
      api.delete(`/api/routines/${routineA.id}`).set('Authorization', `Bearer ${tokenUserB}`),
      api.post(`/api/routines/${routineA.id}/checkin`).set('Authorization', `Bearer ${tokenUserB}`),
      api.get(`/api/assessments/attempts/${attemptA.id}`).set('Authorization', `Bearer ${tokenUserB}`),
      api.delete(`/api/assessments/attempts/${attemptA.id}`).set('Authorization', `Bearer ${tokenUserB}`),
      api.delete(`/api/community/posts/${postA.id}`).set('Authorization', `Bearer ${tokenUserB}`),
      api.delete(`/api/community/comments/${commentA.id}`).set('Authorization', `Bearer ${tokenUserB}`),
    ];

    for (const reqPromise of idorChecks) {
      const res = await reqPromise;
      assert.equal(res.status, 404, 'Must return 404 to prevent resource existence enumeration');
    }
  });

  // ---------------------------------------------------------------------------
  // 5. INPUT VALIDATION: 400 ON MALFORMED UUID AND UNKNOWN FIELDS
  // ---------------------------------------------------------------------------
  await t.test('VALIDATION MATRIX - rejects malformed UUIDs and unknown body fields with 400', async () => {
    // Malformed UUID checks
    const badUuidChecks = [
      api.get('/api/routines/not-a-uuid').set('Authorization', `Bearer ${tokenUserA}`),
      api.patch('/api/routines/bad-uuid').set('Authorization', `Bearer ${tokenUserA}`).send({ title: 'New' }),
      api.delete('/api/routines/bad-uuid').set('Authorization', `Bearer ${tokenUserA}`),
      api.get('/api/assessments/bad-uuid').set('Authorization', `Bearer ${tokenUserA}`),
      api.post('/api/assessments/bad-uuid/attempts').set('Authorization', `Bearer ${tokenUserA}`).send({ answers: [] }),
      api.get('/api/community/posts/bad-uuid').set('Authorization', `Bearer ${tokenUserA}`),
      api.delete('/api/community/posts/bad-uuid').set('Authorization', `Bearer ${tokenUserA}`),
      api.get('/api/community/posts/bad-uuid/comments').set('Authorization', `Bearer ${tokenUserA}`),
      api.delete('/api/community/comments/bad-uuid').set('Authorization', `Bearer ${tokenUserA}`),
      api.put('/api/community/posts/bad-uuid/reactions/support').set('Authorization', `Bearer ${tokenUserA}`),
    ];

    for (const reqPromise of badUuidChecks) {
      const res = await reqPromise;
      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    }

    // Unknown body field rejection (.strict())
    const unknownFieldChecks = [
      api.post('/api/routines').set('Authorization', `Bearer ${tokenUserA}`).send({ title: 'Valid Title', injectedField: true }),
      api.patch(`/api/routines/${routineA.id}`).set('Authorization', `Bearer ${tokenUserA}`).send({ title: 'Valid Title', hackerField: 123 }),
      api.post(`/api/assessments/${template.id}/attempts`).set('Authorization', `Bearer ${tokenUserA}`).send({ answers: [], malicious: 'drop tables' }),
      api.post('/api/community/posts').set('Authorization', `Bearer ${tokenUserA}`).send({ topicId: topic.id, title: 'Valid', content: 'Valid', extra: 'bad' }),
      api.post(`/api/community/posts/${postA.id}/comments`).set('Authorization', `Bearer ${tokenUserA}`).send({ content: 'Valid', forbidden: true }),
      api.post('/api/reports').set('Authorization', `Bearer ${tokenUserA}`).send({ targetType: 'POST', targetId: postA.id, reason: 'Reason', extraKey: 42 }),
    ];

    for (const reqPromise of unknownFieldChecks) {
      const res = await reqPromise;
      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    }
  });

  // ---------------------------------------------------------------------------
  // 6. PRODUCTION HARDENING: x-dev-user-id IGNORED IN PRODUCTION (401)
  // ---------------------------------------------------------------------------
  await t.test('PRODUCTION HARDENING - x-dev-user-id header is ignored when NODE_ENV=production', async () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';

      const res = await api
        .get('/api/progress')
        .set('x-dev-user-id', USER_A_ID);

      assert.equal(res.status, 401, 'Dev stub must be completely inactive in production environment');
      assert.equal(res.body.error.code, 'INVALID_TOKEN');
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  // ---------------------------------------------------------------------------
  // 7. ERROR SANITIZATION & STACK TRACE SUPPRESSION
  // ---------------------------------------------------------------------------
  await t.test('ERROR SANITIZATION - responses never leak stack traces or raw database messages', async () => {
    // 1. Zod error
    const resZod = await api.post('/api/routines').set('Authorization', `Bearer ${tokenUserA}`).send({});
    assert.equal(resZod.body.error.stack, undefined);
    assert.equal(JSON.stringify(resZod.body).includes('prisma'), false);

    // 2. Controlled AppError
    const resApp = await api.get('/api/routines/00000000-0000-4000-b000-000000000099').set('Authorization', `Bearer ${tokenUserA}`);
    assert.equal(resApp.status, 404);
    assert.equal(resApp.body.error.stack, undefined);
  });

  // ---------------------------------------------------------------------------
  // 8. DoS DEFENSE: 100KB BODY LIMIT REJECTION (413 PAYLOAD_TOO_LARGE)
  // ---------------------------------------------------------------------------
  await t.test('DoS DEFENSE - rejects bodies exceeding 100kb with 413 PAYLOAD_TOO_LARGE', async () => {
    // Construct a payload larger than 100kb (105kb of repeated characters)
    const largeContent = 'A'.repeat(105 * 1024);

    const res = await api
      .post('/api/community/posts')
      .set('Authorization', `Bearer ${tokenUserA}`)
      .send({
        topicId: topic.id,
        title: 'Oversized post payload',
        content: largeContent,
      });

    assert.equal(res.status, 413);
    assert.equal(res.body.error.code, 'PAYLOAD_TOO_LARGE');
  });
});
