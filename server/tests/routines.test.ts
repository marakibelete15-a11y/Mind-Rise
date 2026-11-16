import test from 'node:test';
import assert from 'node:assert/strict';
import { Server } from 'http';
import { AddressInfo } from 'net';
import jwt from 'jsonwebtoken';
import prisma, { UserRole, AccountStatus, Language } from '@mindrise/database';
import { createApp } from '../src/app.js';
import { config } from '../src/config/index.js';

/**
 * Integration Test Suite for Part B Phase B1: Routines Module
 *
 * WHY:
 * 1. Integration tests verify end-to-end HTTP behavior: middleware execution,
 *    Zod validation, database persistence, response envelopes, and error handling.
 * 2. We test strict privacy rules: verifying that users cannot discover or modify
 *    routines belonging to another user (IDOR prevention returning 404, not 403).
 * 3. We verify safety policies: accounts in RESTRICTED or SUSPENDED state are blocked
 *    from writes but retain read access.
 */

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
const SUSPENDED_USER_ID = '00000000-0000-4000-a000-0000000000d4';

test('Routines Module Integration Tests', async (t) => {
  const app = createApp();
  let server: Server;
  let serverUrl = '';

  // Spin up HTTP server on an OS-assigned ephemeral port (0)
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address() as AddressInfo;
      serverUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });

  t.after(async () => {
    server.close();
    // Clean up created test data
    await prisma.routine.deleteMany({
      where: { userId: { in: [USER_A_ID, USER_B_ID, RESTRICTED_USER_ID, SUSPENDED_USER_ID] } },
    });
  });

  // Ensure test users exist in database
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
  await prisma.user.upsert({
    where: { id: SUSPENDED_USER_ID },
    update: { status: AccountStatus.SUSPENDED, role: UserRole.USER },
    create: { id: SUSPENDED_USER_ID, status: AccountStatus.SUSPENDED, role: UserRole.USER },
  });

  // Clean slate for routines
  await prisma.routine.deleteMany({
    where: { userId: { in: [USER_A_ID, USER_B_ID, RESTRICTED_USER_ID, SUSPENDED_USER_ID] } },
  });

  // Generate valid authentication tokens
  const tokenUserA = jwt.sign({ id: USER_A_ID }, config.jwt.secret);
  const tokenUserB = jwt.sign({ id: USER_B_ID }, config.jwt.secret);
  const tokenRestricted = jwt.sign({ id: RESTRICTED_USER_ID }, config.jwt.secret);
  const tokenSuspended = jwt.sign({ id: SUSPENDED_USER_ID }, config.jwt.secret);

  const api = request(app, serverUrl);

  // ---------------------------------------------------------------------------
  // 1. STARTER ROUTINES & LOCALIZATION
  // ---------------------------------------------------------------------------
  await t.test('GET /api/routines/starter - requires authentication', async () => {
    const res = await api.get('/api/routines/starter');
    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, 'INVALID_TOKEN');
  });

  await t.test('GET /api/routines/starter - returns localized starter routines in English and Amharic', async () => {
    // English query
    const resEn = await api
      .get('/api/routines/starter?lang=en')
      .set('Authorization', `Bearer ${tokenUserA}`);
    assert.equal(resEn.status, 200);
    assert.ok(Array.isArray(resEn.body.data));
    assert.ok(resEn.body.data.length > 0);
    assert.ok(resEn.body.data[0].title);
    assert.equal(typeof resEn.body.data[0].title, 'string');
    // Verify raw En/Am columns are not leaked
    assert.equal(resEn.body.data[0].titleEn, undefined);
    assert.equal(resEn.body.data[0].titleAm, undefined);

    // Amharic query
    const resAm = await api
      .get('/api/routines/starter?lang=am')
      .set('Authorization', `Bearer ${tokenUserA}`);
    assert.equal(resAm.status, 200);
    assert.ok(Array.isArray(resAm.body.data));
    assert.ok(resAm.body.data[0].title);
    // Should be different from English
    assert.notEqual(resAm.body.data[0].title, resEn.body.data[0].title);
  });

  // ---------------------------------------------------------------------------
  // 2. CREATE ROUTINE (POST /api/routines) & VALIDATION
  // ---------------------------------------------------------------------------
  let routineOneId = '';

  await t.test('POST /api/routines - creates a routine (happy path)', async () => {
    const res = await api
      .post('/api/routines')
      .set('Authorization', `Bearer ${tokenUserA}`)
      .send({
        title: '  Morning Mindful Walk  ',
        description: 'Walk for 15 minutes without phone distractions.',
      });

    assert.equal(res.status, 201);
    assert.ok(res.body.data);
    assert.equal(res.body.data.title, 'Morning Mindful Walk'); // Trimmed
    assert.equal(res.body.data.status, 'ACTIVE');
    assert.equal(res.body.data.userId, USER_A_ID);
    assert.equal(res.body.data.deletedAt, null);
    routineOneId = res.body.data.id;
    assert.ok(routineOneId);
  });

  await t.test('POST /api/routines - rejects empty or symbol-only titles', async () => {
    // Empty title
    const resEmpty = await api
      .post('/api/routines')
      .set('Authorization', `Bearer ${tokenUserA}`)
      .send({ title: '    ' });
    assert.equal(resEmpty.status, 400);
    assert.equal(resEmpty.body.error.code, 'VALIDATION_ERROR');

    // Symbol-only title
    const resSymbols = await api
      .post('/api/routines')
      .set('Authorization', `Bearer ${tokenUserA}`)
      .send({ title: '!@#$%^&*()_+' });
    assert.equal(resSymbols.status, 400);
    assert.equal(resSymbols.body.error.code, 'VALIDATION_ERROR');

    // Title exceeding 100 characters
    const resTooLong = await api
      .post('/api/routines')
      .set('Authorization', `Bearer ${tokenUserA}`)
      .send({ title: 'a'.repeat(101) });
    assert.equal(resTooLong.status, 400);
    assert.equal(resTooLong.body.error.code, 'VALIDATION_ERROR');
  });

  await t.test('POST /api/routines - accepts Amharic Unicode title', async () => {
    const res = await api
      .post('/api/routines')
      .set('Authorization', `Bearer ${tokenUserA}`)
      .send({ title: 'የጠዋት ፀሎት እና ማሰላሰል' });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.title, 'የጠዋት ፀሎት እና ማሰላሰል');
  });

  await t.test('POST /api/routines - rejects unknown body fields (.strict())', async () => {
    const res = await api
      .post('/api/routines')
      .set('Authorization', `Bearer ${tokenUserA}`)
      .send({
        title: 'Valid Routine Title',
        unknownField: 'malicious or unexpected',
      });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  });

  // ---------------------------------------------------------------------------
  // 3. READ ROUTINES & CURSOR PAGINATION
  // ---------------------------------------------------------------------------
  await t.test('GET /api/routines - lists caller routines with cursor pagination', async () => {
    const res = await api
      .get('/api/routines?limit=1')
      .set('Authorization', `Bearer ${tokenUserA}`);

    assert.equal(res.status, 200);
    assert.ok(res.body.data);
    assert.equal(res.body.data.items.length, 1);
    assert.ok(res.body.data.nextCursor);

    // Fetch next page with cursor
    const nextRes = await api
      .get(`/api/routines?cursor=${res.body.data.nextCursor}&limit=1`)
      .set('Authorization', `Bearer ${tokenUserA}`);

    assert.equal(nextRes.status, 200);
    assert.equal(nextRes.body.data.items.length, 1);
    // Should be a different item
    assert.notEqual(nextRes.body.data.items[0].id, res.body.data.items[0].id);
  });

  await t.test('GET /api/routines/:id - returns own routine', async () => {
    const res = await api
      .get(`/api/routines/${routineOneId}`)
      .set('Authorization', `Bearer ${tokenUserA}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.data.id, routineOneId);
  });

  await t.test('GET /api/routines/:id - validates UUID format', async () => {
    const res = await api
      .get('/api/routines/not-a-valid-uuid')
      .set('Authorization', `Bearer ${tokenUserA}`);

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  });

  // ---------------------------------------------------------------------------
  // 4. OWNERSHIP & IDOR PROTECTION (404 NOT 403)
  // ---------------------------------------------------------------------------
  await t.test('OWNERSHIP - User B cannot view User A routine (returns 404, not 403)', async () => {
    const res = await api
      .get(`/api/routines/${routineOneId}`)
      .set('Authorization', `Bearer ${tokenUserB}`);

    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, 'ROUTINE_NOT_FOUND');
  });

  await t.test('OWNERSHIP - User B cannot patch User A routine (returns 404, not 403)', async () => {
    const res = await api
      .patch(`/api/routines/${routineOneId}`)
      .set('Authorization', `Bearer ${tokenUserB}`)
      .send({ status: 'PAUSED' });

    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, 'ROUTINE_NOT_FOUND');
  });

  await t.test('OWNERSHIP - User B cannot delete User A routine (returns 404, not 403)', async () => {
    const res = await api
      .delete(`/api/routines/${routineOneId}`)
      .set('Authorization', `Bearer ${tokenUserB}`);

    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, 'ROUTINE_NOT_FOUND');
  });

  // ---------------------------------------------------------------------------
  // 5. UPDATE ROUTINE (PATCH /api/routines/:id)
  // ---------------------------------------------------------------------------
  await t.test('PATCH /api/routines/:id - updates title and status', async () => {
    const res = await api
      .patch(`/api/routines/${routineOneId}`)
      .set('Authorization', `Bearer ${tokenUserA}`)
      .send({
        title: 'Updated Routine Title',
        status: 'PAUSED',
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.title, 'Updated Routine Title');
    assert.equal(res.body.data.status, 'PAUSED');
  });

  await t.test('PATCH /api/routines/:id - rejects empty payload', async () => {
    const res = await api
      .patch(`/api/routines/${routineOneId}`)
      .set('Authorization', `Bearer ${tokenUserA}`)
      .send({});

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  });

  // ---------------------------------------------------------------------------
  // 6. SOFT DELETE (DELETE /api/routines/:id)
  // ---------------------------------------------------------------------------
  await t.test('DELETE /api/routines/:id - soft deletes routine and hides it from views', async () => {
    const res = await api
      .delete(`/api/routines/${routineOneId}`)
      .set('Authorization', `Bearer ${tokenUserA}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.data.message, 'Routine deleted successfully');

    // Direct DB check: deletedAt must be populated (not hard-deleted)
    const inDb = await prisma.routine.findUnique({ where: { id: routineOneId } });
    assert.ok(inDb);
    assert.notEqual(inDb.deletedAt, null);

    // GET /api/routines/:id now returns 404
    const getRes = await api
      .get(`/api/routines/${routineOneId}`)
      .set('Authorization', `Bearer ${tokenUserA}`);
    assert.equal(getRes.status, 404);

    // Routine is no longer in GET /api/routines listing
    const listRes = await api
      .get('/api/routines')
      .set('Authorization', `Bearer ${tokenUserA}`);
    const found = listRes.body.data.items.find((item: any) => item.id === routineOneId);
    assert.equal(found, undefined);
  });

  // ---------------------------------------------------------------------------
  // 7. 20-ROUTINE ACTIVE QUOTA ENFORCEMENT
  // ---------------------------------------------------------------------------
  await t.test('QUOTA - enforces max 20 active routines per user', async () => {
    // Clean up User A routines first
    await prisma.routine.deleteMany({ where: { userId: USER_A_ID } });

    // Create 20 active routines
    for (let i = 1; i <= 20; i++) {
      const res = await api
        .post('/api/routines')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({ title: `Quota Routine Number ${i}` });
      assert.equal(res.status, 201, `Failed to create routine ${i}`);
    }

    // 21st routine creation must fail with ROUTINE_LIMIT_REACHED
    const quotaRes = await api
      .post('/api/routines')
      .set('Authorization', `Bearer ${tokenUserA}`)
      .send({ title: 'Twenty-First Routine Attempt' });

    assert.equal(quotaRes.status, 400);
    assert.equal(quotaRes.body.error.code, 'ROUTINE_LIMIT_REACHED');
  });

  // ---------------------------------------------------------------------------
  // 8. ACCOUNT STATUS RESTRICTION (RESTRICTED & SUSPENDED)
  // ---------------------------------------------------------------------------
  await t.test('STATUS - RESTRICTED user blocked from POST, PATCH, DELETE but can GET', async () => {
    // Reads are allowed
    const getRes = await api
      .get('/api/routines')
      .set('Authorization', `Bearer ${tokenRestricted}`);
    assert.equal(getRes.status, 200);

    // Writes are blocked with 403 ACCOUNT_RESTRICTED
    const postRes = await api
      .post('/api/routines')
      .set('Authorization', `Bearer ${tokenRestricted}`)
      .send({ title: 'Blocked Routine' });
    assert.equal(postRes.status, 403);
    assert.equal(postRes.body.error.code, 'ACCOUNT_RESTRICTED');

    const patchRes = await api
      .patch(`/api/routines/${routineOneId}`)
      .set('Authorization', `Bearer ${tokenRestricted}`)
      .send({ title: 'Blocked Routine' });
    assert.equal(patchRes.status, 403);
    assert.equal(patchRes.body.error.code, 'ACCOUNT_RESTRICTED');

    const deleteRes = await api
      .delete(`/api/routines/${routineOneId}`)
      .set('Authorization', `Bearer ${tokenRestricted}`);
    assert.equal(deleteRes.status, 403);
    assert.equal(deleteRes.body.error.code, 'ACCOUNT_RESTRICTED');
  });

  await t.test('STATUS - SUSPENDED user blocked from writes', async () => {
    const postRes = await api
      .post('/api/routines')
      .set('Authorization', `Bearer ${tokenSuspended}`)
      .send({ title: 'Blocked Routine' });
    assert.equal(postRes.status, 403);
    assert.equal(postRes.body.error.code, 'ACCOUNT_RESTRICTED');
  });
});
