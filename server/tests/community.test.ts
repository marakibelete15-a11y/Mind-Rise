import test from 'node:test';
import assert from 'node:assert/strict';
import { Server } from 'http';
import { AddressInfo } from 'net';
import jwt from 'jsonwebtoken';
import prisma, {
  UserRole,
  AccountStatus,
  Language,
  CrisisPriority,
  CrisisSource,
} from '@mindrise/database';
import { createApp } from '../src/app.js';
import { config } from '../src/config/index.js';
import { crisisNotifier } from '../src/services/community.service.js';

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
    put: (path: string) => new TestRequest('PUT', `${serverUrl}${path}`),
    patch: (path: string) => new TestRequest('PATCH', `${serverUrl}${path}`),
    delete: (path: string) => new TestRequest('DELETE', `${serverUrl}${path}`),
  };
}

// Test User UUIDs
const USER_A_ID = '00000000-0000-4000-a000-0000000000a1';
const USER_B_ID = '00000000-0000-4000-a000-0000000000b2';
const RESTRICTED_USER_ID = '00000000-0000-4000-a000-0000000000c3';

// Disallowed private identity keys that must NEVER leak in API responses
const FORBIDDEN_IDENTITY_KEYS = new Set([
  'authorid',
  'userid',
  'email',
  'phone',
  'firstname',
  'lastname',
  'bio',
  'phoneencrypted',
  'emailencrypted',
  'phonehash',
  'emailhash',
  'verifiedidentity',
]);

/**
 * Recursively asserts that no forbidden identity keys exist anywhere in an object or array.
 */
function assertNoIdentityLeak(obj: unknown, path = 'root') {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return;
  }

  if (Array.isArray(obj)) {
    obj.forEach((item, index) => assertNoIdentityLeak(item, `${path}[${index}]`));
    return;
  }

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    assert.equal(
      FORBIDDEN_IDENTITY_KEYS.has(lowerKey),
      false,
      `Forbidden privacy leak: Key "${key}" found at ${path}.${key}`
    );
    assertNoIdentityLeak(value, `${path}.${key}`);
  }
}

/**
 * Recursively asserts that no safety disclosure terms ('flag', 'flagged', 'priority')
 * appear anywhere in keys or string values of a response payload.
 */
function assertNoCrisisLeak(obj: unknown, path = 'root') {
  if (obj === null || obj === undefined) return;
  if (typeof obj === 'string') {
    const lower = obj.toLowerCase();
    assert.equal(lower.includes('flagged'), false, `Found "flagged" at ${path}: "${obj}"`);
    assert.equal(lower.includes('flag'), false, `Found "flag" at ${path}: "${obj}"`);
    assert.equal(lower.includes('priority'), false, `Found "priority" at ${path}: "${obj}"`);
    return;
  }
  if (Array.isArray(obj)) {
    obj.forEach((item, index) => assertNoCrisisLeak(item, `${path}[${index}]`));
    return;
  }
  if (typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      assert.equal(lowerKey.includes('flagged'), false, `Found key "flagged" at ${path}.${key}`);
      assert.equal(lowerKey.includes('flag'), false, `Found key "flag" at ${path}.${key}`);
      assert.equal(lowerKey.includes('priority'), false, `Found key "priority" at ${path}.${key}`);
      assertNoCrisisLeak(value, `${path}.${key}`);
    }
  }
}

test('Anonymous Community Module Integration & Privacy Tests (SRS FR-4.1 to FR-4.5)', async (t) => {
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
    // Clean up created test community data
    await prisma.reaction.deleteMany({
      where: { userId: { in: [USER_A_ID, USER_B_ID, RESTRICTED_USER_ID] } },
    });
    await prisma.comment.deleteMany({
      where: { authorId: { in: [USER_A_ID, USER_B_ID, RESTRICTED_USER_ID] } },
    });
    await prisma.post.deleteMany({
      where: { authorId: { in: [USER_A_ID, USER_B_ID, RESTRICTED_USER_ID] } },
    });
  });

  // Ensure test users and their anonymous profiles exist
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
  await prisma.profile.upsert({
    where: { userId: USER_A_ID },
    update: { anonymousHandle: 'HabeshaPioneer', avatarUrl: 'https://example.com/avatarA.png' },
    create: {
      userId: USER_A_ID,
      anonymousHandle: 'HabeshaPioneer',
      avatarUrl: 'https://example.com/avatarA.png',
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
  await prisma.profile.upsert({
    where: { userId: USER_B_ID },
    update: { anonymousHandle: 'AddisSeeker', avatarUrl: 'https://example.com/avatarB.png' },
    create: {
      userId: USER_B_ID,
      anonymousHandle: 'AddisSeeker',
      avatarUrl: 'https://example.com/avatarB.png',
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
  await prisma.profile.upsert({
    where: { userId: RESTRICTED_USER_ID },
    update: { anonymousHandle: 'RestrictedPeer', avatarUrl: null },
    create: {
      userId: RESTRICTED_USER_ID,
      anonymousHandle: 'RestrictedPeer',
      avatarUrl: null,
    },
  });

  // Clean test user data before running tests
  await prisma.reaction.deleteMany({
    where: { userId: { in: [USER_A_ID, USER_B_ID, RESTRICTED_USER_ID] } },
  });
  await prisma.comment.deleteMany({
    where: { authorId: { in: [USER_A_ID, USER_B_ID, RESTRICTED_USER_ID] } },
  });
  await prisma.post.deleteMany({
    where: { authorId: { in: [USER_A_ID, USER_B_ID, RESTRICTED_USER_ID] } },
  });

  const tokenUserA = jwt.sign({ id: USER_A_ID }, config.jwt.secret);
  const tokenUserB = jwt.sign({ id: USER_B_ID }, config.jwt.secret);
  const tokenRestricted = jwt.sign({ id: RESTRICTED_USER_ID }, config.jwt.secret);

  const api = request(app, serverUrl);

  // Fetch seeded topic for testing
  const topicJobSearch = await prisma.topic.findFirstOrThrow({
    where: { slug: 'job-search-unemployment' },
  });
  const topicAcademic = await prisma.topic.findFirstOrThrow({
    where: { slug: 'academic-pressure' },
  });

  // ---------------------------------------------------------------------------
  // 1. TOPIC SPACES & BILINGUAL LOCALIZATION
  // ---------------------------------------------------------------------------
  await t.test('GET /api/community/topics - returns localized topics in English and Amharic', async () => {
    // English query
    const resEn = await api
      .get('/api/community/topics?lang=en')
      .set('Authorization', `Bearer ${tokenUserA}`);

    assert.equal(resEn.status, 200);
    assert.ok(Array.isArray(resEn.body.data));
    assert.ok(resEn.body.data.length >= 3);
    const topicEn = resEn.body.data.find((t: any) => t.slug === 'job-search-unemployment');
    assert.equal(topicEn.name, 'Job Search & Unemployment');
    assert.equal(typeof topicEn.postCount, 'number');

    // Amharic query
    const resAm = await api
      .get('/api/community/topics?lang=am')
      .set('Authorization', `Bearer ${tokenUserA}`);

    assert.equal(resAm.status, 200);
    const topicAm = resAm.body.data.find((t: any) => t.slug === 'job-search-unemployment');
    assert.match(topicAm.name, /[\u1200-\u137F]/); // Ethiopic script
  });

  // ---------------------------------------------------------------------------
  // 2. CREATE POST & ANONYMOUS AUTHOR MAPPER
  // ---------------------------------------------------------------------------
  let postOneId = '';

  await t.test('POST /api/community/posts - creates post with handle/avatar only (no authorId/userId)', async () => {
    const res = await api
      .post('/api/community/posts')
      .set('Authorization', `Bearer ${tokenUserA}`)
      .send({
        topicId: topicJobSearch.id,
        title: 'Navigating post-graduate job search stress',
        content: 'It has been 3 months since graduation and feeling overwhelmed by job applications.',
      });

    assert.equal(res.status, 201);
    const post = res.body.data;
    assert.ok(post.id);
    postOneId = post.id;
    assert.equal(post.title, 'Navigating post-graduate job search stress');
    assert.equal(post.topicId, topicJobSearch.id);
    assert.equal(post.isMine, true);
    assert.equal(post.reactedByMe, false);
    assert.equal(post.supportCount, 0);
    assert.equal(post.commentCount, 0);

    // CRITICAL: Author must be anonymous handle and avatar ONLY
    assert.deepEqual(post.author, {
      handle: 'HabeshaPioneer',
      avatarUrl: 'https://example.com/avatarA.png',
    });

    // Zero identity leak check
    assertNoIdentityLeak(res.body);
  });

  // ---------------------------------------------------------------------------
  // 3. VALIDATION ERRORS (Empty, symbol-only, length bounds, unknown fields)
  // ---------------------------------------------------------------------------
  await t.test('POST /api/community/posts - rejects empty or symbol-only title/content with 400', async () => {
    // Empty title
    const resEmptyTitle = await api
      .post('/api/community/posts')
      .set('Authorization', `Bearer ${tokenUserA}`)
      .send({
        topicId: topicJobSearch.id,
        title: '   ',
        content: 'Valid content here',
      });
    assert.equal(resEmptyTitle.status, 400);

    // Symbol-only title
    const resSymbolTitle = await api
      .post('/api/community/posts')
      .set('Authorization', `Bearer ${tokenUserA}`)
      .send({
        topicId: topicJobSearch.id,
        title: '!!!???###$$$',
        content: 'Valid content here',
      });
    assert.equal(resSymbolTitle.status, 400);

    // Symbol-only content
    const resSymbolContent = await api
      .post('/api/community/posts')
      .set('Authorization', `Bearer ${tokenUserA}`)
      .send({
        topicId: topicJobSearch.id,
        title: 'Valid Title',
        content: '---***===',
      });
    assert.equal(resSymbolContent.status, 400);
  });

  await t.test('POST /api/community/posts - rejects title > 150 chars or content > 5000 chars', async () => {
    const resLongTitle = await api
      .post('/api/community/posts')
      .set('Authorization', `Bearer ${tokenUserA}`)
      .send({
        topicId: topicJobSearch.id,
        title: 'a'.repeat(151),
        content: 'Valid content',
      });
    assert.equal(resLongTitle.status, 400);

    const resLongContent = await api
      .post('/api/community/posts')
      .set('Authorization', `Bearer ${tokenUserA}`)
      .send({
        topicId: topicJobSearch.id,
        title: 'Valid Title',
        content: 'a'.repeat(5001),
      });
    assert.equal(resLongContent.status, 400);
  });

  await t.test('POST /api/community/posts - rejects unknown topicId with 404', async () => {
    const res = await api
      .post('/api/community/posts')
      .set('Authorization', `Bearer ${tokenUserA}`)
      .send({
        topicId: '00000000-0000-4000-a000-999999999999',
        title: 'Valid Title',
        content: 'Valid Content',
      });
    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, 'TOPIC_NOT_FOUND');
  });

  await t.test('POST /api/community/posts - rejects unknown body fields (.strict()) with 400', async () => {
    const res = await api
      .post('/api/community/posts')
      .set('Authorization', `Bearer ${tokenUserA}`)
      .send({
        topicId: topicJobSearch.id,
        title: 'Valid Title',
        content: 'Valid Content',
        unexpectedField: 'malicious',
      });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  });

  // ---------------------------------------------------------------------------
  // 4. DELETED AUTHOR TOMBSTONE ([Deleted User])
  // ---------------------------------------------------------------------------
  await t.test('TOMBSTONE - deleted user or null author renders as [Deleted User]', async () => {
    // Create a post with User B, then simulate account deletion by nulling authorId in DB
    const resCreate = await api
      .post('/api/community/posts')
      .set('Authorization', `Bearer ${tokenUserB}`)
      .send({
        topicId: topicAcademic.id,
        title: 'Post before author account deleted',
        content: 'This thread context will remain preserved even if I delete my account.',
      });
    assert.equal(resCreate.status, 201);
    const postDeletedAuthorId = resCreate.body.data.id;

    // Simulate account deletion (onDelete: SetNull)
    await prisma.post.update({
      where: { id: postDeletedAuthorId },
      data: { authorId: null },
    });

    const resGet = await api
      .get(`/api/community/posts/${postDeletedAuthorId}`)
      .set('Authorization', `Bearer ${tokenUserA}`);

    assert.equal(resGet.status, 200);
    assert.deepEqual(resGet.body.data.author, {
      handle: '[Deleted User]',
      avatarUrl: null,
    });
    assert.equal(resGet.body.data.isMine, false);

    assertNoIdentityLeak(resGet.body);
  });

  // ---------------------------------------------------------------------------
  // 5. FEED ORDERING, CURSOR PAGINATION & TOPIC FILTER
  // ---------------------------------------------------------------------------
  await t.test('GET /api/community/posts - feed ordering, cursor pagination, and topic filtering', async () => {
    // Create 3 posts in topicAcademic for User A
    const postIds: string[] = [];
    for (let i = 1; i <= 3; i++) {
      const res = await api
        .post('/api/community/posts')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({
          topicId: topicAcademic.id,
          title: `Academic Pressure Post ${i}`,
          content: `Content detailing academic situation number ${i}.`,
        });
      assert.equal(res.status, 201);
      postIds.push(res.body.data.id);
    }

    // Filter by topicAcademic with limit=2
    const resPage1 = await api
      .get(`/api/community/posts?topicId=${topicAcademic.id}&limit=2`)
      .set('Authorization', `Bearer ${tokenUserA}`);

    assert.equal(resPage1.status, 200);
    assert.equal(resPage1.body.data.items.length, 2);
    assert.ok(resPage1.body.data.nextCursor);

    // Fetch next page with cursor
    const resPage2 = await api
      .get(
        `/api/community/posts?topicId=${topicAcademic.id}&cursor=${resPage1.body.data.nextCursor}&limit=2`
      )
      .set('Authorization', `Bearer ${tokenUserA}`);

    assert.equal(resPage2.status, 200);
    // Page 2 must not have overlapping IDs with Page 1
    const page1Ids = new Set(resPage1.body.data.items.map((p: any) => p.id));
    for (const item of resPage2.body.data.items) {
      assert.equal(page1Ids.has(item.id), false, 'Pagination must have no duplicate items');
    }

    // Comprehensive privacy check over feed responses
    assertNoIdentityLeak(resPage1.body);
    assertNoIdentityLeak(resPage2.body);
  });

  // ---------------------------------------------------------------------------
  // 6. COMMENTS (Create, List, Soft Delete)
  // ---------------------------------------------------------------------------
  let commentOneId = '';

  await t.test('POST & GET /api/community/posts/:id/comments - creates and lists comments oldest first', async () => {
    const resCreate = await api
      .post(`/api/community/posts/${postOneId}/comments`)
      .set('Authorization', `Bearer ${tokenUserB}`)
      .send({ content: 'Hang in there! The first few months are the hardest.' });

    assert.equal(resCreate.status, 201);
    const comment = resCreate.body.data;
    assert.ok(comment.id);
    commentOneId = comment.id;
    assert.equal(comment.content, 'Hang in there! The first few months are the hardest.');
    assert.equal(comment.isMine, true);
    assert.deepEqual(comment.author, {
      handle: 'AddisSeeker',
      avatarUrl: 'https://example.com/avatarB.png',
    });

    // List comments
    const resList = await api
      .get(`/api/community/posts/${postOneId}/comments`)
      .set('Authorization', `Bearer ${tokenUserA}`);

    assert.equal(resList.status, 200);
    assert.ok(resList.body.data.items.length >= 1);
    const found = resList.body.data.items.find((c: any) => c.id === commentOneId);
    assert.ok(found);
    assert.equal(found.isMine, false); // From User A perspective, comment was by User B

    assertNoIdentityLeak(resCreate.body);
    assertNoIdentityLeak(resList.body);
  });

  await t.test('DELETE /api/community/comments/:id - author soft deletes comment (preserves row in DB)', async () => {
    // Non-author receives 404
    const resOther = await api
      .delete(`/api/community/comments/${commentOneId}`)
      .set('Authorization', `Bearer ${tokenUserA}`);
    assert.equal(resOther.status, 404);

    // Author deletes
    const resDelete = await api
      .delete(`/api/community/comments/${commentOneId}`)
      .set('Authorization', `Bearer ${tokenUserB}`);
    assert.equal(resDelete.status, 200);

    // Assert row STILL EXISTS in database with deletedAt set (Soft delete requirement)
    const rawComment = await prisma.comment.findUnique({
      where: { id: commentOneId },
    });
    assert.ok(rawComment);
    assert.notEqual(rawComment.deletedAt, null);

    // Assert comment is now excluded from list
    const resListAfter = await api
      .get(`/api/community/posts/${postOneId}/comments`)
      .set('Authorization', `Bearer ${tokenUserA}`);
    const foundAfter = resListAfter.body.data.items.find((c: any) => c.id === commentOneId);
    assert.equal(foundAfter, undefined);
  });

  // ---------------------------------------------------------------------------
  // 7. SUPPORT REACTIONS (Idempotent Add/Remove & Concurrent Race Test)
  // ---------------------------------------------------------------------------
  await t.test('PUT & DELETE /api/community/posts/:id/reactions/support - idempotent support reactions', async () => {
    // Add support reaction
    const resAdd = await api
      .put(`/api/community/posts/${postOneId}/reactions/support`)
      .set('Authorization', `Bearer ${tokenUserB}`);
    assert.equal(resAdd.status, 200);
    assert.equal(resAdd.body.data.reactedByMe, true);
    assert.equal(resAdd.body.data.supportCount, 1);

    // Idempotent add: second identical request does not error and returns same count
    const resAddDuplicate = await api
      .put(`/api/community/posts/${postOneId}/reactions/support`)
      .set('Authorization', `Bearer ${tokenUserB}`);
    assert.equal(resAddDuplicate.status, 200);
    assert.equal(resAddDuplicate.body.data.reactedByMe, true);
    assert.equal(resAddDuplicate.body.data.supportCount, 1);

    // Remove support reaction
    const resRemove = await api
      .delete(`/api/community/posts/${postOneId}/reactions/support`)
      .set('Authorization', `Bearer ${tokenUserB}`);
    assert.equal(resRemove.status, 200);
    assert.equal(resRemove.body.data.reactedByMe, false);
    assert.equal(resRemove.body.data.supportCount, 0);

    assertNoIdentityLeak(resAdd.body);
  });

  await t.test('CONCURRENCY - simultaneous double-add reaction ends with exactly one reaction', async () => {
    // Clean any prior reactions on postOneId
    await prisma.reaction.deleteMany({ where: { postId: postOneId } });

    // Send two simultaneous requests for User B
    const [res1, res2] = await Promise.all([
      api
        .put(`/api/community/posts/${postOneId}/reactions/support`)
        .set('Authorization', `Bearer ${tokenUserB}`),
      api
        .put(`/api/community/posts/${postOneId}/reactions/support`)
        .set('Authorization', `Bearer ${tokenUserB}`),
    ]);

    assert.equal(res1.status, 200);
    assert.equal(res2.status, 200);

    // Assert database has exactly 1 reaction row
    const reactionsCount = await prisma.reaction.count({
      where: { postId: postOneId, userId: USER_B_ID },
    });
    assert.equal(reactionsCount, 1);
  });

  // ---------------------------------------------------------------------------
  // 8. AUTHOR SOFT DELETION & MODERATION REMOVAL BEHAVIOR
  // ---------------------------------------------------------------------------
  await t.test('SOFT DELETE POST - author soft deletes post; row remains in DB but hidden from all reads', async () => {
    // Non-author receives 404
    const resOther = await api
      .delete(`/api/community/posts/${postOneId}`)
      .set('Authorization', `Bearer ${tokenUserB}`);
    assert.equal(resOther.status, 404);

    // Author soft-deletes
    const resDelete = await api
      .delete(`/api/community/posts/${postOneId}`)
      .set('Authorization', `Bearer ${tokenUserA}`);
    assert.equal(resDelete.status, 200);
    assert.equal(resDelete.body.data.success, true);

    // 1. Assert row STILL EXISTS in database with deletedAt set (Evidence preservation)
    const rawPost = await prisma.post.findUnique({
      where: { id: postOneId },
    });
    assert.ok(rawPost);
    assert.notEqual(rawPost.deletedAt, null);

    // 2. Hidden from single-post fetch (404)
    const resSingle = await api
      .get(`/api/community/posts/${postOneId}`)
      .set('Authorization', `Bearer ${tokenUserA}`);
    assert.equal(resSingle.status, 404);

    // 3. Hidden from feed
    const resFeed = await api
      .get('/api/community/posts')
      .set('Authorization', `Bearer ${tokenUserA}`);
    const inFeed = resFeed.body.data.items.find((p: any) => p.id === postOneId);
    assert.equal(inFeed, undefined);

    // 4. Comments on it are not retrievable (404)
    const resComments = await api
      .get(`/api/community/posts/${postOneId}/comments`)
      .set('Authorization', `Bearer ${tokenUserA}`);
    assert.equal(resComments.status, 404);

    // 5. Reactions on it return 404
    const resReact = await api
      .put(`/api/community/posts/${postOneId}/reactions/support`)
      .set('Authorization', `Bearer ${tokenUserA}`);
    assert.equal(resReact.status, 404);
  });

  // ---------------------------------------------------------------------------
  // 9. RESTRICTED USER ENFORCEMENT (Read allowed, writes blocked with 403)
  // ---------------------------------------------------------------------------
  await t.test('STATUS ENFORCEMENT - RESTRICTED user can read topics/posts but gets 403 on writes', async () => {
    // Read topics (allowed)
    const resTopics = await api
      .get('/api/community/topics')
      .set('Authorization', `Bearer ${tokenRestricted}`);
    assert.equal(resTopics.status, 200);

    // Read feed (allowed)
    const resFeed = await api
      .get('/api/community/posts')
      .set('Authorization', `Bearer ${tokenRestricted}`);
    assert.equal(resFeed.status, 200);

    // Write post blocked with 403
    const resPost = await api
      .post('/api/community/posts')
      .set('Authorization', `Bearer ${tokenRestricted}`)
      .send({
        topicId: topicJobSearch.id,
        title: 'Restricted Post Attempt',
        content: 'This write must be forbidden.',
      });
    assert.equal(resPost.status, 403);
    assert.equal(resPost.body.error.code, 'ACCOUNT_RESTRICTED');
  });

  // ---------------------------------------------------------------------------
  // 10. RATE LIMITING (10 posts/hour, 30 comments/hour)
  // ---------------------------------------------------------------------------
  await t.test('RATE LIMITING - enforces 10 posts per hour limit with 429 POST_RATE_LIMIT', async () => {
    // Clean User B's posts
    await prisma.post.deleteMany({ where: { authorId: USER_B_ID } });

    // Submit 10 posts
    for (let i = 1; i <= 10; i++) {
      const res = await api
        .post('/api/community/posts')
        .set('Authorization', `Bearer ${tokenUserB}`)
        .send({
          topicId: topicJobSearch.id,
          title: `Rapid Post ${i}`,
          content: `Content for rapid post ${i}`,
        });
      assert.equal(res.status, 201);
    }

    // 11th post must trigger rate limit
    const resEleventh = await api
      .post('/api/community/posts')
      .set('Authorization', `Bearer ${tokenUserB}`)
      .send({
        topicId: topicJobSearch.id,
        title: 'Rapid Post 11',
        content: 'This post exceeds the 10 posts/hour limit.',
      });

    assert.equal(resEleventh.status, 429);
    assert.equal(resEleventh.body.error.code, 'POST_RATE_LIMIT');
  });

  await t.test('RATE LIMITING - soft-deleted posts still count toward 10 posts/hour limit (anti-evasion)', async () => {
    // User B currently has 10 posts. Soft-delete one of them.
    const userBPosts = await prisma.post.findMany({
      where: { authorId: USER_B_ID },
      take: 1,
    });
    assert.equal(userBPosts.length, 1);

    const deleteRes = await api
      .delete(`/api/community/posts/${userBPosts[0].id}`)
      .set('Authorization', `Bearer ${tokenUserB}`);
    assert.equal(deleteRes.status, 200);

    // Attempting to create an 11th post must STILL be rejected with 429
    const resAfterDelete = await api
      .post('/api/community/posts')
      .set('Authorization', `Bearer ${tokenUserB}`)
      .send({
        topicId: topicJobSearch.id,
        title: 'Post After Delete Attempt',
        content: 'Attempting to evade rate limit via delete-and-repost.',
      });

    assert.equal(resAfterDelete.status, 429);
    assert.equal(resAfterDelete.body.error.code, 'POST_RATE_LIMIT');
  });

  // ---------------------------------------------------------------------------
  // 11. RISK-LANGUAGE SCANNING (SRS FR-4.6)
  // ---------------------------------------------------------------------------
  await t.test('RISK SCANNING - CRITICAL post triggers raiseFlag, returns resources, and never leaks flag terms', async (testCtx) => {
    // Reset User A posts to ensure clean rate limit
    await prisma.post.deleteMany({ where: { authorId: USER_A_ID } });

    let flagCallInput: any = null;
    testCtx.mock.method(crisisNotifier, 'raiseFlag', async (input: any) => {
      flagCallInput = input;
    });

    const res = await api
      .post('/api/community/posts')
      .set('Authorization', `Bearer ${tokenUserA}`)
      .send({
        topicId: topicJobSearch.id,
        title: 'Having a really hard time',
        content: 'I want to kill myself tonight.',
      });

    assert.equal(res.status, 201);
    assert.ok(flagCallInput, 'crisisNotifier.raiseFlag must be invoked');
    assert.equal(flagCallInput.userId, USER_A_ID);
    assert.equal(flagCallInput.source, CrisisSource.POST);
    assert.equal(flagCallInput.sourceId, res.body.data.id);
    assert.equal(flagCallInput.priority, CrisisPriority.CRITICAL);

    // User response has crisis resources
    assert.equal(res.body.data.crisis.show, true);
    assert.ok(Array.isArray(res.body.data.crisis.resources));
    assert.ok(res.body.data.crisis.resources.length > 0);

    // Content is NOT hidden or modified
    assert.equal(res.body.data.content, 'I want to kill myself tonight.');
    const dbPost = await prisma.post.findUnique({ where: { id: res.body.data.id } });
    assert.ok(dbPost);
    assert.equal(dbPost.deletedAt, null);

    // Recursive safety assertion: NEVER expose 'flag', 'flagged', or 'priority'
    assertNoCrisisLeak(res.body);
  });

  await t.test('RISK SCANNING - HIGH comment triggers raiseFlag and returns crisis resources', async (testCtx) => {
    // Create base post
    const postRes = await api
      .post('/api/community/posts')
      .set('Authorization', `Bearer ${tokenUserA}`)
      .send({
        topicId: topicJobSearch.id,
        title: 'A benign discussion thread',
        content: 'Sharing thoughts on career transitions.',
      });
    assert.equal(postRes.status, 201);

    let flagCallInput: any = null;
    testCtx.mock.method(crisisNotifier, 'raiseFlag', async (input: any) => {
      flagCallInput = input;
    });

    const commentRes = await api
      .post(`/api/community/posts/${postRes.body.data.id}/comments`)
      .set('Authorization', `Bearer ${tokenUserB}`)
      .send({
        content: "I don't want to wake up anymore.",
      });

    assert.equal(commentRes.status, 201);
    assert.ok(flagCallInput, 'crisisNotifier.raiseFlag must be called for HIGH comment');
    assert.equal(flagCallInput.userId, USER_B_ID);
    assert.equal(flagCallInput.source, CrisisSource.POST);
    assert.equal(flagCallInput.sourceId, commentRes.body.data.id);
    assert.equal(flagCallInput.priority, CrisisPriority.HIGH);

    assert.equal(commentRes.body.data.crisis.show, true);
    assert.ok(commentRes.body.data.crisis.resources.length > 0);
    assertNoCrisisLeak(commentRes.body);
  });

  await t.test('RISK SCANNING - harmless post does not trigger raiseFlag and returns crisis.show false', async (testCtx) => {
    let flagCalled = false;
    testCtx.mock.method(crisisNotifier, 'raiseFlag', async () => {
      flagCalled = true;
    });

    const res = await api
      .post('/api/community/posts')
      .set('Authorization', `Bearer ${tokenUserA}`)
      .send({
        topicId: topicJobSearch.id,
        title: 'Excited about learning TypeScript',
        content: 'Practicing writing pure functions and unit tests!',
      });

    assert.equal(res.status, 201);
    assert.equal(flagCalled, false);
    assert.equal(res.body.data.crisis.show, false);
    assert.deepEqual(res.body.data.crisis.resources, []);
    assertNoCrisisLeak(res.body);
  });

  await t.test('RISK SCANNING - raiseFlag throwing error never blocks creation (HTTP 201)', async (testCtx) => {
    testCtx.mock.method(crisisNotifier, 'raiseFlag', async () => {
      throw new Error('Simulated network failure calling crisis notification');
    });

    const res = await api
      .post('/api/community/posts')
      .set('Authorization', `Bearer ${tokenUserA}`)
      .send({
        topicId: topicJobSearch.id,
        title: 'Another difficult day',
        content: 'I will end my life.',
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.data.crisis.show, true);
    assert.ok(res.body.data.crisis.resources.length > 0);
    assert.ok(res.body.data.id);
    assertNoCrisisLeak(res.body);
  });
});
