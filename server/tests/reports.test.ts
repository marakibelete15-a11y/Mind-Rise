import test from 'node:test';
import assert from 'node:assert/strict';
import { Server } from 'http';
import { AddressInfo } from 'net';
import jwt from 'jsonwebtoken';
import prisma, { UserRole, AccountStatus, Language } from '@mindrise/database';
import { createApp } from '../src/app.js';
import { config } from '../src/config/index.js';
import { reportHook } from '../src/services/report.service.js';

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

function request(serverUrl: string) {
  return {
    get: (path: string) => new TestRequest('GET', `${serverUrl}${path}`),
    post: (path: string) => new TestRequest('POST', `${serverUrl}${path}`),
  };
}

// Test User UUIDs (isolated to prevent collision with parallel community tests)
const USER_A_ID = '00000000-0000-4000-a000-0000000000d1';
const USER_B_ID = '00000000-0000-4000-a000-0000000000e2';
const RESTRICTED_USER_ID = '00000000-0000-4000-a000-0000000000f3';

test('User Moderation Reports Integration & Security Tests (SRS FR-4.4)', async (t) => {
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
    // Clean up created reports, comments, and posts
    await prisma.report.deleteMany({
      where: { reporterId: { in: [USER_A_ID, USER_B_ID, RESTRICTED_USER_ID] } },
    });
    await prisma.comment.deleteMany({
      where: { authorId: { in: [USER_A_ID, USER_B_ID, RESTRICTED_USER_ID] } },
    });
    await prisma.post.deleteMany({
      where: { authorId: { in: [USER_A_ID, USER_B_ID, RESTRICTED_USER_ID] } },
    });
  });

  const api = request(serverUrl);

  // Setup test users in database
  await prisma.user.upsert({
    where: { id: USER_A_ID },
    create: {
      id: USER_A_ID,
      role: UserRole.USER,
      status: AccountStatus.ACTIVE,
      preferredLanguage: Language.EN,
    },
    update: { status: AccountStatus.ACTIVE },
  });

  await prisma.user.upsert({
    where: { id: USER_B_ID },
    create: {
      id: USER_B_ID,
      role: UserRole.USER,
      status: AccountStatus.ACTIVE,
      preferredLanguage: Language.EN,
    },
    update: { status: AccountStatus.ACTIVE },
  });

  await prisma.user.upsert({
    where: { id: RESTRICTED_USER_ID },
    create: {
      id: RESTRICTED_USER_ID,
      role: UserRole.USER,
      status: AccountStatus.RESTRICTED,
      preferredLanguage: Language.EN,
    },
    update: { status: AccountStatus.RESTRICTED },
  });

  // Ensure topic exists
  const topic = await prisma.topic.upsert({
    where: { slug: 'test-topic-reports' },
    create: {
      slug: 'test-topic-reports',
      nameEn: 'Test Topic for Reports',
      nameAm: 'የሪፖርት መፈተሻ ርዕስ',
    },
    update: {},
  });

  const tokenUserA = jwt.sign(
    { id: USER_A_ID, role: UserRole.USER, status: AccountStatus.ACTIVE },
    config.jwt.secret,
    { expiresIn: '1h' }
  );

  const tokenUserB = jwt.sign(
    { id: USER_B_ID, role: UserRole.USER, status: AccountStatus.ACTIVE },
    config.jwt.secret,
    { expiresIn: '1h' }
  );

  const tokenRestricted = jwt.sign(
    { id: RESTRICTED_USER_ID, role: UserRole.USER, status: AccountStatus.RESTRICTED },
    config.jwt.secret,
    { expiresIn: '1h' }
  );

  // ---------------------------------------------------------------------------
  // 1. HAPPY PATH & DATA ENVELOPE PRIVACY
  // ---------------------------------------------------------------------------
  let testPostId = '';
  let testCommentId = '';

  await t.test('SETUP - create target post and comment by User A', async () => {
    const post = await prisma.post.create({
      data: {
        authorId: USER_A_ID,
        topicId: topic.id,
        title: 'Report Target Post',
        content: 'This post is used as a test target for moderation reporting.',
      },
    });
    testPostId = post.id;

    const comment = await prisma.comment.create({
      data: {
        postId: post.id,
        authorId: USER_A_ID,
        content: 'This comment is used as a test target for reporting.',
      },
    });
    testCommentId = comment.id;
  });

  await t.test('HAPPY PATH - User B reports User A post, returns received true without leaking IDs', async (testCtx) => {
    let hookCalled = false;
    testCtx.mock.method(reportHook, 'onReportCreated', async () => {
      hookCalled = true;
    });

    const res = await api
      .post('/api/reports')
      .set('Authorization', `Bearer ${tokenUserB}`)
      .send({
        targetType: 'POST',
        targetId: testPostId,
        reason: 'Harassment or inappropriate language.',
      });

    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { data: { received: true } });
    assert.equal(hookCalled, true, 'onReportCreated must be called for new report');

    // Verify row persisted in PostgreSQL
    const saved = await prisma.report.findFirst({
      where: {
        reporterId: USER_B_ID,
        targetType: 'POST',
        targetId: testPostId,
      },
    });
    assert.ok(saved);
    assert.equal(saved.status, 'PENDING');
    assert.equal(saved.reason, 'Harassment or inappropriate language.');

    // Privacy assertion: verify response payload contains ZERO IDs or leaked data
    const resString = JSON.stringify(res.body);
    assert.equal(resString.includes(USER_B_ID), false, 'Must not leak reporterId');
    assert.equal(resString.includes(USER_A_ID), false, 'Must not leak authorId');
    assert.equal(resString.includes(saved.id), false, 'Must not leak reportId');
  });

  // ---------------------------------------------------------------------------
  // 2. SELF-REPORTING REJECTION (400 CANNOT_REPORT_OWN_CONTENT)
  // ---------------------------------------------------------------------------
  await t.test('SELF-REPORTING - User A cannot report their own post or comment', async () => {
    // Report own post
    const resPost = await api
      .post('/api/reports')
      .set('Authorization', `Bearer ${tokenUserA}`)
      .send({
        targetType: 'POST',
        targetId: testPostId,
        reason: 'Reporting myself.',
      });

    assert.equal(resPost.status, 400);
    assert.equal(resPost.body.error.code, 'CANNOT_REPORT_OWN_CONTENT');

    // Report own comment
    const resComment = await api
      .post('/api/reports')
      .set('Authorization', `Bearer ${tokenUserA}`)
      .send({
        targetType: 'COMMENT',
        targetId: testCommentId,
        reason: 'Reporting my comment.',
      });

    assert.equal(resComment.status, 400);
    assert.equal(resComment.body.error.code, 'CANNOT_REPORT_OWN_CONTENT');
  });

  // ---------------------------------------------------------------------------
  // 3. IDEMPOTENCY (Sequential and Concurrent Promise.all)
  // ---------------------------------------------------------------------------
  await t.test('IDEMPOTENCY - sequential duplicate report returns 200 without creating new row or calling hook', async (testCtx) => {
    let hookCallCount = 0;
    testCtx.mock.method(reportHook, 'onReportCreated', async () => {
      hookCallCount++;
    });

    const res = await api
      .post('/api/reports')
      .set('Authorization', `Bearer ${tokenUserB}`)
      .send({
        targetType: 'POST',
        targetId: testPostId,
        reason: 'Submitting duplicate report.',
      });

    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { data: { received: true } });
    assert.equal(hookCallCount, 0, 'onReportCreated hook must not be called for duplicate reports');

    // Total rows for this (reporterId, targetId) must remain exactly 1
    const count = await prisma.report.count({
      where: {
        reporterId: USER_B_ID,
        targetType: 'POST',
        targetId: testPostId,
      },
    });
    assert.equal(count, 1);
  });

  await t.test('IDEMPOTENCY - concurrent Promise.all duplicate reports result in exactly 1 row', async () => {
    // Target comment has not been reported yet by User B
    const [res1, res2] = await Promise.all([
      api
        .post('/api/reports')
        .set('Authorization', `Bearer ${tokenUserB}`)
        .send({
          targetType: 'COMMENT',
          targetId: testCommentId,
          reason: 'Concurrent report attempt 1',
        }),
      api
        .post('/api/reports')
        .set('Authorization', `Bearer ${tokenUserB}`)
        .send({
          targetType: 'COMMENT',
          targetId: testCommentId,
          reason: 'Concurrent report attempt 2',
        }),
    ]);

    assert.equal(res1.status, 200);
    assert.equal(res2.status, 200);
    assert.deepEqual(res1.body, { data: { received: true } });
    assert.deepEqual(res2.body, { data: { received: true } });

    // Database must contain exactly 1 report row for this comment from User B
    const count = await prisma.report.count({
      where: {
        reporterId: USER_B_ID,
        targetType: 'COMMENT',
        targetId: testCommentId,
      },
    });
    assert.equal(count, 1);
  });

  // ---------------------------------------------------------------------------
  // 4. TARGET VALIDATION (Non-existent, Soft-deleted, ACCOUNT rejection)
  // ---------------------------------------------------------------------------
  await t.test('TARGET VALIDATION - reporting non-existent or soft-deleted content returns 404', async () => {
    // Non-existent target
    const resUnknown = await api
      .post('/api/reports')
      .set('Authorization', `Bearer ${tokenUserB}`)
      .send({
        targetType: 'POST',
        targetId: '00000000-0000-4000-e000-000000000099',
        reason: 'Report on phantom post',
      });
    assert.equal(resUnknown.status, 404);
    assert.equal(resUnknown.body.error.code, 'TARGET_NOT_FOUND');

    // Create and soft-delete a post
    const postToDelete = await prisma.post.create({
      data: {
        authorId: USER_A_ID,
        topicId: topic.id,
        title: 'Post to delete',
        content: 'Content about to be soft-deleted.',
        deletedAt: new Date(),
      },
    });

    const resDeleted = await api
      .post('/api/reports')
      .set('Authorization', `Bearer ${tokenUserB}`)
      .send({
        targetType: 'POST',
        targetId: postToDelete.id,
        reason: 'Trying to report soft-deleted post',
      });
    assert.equal(resDeleted.status, 404);
    assert.equal(resDeleted.body.error.code, 'TARGET_NOT_FOUND');
  });

  await t.test('TARGET VALIDATION - rejects ACCOUNT targetType and unknown payload fields', async () => {
    // ACCOUNT targetType is not permitted in community API
    const resAccount = await api
      .post('/api/reports')
      .set('Authorization', `Bearer ${tokenUserB}`)
      .send({
        targetType: 'ACCOUNT',
        targetId: USER_A_ID,
        reason: 'Trying to report user account directly.',
      });
    assert.equal(resAccount.status, 400);

    // Unknown field rejection (.strict())
    const resUnknownField = await api
      .post('/api/reports')
      .set('Authorization', `Bearer ${tokenUserB}`)
      .send({
        targetType: 'POST',
        targetId: testPostId,
        reason: 'Valid reason',
        maliciousField: true,
      });
    assert.equal(resUnknownField.status, 400);
  });

  // ---------------------------------------------------------------------------
  // 5. STATUS ENFORCEMENT & RATE LIMITING
  // ---------------------------------------------------------------------------
  await t.test('STATUS ENFORCEMENT - RESTRICTED user gets 403 ACCOUNT_RESTRICTED', async () => {
    const res = await api
      .post('/api/reports')
      .set('Authorization', `Bearer ${tokenRestricted}`)
      .send({
        targetType: 'POST',
        targetId: testPostId,
        reason: 'Restricted attempt.',
      });
    assert.equal(res.status, 403);
    assert.equal(res.body.error.code, 'ACCOUNT_RESTRICTED');
  });

  await t.test('RATE LIMITING - enforces 20 reports per hour with 429 REPORT_RATE_LIMIT', async () => {
    // Clean existing reports for User B
    await prisma.report.deleteMany({ where: { reporterId: USER_B_ID } });

    // Create 20 unique posts to report
    const targetPosts = [];
    for (let i = 1; i <= 21; i++) {
      const p = await prisma.post.create({
        data: {
          authorId: USER_A_ID,
          topicId: topic.id,
          title: `Report Test Post ${i}`,
          content: `Content for report rate limit post ${i}`,
        },
      });
      targetPosts.push(p);
    }

    // Submit 20 reports successfully
    for (let i = 0; i < 20; i++) {
      const res = await api
        .post('/api/reports')
        .set('Authorization', `Bearer ${tokenUserB}`)
        .send({
          targetType: 'POST',
          targetId: targetPosts[i].id,
          reason: `Report rate limit number ${i + 1}`,
        });
      assert.equal(res.status, 200);
    }

    // 21st report must be rejected with 429
    const res21 = await api
      .post('/api/reports')
      .set('Authorization', `Bearer ${tokenUserB}`)
      .send({
        targetType: 'POST',
        targetId: targetPosts[20].id,
        reason: 'Report exceeding rate limit',
      });

    assert.equal(res21.status, 429);
    assert.equal(res21.body.error.code, 'REPORT_RATE_LIMIT');
  });

  // ---------------------------------------------------------------------------
  // 6. ENDPOINT RESTRICTION
  // ---------------------------------------------------------------------------
  await t.test('ENDPOINT RESTRICTION - normal users cannot read reports via GET /api/reports', async () => {
    const res = await api
      .get('/api/reports')
      .set('Authorization', `Bearer ${tokenUserB}`);

    // No GET endpoint exists; must return 404 Not Found
    assert.equal(res.status, 404);
  });
});
