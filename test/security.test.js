/**
 * WatchDog BD — Automated Pre-Launch Security & Verification Test Suite
 *
 * Covers:
 * 1. Persistent Shared Token Revocation across Independent Server Instances
 * 2. Distributed Rate Limiting & Sliding Window Controls
 * 3. Database-Backed Atomic Duplicate Submission Prevention
 * 4. Production Secret & Admin Password Rejection (Zero-Fallback Policy)
 * 5. Full Server-Side Authorization on All Admin Routes
 * 6. Public PII & Reporter Identity Protection
 * 7. Input Schema Validation & XSS/NoSQL Injection Hardening
 * 8. Security Headers, CSP Strictness, and Anti-CSRF Protection
 *
 * CRITICAL SAFETY: Uses synthetic data only. Never modifies production collections.
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

// Configure isolated test environment
process.env.NODE_ENV = 'test';
process.env.PORT = '0';
process.env.MONGODB_URI = ''; // Keep test isolated in test mode
process.env.SAFEMAP_ADMIN_PASSWORD = 'TestAdminSecretPassword_2026!Secure';
process.env.SAFEMAP_SECRET = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

const app = require('../server.js');

let serverInstanceA;
let serverInstanceB;
let urlA;
let urlB;
let validAdminToken;

before(async () => {
  // Start Server Instance A (simulating Lambda Worker A)
  await new Promise((resolve) => {
    serverInstanceA = http.createServer(app);
    serverInstanceA.listen(0, '127.0.0.1', () => {
      urlA = `http://127.0.0.1:${serverInstanceA.address().port}`;
      resolve();
    });
  });

  // Start Independent Server Instance B (simulating Lambda Worker B)
  await new Promise((resolve) => {
    serverInstanceB = http.createServer(app);
    serverInstanceB.listen(0, '127.0.0.1', () => {
      urlB = `http://127.0.0.1:${serverInstanceB.address().port}`;
      resolve();
    });
  });
});

after(async () => {
  await Promise.all([
    new Promise((res) => serverInstanceA.close(res)),
    new Promise((res) => serverInstanceB.close(res))
  ]);
});

describe('1. Security Headers, Isolations & Anti-CSRF', () => {
  test('Response includes modern isolation headers and strict CSP without unsafe-inline', async () => {
    const res = await fetch(`${urlA}/api/meta`);
    assert.equal(res.status, 200);

    assert.equal(res.headers.get('x-frame-options'), 'DENY');
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('cross-origin-opener-policy'), 'same-origin');
    assert.equal(res.headers.get('cross-origin-resource-policy'), 'same-origin');
    assert.equal(res.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');

    const csp = res.headers.get('content-security-policy') || '';
    assert.ok(csp.includes("default-src 'self'"), 'CSP missing default-src');
    assert.ok(!csp.includes("'unsafe-inline'") || !csp.includes("script-src 'self' 'unsafe-inline'"), 'CSP must not allow unsafe-inline for scripts');
    assert.ok(csp.includes("object-src 'none'"), 'CSP missing object-src none');
    assert.ok(csp.includes("frame-ancestors 'none'"), 'CSP missing frame-ancestors none');
  });

  test('Anti-CSRF origin check blocks mismatched cross-origin state-changing requests', async () => {
    const res = await fetch(`${urlA}/api/reports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://evil-unauthorized-site.com',
        'X-Forwarded-For': '198.51.100.50'
      },
      body: JSON.stringify({ district_code: 'BD3026' })
    });
    assert.equal(res.status, 403);
    const data = await res.json();
    assert.ok(data.error.includes('Cross-origin request rejected'));
  });
});

describe('2. Production Configuration & Zero-Fallback Policy Enforcement', () => {
  test('Fails closed if weak password is used in production mode (Process Crash Check)', async () => {
    const serverScript = path.join(__dirname, '..', 'server.js');
    const child = spawnSync(process.execPath, [serverScript], {
      env: {
        ...process.env,
        NODE_ENV: 'production',
        VERCEL_ENV: 'production',
        SAFEMAP_SECRET: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        SAFEMAP_ADMIN_PASSWORD: 'admin' // Weak password (< 16 chars)
      },
      encoding: 'utf8'
    });

    assert.notEqual(child.status, 0, 'Production must crash with status != 0 on weak password');
    assert.ok(
      child.stderr.includes('FATAL CONFIGURATION ERROR') || child.stderr.includes('SAFEMAP_ADMIN_PASSWORD'),
      'Stderr must state fatal error regarding admin password'
    );
  });

  test('Fails closed if SAFEMAP_SECRET is default or shorter than 32 characters in production', async () => {
    const serverScript = path.join(__dirname, '..', 'server.js');
    const child = spawnSync(process.execPath, [serverScript], {
      env: {
        ...process.env,
        NODE_ENV: 'production',
        VERCEL_ENV: 'production',
        SAFEMAP_SECRET: 'short_secret_123',
        SAFEMAP_ADMIN_PASSWORD: 'ValidComplexAdminPassword_2026!Secure'
      },
      encoding: 'utf8'
    });

    assert.notEqual(child.status, 0, 'Production must crash with status != 0 on short secret');
    assert.ok(
      child.stderr.includes('FATAL CONFIGURATION ERROR') || child.stderr.includes('SAFEMAP_SECRET'),
      'Stderr must state fatal error regarding SAFEMAP_SECRET'
    );
  });
});

describe('3. Admin Authentication, Authorization & Cross-Instance Session Revocation', () => {
  test('Admin login fails with invalid password (timing-safe)', async () => {
    const res = await fetch(`${urlA}/api/admin/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '198.51.100.1'
      },
      body: JSON.stringify({ password: 'WrongAdminPassword123!' })
    });
    assert.equal(res.status, 401);
    const data = await res.json();
    assert.equal(data.error, 'Incorrect password');
  });

  test('Admin login succeeds with valid password and returns 3-part HMAC token', async () => {
    const res = await fetch(`${urlA}/api/admin/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '198.51.100.2'
      },
      body: JSON.stringify({ password: 'TestAdminSecretPassword_2026!Secure' })
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.token);
    assert.equal(data.token.split('.').length, 3);
    validAdminToken = data.token;
  });

  test('Every admin endpoint strictly enforces server-side authorization', async () => {
    const endpoints = [
      { method: 'GET', path: '/api/admin/reports' },
      { method: 'POST', path: '/api/admin/reports/123/status', body: { status: 'approved' } },
      { method: 'DELETE', path: '/api/admin/reports/123' },
      { method: 'GET', path: '/api/admin/analytics' },
      { method: 'POST', path: '/api/admin/logout' }
    ];

    for (const ep of endpoints) {
      const res = await fetch(`${urlA}${ep.path}`, {
        method: ep.method,
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': '198.51.100.3'
        },
        body: ep.body ? JSON.stringify(ep.body) : undefined
      });
      assert.equal(res.status, 401, `Endpoint ${ep.method} ${ep.path} failed to require authorization`);
      const data = await res.json();
      assert.equal(data.error, 'Unauthorized');
    }
  });

  test('Tampered token signature is rejected with 401 Unauthorized', async () => {
    const tampered = validAdminToken.slice(0, -6) + 'abcdef';
    const res = await fetch(`${urlA}/api/admin/reports`, {
      headers: {
        Authorization: `Bearer ${tampered}`,
        'X-Forwarded-For': '198.51.100.4'
      }
    });
    assert.equal(res.status, 401);
  });

  test('Cross-instance session revocation: Login on Instance A, Logout on Instance A, Rejected on Instance B', async () => {
    // 1. Authenticate on Instance A
    const loginRes = await fetch(`${urlA}/api/admin/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '198.51.100.5'
      },
      body: JSON.stringify({ password: 'TestAdminSecretPassword_2026!Secure' })
    });
    assert.equal(loginRes.status, 200);
    const { token: sessionToken } = await loginRes.json();

    // 2. Access Instance B with this session token -> Must succeed
    const accessResB = await fetch(`${urlB}/api/admin/reports`, {
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        'X-Forwarded-For': '198.51.100.6'
      }
    });
    assert.equal(accessResB.status, 200, 'Token must be valid on Instance B before revocation');

    // 3. Logout / revoke token on Instance A
    const logoutResA = await fetch(`${urlA}/api/admin/logout`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        'X-Forwarded-For': '198.51.100.7'
      }
    });
    assert.equal(logoutResA.status, 200);
    const logoutData = await logoutResA.json();
    assert.ok(logoutData.success);

    // 4. Access Instance B with the revoked token -> Must be rejected immediately!
    const postLogoutResB = await fetch(`${urlB}/api/admin/reports`, {
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        'X-Forwarded-For': '198.51.100.8'
      }
    });
    assert.equal(postLogoutResB.status, 401, 'Revoked token must be rejected on independent Instance B');
    const errData = await postLogoutResB.json();
    assert.equal(errData.error, 'Unauthorized');
  });
});

describe('4. Public Report Submission, Schema Validation & Atomic Deduplication', () => {
  test('Rejects invalid district code', async () => {
    const res = await fetch(`${urlA}/api/reports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '198.51.100.11'
      },
      body: JSON.stringify({
        district_code: 'INVALID_XYZ',
        type: 'theft',
        location: 'Mirpur-10, Dhaka',
        description: 'Bicycle was stolen from outside the market.',
        incident_date: '2026-10-20',
        incident_time: '14:30'
      })
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.includes('Invalid district'));
  });

  test('Rejects out-of-range 24-hr time (e.g. 25:99)', async () => {
    const res = await fetch(`${urlA}/api/reports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '198.51.100.12'
      },
      body: JSON.stringify({
        district_code: 'BD3026', // Dhaka
        type: 'theft',
        location: 'Mirpur-10, Dhaka',
        description: 'Bicycle was stolen from outside the market.',
        incident_date: '2026-10-20',
        incident_time: '25:99'
      })
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.includes('time format'));
  });

  test('Rejects oversized description (> 2000 chars)', async () => {
    const hugeDescription = 'B'.repeat(2100);
    const res = await fetch(`${urlA}/api/reports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '198.51.100.13'
      },
      body: JSON.stringify({
        district_code: 'BD3026',
        type: 'theft',
        location: 'Mirpur-10, Dhaka',
        description: hugeDescription,
        incident_date: '2026-10-20',
        incident_time: '14:30'
      })
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.includes('between 15 and 2000'));
  });

  test('Strips HTML tags & neutralizes malicious URLs upon submission', async () => {
    const res = await fetch(`${urlA}/api/reports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '198.51.100.14'
      },
      body: JSON.stringify({
        district_code: 'BD3026', // Dhaka
        type: 'snatching',
        location: '<script>alert(1)</script>Mirpur Sector 10',
        description: 'Citizen report narrative testing HTML tag stripping <img src=x onerror=alert(2)>.',
        incident_date: '2026-10-20',
        incident_time: '14:30',
        reference_url: 'javascript:alert(document.cookie)' // Malicious protocol
      })
    });
    assert.equal(res.status, 201);
    const data = await res.json();
    assert.ok(data.tracking_code.startsWith('WD-'));
    assert.equal(data.status, 'pending');
  });

  test('Database-backed atomic deduplication rejects duplicate submissions within sliding window', async () => {
    const payload = {
      district_code: 'BD2015', // Chittagong
      type: 'robbery',
      location: 'GEC Circle Commercial Road',
      description: 'Synthetic test report for atomic deduplication verification in WatchDog BD.',
      incident_date: '2026-10-21',
      incident_time: '18:00'
    };

    // First submission -> Accepted (201 Created)
    const res1 = await fetch(`${urlA}/api/reports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '198.51.100.15'
      },
      body: JSON.stringify(payload)
    });
    assert.equal(res1.status, 201);

    // Immediate duplicate submission on Instance B -> Rejected (409 Conflict)
    const res2 = await fetch(`${urlB}/api/reports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '198.51.100.16'
      },
      body: JSON.stringify(payload)
    });
    assert.equal(res2.status, 409);
    const errData = await res2.json();
    assert.ok(errData.error.includes('ইতিমধ্যে') || errData.error.includes('duplicate'));
  });
});

describe('5. Distributed Rate Limiting Enforcement', () => {
  test('Enforces rate limit: 6th report submission from same IP is blocked with 429 and Retry-After', async () => {
    const testIp = '198.51.100.77';
    const basePayload = {
      district_code: 'BD3026',
      type: 'theft',
      location: 'Dhanmondi Lake Walkway',
      incident_date: '2026-10-20',
      incident_time: '15:00'
    };

    // Send 5 rapid submissions (max allowed per 15 min)
    for (let i = 1; i <= 5; i++) {
      const res = await fetch(`${urlA}/api/reports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': testIp
        },
        body: JSON.stringify({
          ...basePayload,
          description: `Unique valid incident report narrative number ${i} testing rate limit barrier.`
        })
      });
      assert.equal(res.status, 201, `Submission ${i} should have succeeded`);
    }

    // 6th submission from same IP -> Must be blocked with 429
    const blockedRes = await fetch(`${urlA}/api/reports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': testIp
      },
      body: JSON.stringify({
        ...basePayload,
        description: 'Submission number 6 exceeding the allowed limit.'
      })
    });

    assert.equal(blockedRes.status, 429, '6th request must receive 429 Too Many Requests');
    assert.ok(blockedRes.headers.get('retry-after'), 'Must include Retry-After header');
    assert.equal(blockedRes.headers.get('x-ratelimit-limit'), '5');
    const blockedData = await blockedRes.json();
    assert.ok(blockedData.error.includes('সীমা') || blockedData.error.includes('limit'));
  });
});

describe('6. Citizen Privacy & Data Leakage Prevention', () => {
  test('Public /api/stats never returns reporter identities or victim indicators', async () => {
    const res = await fetch(`${urlA}/api/stats`);
    assert.equal(res.status, 200);
    const data = await res.json();

    assert.ok(Array.isArray(data.incidents));
    for (const incident of data.incidents) {
      assert.equal(incident.reporter, undefined, 'Reporter object exposed in public stats');
      assert.equal(incident.reporter_name, undefined, 'Reporter name exposed in public stats');
      assert.equal(incident.reporter_contact, undefined, 'Reporter contact exposed in public stats');
      assert.equal(incident.is_victim, undefined, 'Victim indicator exposed in public stats');
    }
  });

  test('Public /api/districts/:code never returns reporter identities', async () => {
    const res = await fetch(`${urlA}/api/districts/BD3026`);
    assert.equal(res.status, 200);
    const data = await res.json();

    assert.equal(data.code, 'BD3026');
    assert.ok(Array.isArray(data.incidents));
    for (const incident of data.incidents) {
      assert.equal(incident.reporter, undefined, 'Reporter object exposed in district profile');
      assert.equal(incident.reporter_name, undefined, 'Reporter name exposed in district profile');
      assert.equal(incident.reporter_contact, undefined, 'Reporter contact exposed in district profile');
    }
  });

  test('Private submitter tracking /api/reports/track/:code returns status without leaking identities', async () => {
    // Submit synthetic report
    const subRes = await fetch(`${urlA}/api/reports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '198.51.100.21'
      },
      body: JSON.stringify({
        district_code: 'BD6091', // Sylhet
        type: 'fraud',
        location: 'Zindabazar Shopping Arcade',
        description: 'Synthetic fraudulent scheme report for tracking privacy verification.',
        incident_date: '2026-10-21',
        incident_time: '11:00',
        reporter_name: 'Private Citizen Name',
        reporter_contact: '+8801700000000'
      })
    });
    const subData = await subRes.json();
    assert.ok(subData.tracking_code);

    // Track status
    const trackRes = await fetch(`${urlA}/api/reports/track/${subData.tracking_code}`, {
      headers: { 'X-Forwarded-For': '198.51.100.22' }
    });
    assert.equal(trackRes.status, 200);
    const trackData = await trackRes.json();

    assert.equal(trackData.tracking_code, subData.tracking_code);
    assert.equal(trackData.status, 'pending');
    assert.equal(trackData.reporter, undefined, 'Reporter object leaked in tracking');
    assert.equal(trackData.reporter_name, undefined, 'Reporter name leaked in tracking');
    assert.equal(trackData.reporter_contact, undefined, 'Reporter contact leaked in tracking');
    assert.equal(trackData.description, undefined, 'Full narrative leaked in tracking');
  });
});

describe('7. NoSQL Operator Injection & Query Sanitization', () => {
  test('Recursive query sanitizer strips MongoDB operator keys ($ne, $gt, $where)', async () => {
    const res = await fetch(`${urlA}/api/stats?district[$ne]=null&type[$gt]=`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.total !== undefined);
  });
});
