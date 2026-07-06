import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/cloud/tracker.mjs';

function mockReq(method = 'GET', body = null) {
  return {
    method,
    async *[Symbol.asyncIterator]() {
      if (body) yield Buffer.from(JSON.stringify(body));
    }
  };
}

function mockRes() {
  const res = { headers: {}, statusCode: 200, payload: null };
  res.setHeader = (key, value) => { res.headers[key] = value; };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (payload) => { res.payload = payload; return res; };
  return res;
}

test('cloud tracker gracefully falls back when KV is not configured', async () => {
  const oldUrl = process.env.KV_REST_API_URL;
  const oldToken = process.env.KV_REST_API_TOKEN;
  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;
  const res = mockRes();
  await handler(mockReq('GET'), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.ok, true);
  assert.equal(res.payload.cloudEnabled, false);
  assert.deepEqual(res.payload.records, []);
  if (oldUrl) process.env.KV_REST_API_URL = oldUrl;
  if (oldToken) process.env.KV_REST_API_TOKEN = oldToken;
});
