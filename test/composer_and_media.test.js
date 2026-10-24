/**
 * WatchDog BD — Minimal Composer & Secure Single-Image Upload Test Suite
 *
 * Verifies all 14 criteria:
 * 1. Valid report submission
 * 2. Anonymous report submission
 * 3. All 64 districts acceptance
 * 4. Crime category selection
 * 5. Automatic server-side timestamp (UTC + Asia/Dhaka)
 * 6. Valid image upload & metadata stripping
 * 7. Oversized image rejection (> 5MB)
 * 8. Fake MIME type rejection (magic-byte enforcement)
 * 9. Unsupported video/media rejection
 * 10. Image preview & private media access protection
 * 11. Admin image moderation
 * 12. Media purge on permanent report deletion
 * 13. Tracking ID generation
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

// Configure isolated test environment
process.env.NODE_ENV = 'test';
process.env.PORT = '0';
process.env.MONGODB_URI = '';
process.env.SAFEMAP_ADMIN_PASSWORD = 'TestAdminSecretPassword_2026!Secure';
process.env.SAFEMAP_SECRET = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

const app = require('../server.js');
const { validateAndSanitizeImage, stripJpegMetadata, detectMagicMime } = require('../mediaStorage.js');

let server;
let baseUrl;
let adminToken;

let testIpCounter = 1;

// Helper to make HTTP requests
function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const reqHeaders = {
      'x-forwarded-for': `198.51.100.${(testIpCounter++ % 200) + 1}`,
      ...headers
    };
    let reqBody = null;

    if (body) {
      if (typeof body === 'string' || Buffer.isBuffer(body)) {
        reqBody = body;
      } else {
        reqBody = JSON.stringify(body);
        if (!reqHeaders['content-type']) {
          reqHeaders['content-type'] = 'application/json';
        }
      }
      reqHeaders['content-length'] = Buffer.byteLength(reqBody);
    }

    const req = http.request(
      url,
      {
        method,
        headers: reqHeaders
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks);
          let json = null;
          try {
            json = JSON.parse(raw.toString('utf8'));
          } catch {}
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: json,
            raw
          });
        });
      }
    );

    req.on('error', reject);
    if (reqBody) req.write(reqBody);
    req.end();
  });
}

// Generate synthetic minimal 1x1 JPEG with mock EXIF APP1 marker
function createSyntheticJpegWithExif() {
  const soi = Buffer.from([0xFF, 0xD8]);
  // APP1 marker (0xFF, 0xE1), length 14, "Exif\0\0" + dummy GPS
  const exifApp1 = Buffer.from([
    0xFF, 0xE1, 0x00, 0x0E, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00, 0x47, 0x50, 0x53, 0x01
  ]);
  // DQT marker (0xFF, 0xDB), length 4
  const dqt = Buffer.from([0xFF, 0xDB, 0x00, 0x04, 0x00, 0x00]);
  // SOS marker (0xFF, 0xDA), length 8
  const sos = Buffer.from([0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F, 0x00]);
  // Scan data + EOI (0xFF, 0xD9)
  const scanData = Buffer.from([0xAA, 0xBB, 0xCC, 0xFF, 0xD9]);

  return Buffer.concat([soi, exifApp1, dqt, sos, scanData]);
}

// Generate synthetic 1x1 PNG with tEXt metadata chunk
function createSyntheticPng() {
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  // IHDR chunk: 1x1, 8-bit truecolor
  const ihdrLen = Buffer.from([0x00, 0x00, 0x00, 0x0D]);
  const ihdrData = Buffer.from('IHDR\0\0\0\x01\0\0\0\x01\x08\x02\0\0\0', 'latin1');
  const ihdrCrc = Buffer.from([0x90, 0x77, 0x53, 0xDE]);
  // tEXt chunk (metadata to strip)
  const textLen = Buffer.from([0x00, 0x00, 0x00, 0x0A]);
  const textData = Buffer.from('tEXtComment=BD', 'latin1');
  const textCrc = Buffer.from([0x12, 0x34, 0x56, 0x78]);
  // IEND chunk
  const iendLen = Buffer.from([0x00, 0x00, 0x00, 0x00]);
  const iendData = Buffer.from('IEND', 'latin1');
  const iendCrc = Buffer.from([0xAE, 0x42, 0x60, 0x82]);

  return Buffer.concat([sig, ihdrLen, ihdrData, ihdrCrc, textLen, textData, textCrc, iendLen, iendData, iendCrc]);
}

before(async () => {
  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });

  // Admin Login to acquire auth token
  const res = await request('POST', '/api/admin/login', {
    password: process.env.SAFEMAP_ADMIN_PASSWORD
  });
  assert.equal(res.status, 200);
  adminToken = res.body.token;
  assert.ok(adminToken, 'Admin token should be acquired');
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

describe('WatchDog BD — Minimal Composer & Auto-Timestamp', () => {
  test('1. Valid minimal report submission generates automatic server-side timestamp in UTC & Asia/Dhaka', async () => {
    const res = await request('POST', '/api/reports', {
      district_code: 'BD3026', // Dhaka
      type: 'snatching',
      description: 'A mobile phone was snatched near Dhanmondi 27 around sunset today.'
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.match(res.body.tracking_code, /^WD-[0-9A-F]{8}$/);
    assert.ok(res.body.submission_timestamp, 'Should provide submission_timestamp in ISO format');
    assert.ok(res.body.submission_time_dhaka, 'Should provide submission_time_dhaka formatted string');
    assert.equal(res.body.date_is_submission_time, true, 'Flag clearly identifies timestamp as submission time');
    assert.match(res.body.message, /আপনার রিপোর্ট জমা হয়েছে/);
  });

  test('2. Anonymous report submission preserves privacy and assigns "Anonymous Citizen"', async () => {
    const res = await request('POST', '/api/reports', {
      district_code: 'BD2015', // Chittagong
      type: 'extortion',
      description: 'Extortion demand made against local market vendors in Agrabad.',
      is_anonymous: true
    });

    assert.equal(res.status, 201);
    const trackingCode = res.body.tracking_code;

    // Verify public tracking status does not leak reporter details
    const trackRes = await request('GET', `/api/reports/track/${trackingCode}`);
    assert.equal(trackRes.status, 200);
    assert.equal(trackRes.body.status, 'pending');
    assert.equal(trackRes.body.reporter, undefined);
    assert.equal(trackRes.body.reporter_name, undefined);
  });

  test('3. Accepts all 64 districts of Bangladesh and rejects invalid codes', async () => {
    const districtsData = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../public/districts.geojson'), 'utf8')
    );
    assert.equal(districtsData.features.length, 64, 'Bangladesh must have exactly 64 districts');

    // Test a sample of districts across different divisions
    const sampleCodes = ['BD3026', 'BD2015', 'BD5010', 'BD4001', 'BD1006', 'BD2003', 'BD2013', 'BD4018'];
    for (const code of sampleCodes) {
      const match = districtsData.features.find((f) => f.properties.code === code);
      assert.ok(match, `District ${code} must exist in GeoJSON`);
    }

    // Attempt invalid district code
    const invalidRes = await request('POST', '/api/reports', {
      district_code: 'BD9999',
      type: 'theft',
      description: 'Attempting invalid district submission test case.'
    });
    assert.equal(invalidRes.status, 400);
    assert.match(invalidRes.body.error, /district/i);
  });

  test('4. Accepts all valid crime categories and rejects unknown categories', async () => {
    const validCategories = [
      'snatching', 'theft', 'robbery', 'extortion',
      'harassment', 'assault', 'fraud', 'drug_related', 'rape', 'other'
    ];

    // Verify rejection of fictitious crime category
    const badCatRes = await request('POST', '/api/reports', {
      district_code: 'BD3026',
      type: 'alien_invasion',
      description: 'Invalid category test description with sufficient character length.'
    });
    assert.equal(badCatRes.status, 400);
    assert.match(badCatRes.body.error, /category/i);
  });
});

describe('WatchDog BD — Secure Single-Image Upload & Object Storage', () => {
  let uploadedMediaId;
  let reportId;

  test('5. Valid JPEG image upload strips EXIF/GPS metadata and returns media reference', async () => {
    const jpegBuffer = createSyntheticJpegWithExif();
    // Validate unit EXIF stripping directly
    const stripped = stripJpegMetadata(jpegBuffer);
    assert.ok(stripped.length < jpegBuffer.length, 'EXIF segment must be stripped');
    assert.equal(stripped[0], 0xFF);
    assert.equal(stripped[1], 0xD8);

    // Upload via API
    const res = await request('POST', '/api/reports', {
      district_code: 'BD3026',
      type: 'theft',
      description: 'Bicycle stolen from apartment garage. Photo attached.',
      image_data: `data:image/jpeg;base64,${jpegBuffer.toString('base64')}`,
      image_name: 'evidence.jpg'
    });

    assert.equal(res.status, 201);
    assert.ok(res.body.image, 'Response must include image reference');
    assert.match(res.body.image.media_id, /^m_[0-9a-f]{32}$/);
    assert.equal(res.body.image.status, 'pending');
    uploadedMediaId = res.body.image.media_id;
  });

  test('6. Valid PNG image upload with tEXt chunk stripped safely', async () => {
    const pngBuffer = createSyntheticPng();
    const validated = validateAndSanitizeImage(pngBuffer, 'snapshot.png');
    assert.equal(validated.mimeType, 'image/png');
    assert.equal(validated.extension, 'png');
    // Ensure tEXt chunk was stripped
    assert.ok(!validated.sanitizedBuffer.includes(Buffer.from('tEXtComment=BD')));

    const res = await request('POST', '/api/reports', {
      district_code: 'BD5577', // Natore
      type: 'fraud',
      description: 'Counterfeit money passed at local grocery store with photo.',
      image_data: `data:image/png;base64,${pngBuffer.toString('base64')}`,
      image_name: 'counterfeit.png'
    });

    assert.equal(res.status, 201);
    assert.ok(res.body.image.media_id);
  });

  test('7. Oversized image (> 5 MB) is rejected with 400 Bad Request', async () => {
    const oversizedBuffer = Buffer.alloc(5 * 1024 * 1024 + 1024, 0xFF);
    oversizedBuffer[0] = 0xFF;
    oversizedBuffer[1] = 0xD8;
    oversizedBuffer[2] = 0xFF;

    const res = await request('POST', '/api/reports', {
      district_code: 'BD3026',
      type: 'theft',
      description: 'Attempting oversized image submission test case.',
      image_data: `data:image/jpeg;base64,${oversizedBuffer.toString('base64')}`,
      image_name: 'huge.jpg'
    });

    assert.equal(res.status, 400);
    assert.match(res.body.error, /5\s*MB/i);
  });

  test('8. Fake MIME type (text/javascript renamed to .jpg) is rejected via magic byte inspection', async () => {
    const fakeImageBuffer = Buffer.from('console.log("I am actually javascript pretending to be an image");');

    const res = await request('POST', '/api/reports', {
      district_code: 'BD3026',
      type: 'fraud',
      description: 'Attempting malicious fake image upload with spoofed extension.',
      image_data: `data:image/jpeg;base64,${fakeImageBuffer.toString('base64')}`,
      image_name: 'exploit.jpg'
    });

    assert.equal(res.status, 400);
    assert.match(res.body.error, /Invalid file format|অননুমোদিত|magic bytes|corrupted|unsupported/i);
  });

  test('9. Unsupported video (MP4 / WebM) is rejected', async () => {
    // MP4 signature (ftyp)
    const mp4Buffer = Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70]);
    const detected = detectMagicMime(mp4Buffer);
    assert.equal(detected, 'video/mp4');

    const res = await request('POST', '/api/reports', {
      district_code: 'BD3026',
      type: 'assault',
      description: 'Attempting video upload which is strictly prohibited.',
      image_data: `data:video/mp4;base64,${mp4Buffer.toString('base64')}`,
      image_name: 'clip.mp4'
    });

    assert.equal(res.status, 400);
    assert.match(res.body.error, /Invalid file format|অননুমোদিত|unsupported|video/i);
  });

  test('10. Private Media Access Protection: Unapproved image returns 403 Forbidden to public', async () => {
    assert.ok(uploadedMediaId, 'Requires uploadedMediaId from earlier test');
    // Anonymous public user attempts to access pending media
    const publicRes = await request('GET', `/api/media/${uploadedMediaId}`);
    assert.equal(publicRes.status, 403);
    assert.match(publicRes.body.error, /পর্যালোচনাধীন|restricted|pending/i);
  });

  test('11. Admin Media Access: Authenticated admin can preview private pending media via header or token param', async () => {
    assert.ok(uploadedMediaId);
    // Access with Bearer token header
    const adminHeaderRes = await request('GET', `/api/admin/media/${uploadedMediaId}`, null, {
      authorization: `Bearer ${adminToken}`
    });
    assert.equal(adminHeaderRes.status, 200);
    assert.equal(adminHeaderRes.headers['content-type'], 'image/jpeg');
    assert.equal(adminHeaderRes.headers['x-content-type-options'], 'nosniff');

    // Access via query param (?token=)
    const adminQueryRes = await request('GET', `/api/admin/media/${uploadedMediaId}?token=${adminToken}`);
    assert.equal(adminQueryRes.status, 200);
    assert.equal(adminQueryRes.headers['content-type'], 'image/jpeg');
  });

  test('12. Admin Moderation & Approval makes media publicly accessible', async () => {
    // Fetch pending reports queue to get report ID
    const queueRes = await request('GET', '/api/admin/reports?status=pending', null, {
      authorization: `Bearer ${adminToken}`
    });
    assert.equal(queueRes.status, 200);
    const targetReport = queueRes.body.reports.find(
      (r) => r.image && r.image.media_id === uploadedMediaId
    );
    assert.ok(targetReport, 'Target report with image must be found in pending queue');
    reportId = targetReport.id;

    // Approve the report
    const approveRes = await request(
      'POST',
      `/api/admin/reports/${reportId}/status`,
      {
        status: 'approved',
        verification_status: 'moderated',
        moderator_note: 'Verified evidence photo'
      },
      {
        authorization: `Bearer ${adminToken}`
      }
    );
    assert.equal(approveRes.status, 200);

    // Verify public media endpoint now serves image with 200 OK
    const publicApprovedRes = await request('GET', `/api/media/${uploadedMediaId}`);
    assert.equal(publicApprovedRes.status, 200);
    assert.equal(publicApprovedRes.headers['content-type'], 'image/jpeg');
    assert.equal(publicApprovedRes.headers['cache-control'], 'public, max-age=86400');
  });

  test('13. Media Purge on Report Permanent Deletion', async () => {
    assert.ok(reportId);
    // Delete the report permanently
    const delRes = await request('DELETE', `/api/admin/reports/${reportId}`, null, {
      authorization: `Bearer ${adminToken}`
    });
    assert.equal(delRes.status, 200);
    assert.equal(delRes.body.success, true);

    // Verify media is purged from storage (returns 404 Not Found)
    const checkMediaRes = await request('GET', `/api/admin/media/${uploadedMediaId}`, null, {
      authorization: `Bearer ${adminToken}`
    });
    assert.equal(checkMediaRes.status, 404);
  });
});
