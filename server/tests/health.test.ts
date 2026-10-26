import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { Server } from 'http';

test('Health Check Endpoint GET /health', async (t) => {
  const app = createApp();
  let server: Server;
  const testPort = 5099;

  await new Promise<void>((resolve) => {
    server = app.listen(testPort, () => resolve());
  });

  t.after(() => {
    server.close();
  });

  const response = await fetch(`http://localhost:${testPort}/health`);
  const body = (await response.json()) as { status: string; service: string };

  assert.equal(response.status, 200);
  assert.equal(body.status, 'ok');
  assert.equal(body.service, 'mindrise-server');
});
