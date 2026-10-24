const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

process.env.NODE_ENV = 'test';
process.env.PORT = '0';
process.env.MONGODB_URI = '';
process.env.SAFEMAP_ADMIN_PASSWORD = 'TestAdminSecretPassword_2026!Secure';
process.env.SAFEMAP_SECRET = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

const app = require('../server.js');

let server;
let baseUrl;

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const reqHeaders = { ...headers };
    let payload = null;

    if (body && typeof body === 'object') {
      payload = JSON.stringify(body);
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = http.request(url, { method, headers: reqHeaders }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (e) {}
        resolve({ status: res.statusCode, headers: res.headers, body: json, text: data });
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

describe('WatchDog BD — District Crime Feed & Like Reactions', () => {
  before((_, done) => {
    server = app.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      done();
    });
  });

  after((_, done) => {
    if (server) server.close(done);
    else done();
  });

  test('GET /api/feed returns public feed with sorting and filters', async () => {
    const res = await request('GET', '/api/feed');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.incidents));
    assert.ok(typeof res.body.total === 'number');

    // Test with district filter
    const resDist = await request('GET', '/api/feed?district=BD3026');
    assert.equal(resDist.status, 200);
    assert.equal(resDist.body.success, true);
    assert.ok(resDist.body.incidents.length > 0);
    for (const item of resDist.body.incidents) {
      assert.equal(item.district_code, 'BD3026');
    }
  });

  test('POST /api/feed/:id/like increments reaction count', async () => {
    const feedRes = await request('GET', '/api/feed');
    assert.equal(feedRes.status, 200);
    if (feedRes.body.incidents.length > 0) {
      const target = feedRes.body.incidents[0];
      const initialLikes = target.likes || 0;

      const likeRes = await request('POST', `/api/feed/${target.id}/like`, {});
      assert.equal(likeRes.status, 200);
      assert.equal(likeRes.body.success, true);
      assert.equal(likeRes.body.likes, initialLikes + 1);
    }
  });

  test('GET /api/feed prevents leaking submitter PII', async () => {
    const res = await request('GET', '/api/feed');
    assert.equal(res.status, 200);
    for (const item of res.body.incidents) {
      assert.equal(item.reporter_name, undefined);
      assert.equal(item.reporter_contact, undefined);
      assert.equal(item.email, undefined);
      assert.equal(item.phone, undefined);
      assert.equal(item.submitter_ip, undefined);
    }
  });
});
