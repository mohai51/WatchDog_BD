#!/usr/bin/env node
/**
 * Bangladesh SafeMap — 100% Full-Stack JavaScript Backend
 * Express.js + MongoDB Atlas (Vercel Serverless Ready)
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');

const app = express();
const PORT = parseInt(process.env.PORT || '8000', 10);
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');

if (!fs.existsSync(DATA_DIR)) {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch {}
}

// Load district GeoJSON
const districtsData = JSON.parse(fs.readFileSync(path.join(PUBLIC_DIR, 'districts.geojson'), 'utf8'));
const DISTRICT_MAP = {};
for (const f of districtsData.features) {
  DISTRICT_MAP[f.properties.code] = f.properties;
}

const TYPES = ['snatching', 'theft', 'robbery', 'extortion', 'harassment', 'assault', 'fraud', 'other'];
const SECRET = process.env.SAFEMAP_SECRET || crypto.randomBytes(32).toString('hex');
const ADMIN_PASS = (process.env.SAFEMAP_ADMIN_PASSWORD || 'admin123').trim();
console.log('[AUTH] Admin password configured. (Default: admin123)');


// In-memory rate limiter
const rateMap = new Map();
function isRateLimited(key, maxRequests = 15, windowSec = 3600) {
  const now = Date.now();
  const timestamps = (rateMap.get(key) || []).filter(t => now - t < windowSec * 1000);
  if (timestamps.length >= maxRequests) {
    return true;
  }
  timestamps.push(now);
  rateMap.set(key, timestamps);
  return false;
}

// Auth helpers
function generateToken() {
  const expiry = Math.floor(Date.now() / 1000) + 3600 * 8;
  const nonce = crypto.randomBytes(8).toString('hex');
  const raw = `${expiry}.${nonce}`;
  const sig = crypto.createHmac('sha256', SECRET).update(raw).digest('hex');
  return `${raw}.${sig}`;
}

function verifyToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.slice(7);
  try {
    const [expiryStr, nonce, sig] = token.split('.');
    const expiry = parseInt(expiryStr, 10);
    if (isNaN(expiry) || expiry < Math.floor(Date.now() / 1000)) return false;
    const raw = `${expiry}.${nonce}`;
    const expected = crypto.createHmac('sha256', SECRET).update(raw).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

// Database Service with MongoDB Atlas & Vercel caching
class DatabaseService {
  constructor() {
    this.mode = 'local';
    this.client = null;
    this.db = null;
    this.localFilePath = path.join(DATA_DIR, 'local_reports.json');
    this.localReports = [];
    this.localVisits = [];
    this.initDone = false;
  }

  async init() {
    if (this.initDone && this.db) return;
    const mongoUri = (process.env.MONGODB_URI || '').trim();
    if (mongoUri) {
      try {
        const dbName = (process.env.MONGODB_DB_NAME || 'safemap').trim() || 'safemap';
        if (!this.client) {
          this.client = new MongoClient(mongoUri, {
            serverSelectionTimeoutMS: 5000,
            maxPoolSize: 10
          });
          await this.client.connect();
        }
        await this.client.db('admin').command({ ping: 1 });
        this.db = this.client.db(dbName);

        // Setup indexes
        await this.db.collection('reports').createIndex({ status: 1, district_code: 1 });
        await this.db.collection('reports').createIndex({ created_at: -1 });
        await this.db.collection('visits').createIndex({ date: -1 });

        this.mode = 'mongodb';
        this.initDone = true;
        console.log(`[DATABASE] Connected to MongoDB Atlas successfully! (Database: ${dbName})`);
        return;
      } catch (err) {
        console.warn(`[DATABASE WARNING] MongoDB connection failed: ${err.message}. Falling back to local storage.`);
      }
    } else {
      console.log('[DATABASE] MONGODB_URI not set. Operating on local JSON storage.');
    }

    this.mode = 'local';
    this.initDone = true;
    if (fs.existsSync(this.localFilePath)) {
      try {
        this.localReports = JSON.parse(fs.readFileSync(this.localFilePath, 'utf8'));
      } catch {
        this.localReports = [];
      }
    }
  }

  saveLocal() {
    if (this.mode === 'local') {
      try { fs.writeFileSync(this.localFilePath, JSON.stringify(this.localReports, null, 2), 'utf8'); } catch {}
    }
  }

  async getApprovedReports() {
    if (this.mode === 'mongodb') {
      const docs = await this.db.collection('reports')
        .find({ status: 'approved' })
        .sort({ incident_date: -1, _id: -1 })
        .toArray();
      return docs.map(doc => ({ ...doc, id: doc._id ? doc._id.toString() : '' }));
    }
    return this.localReports
      .filter(r => r.status === 'approved')
      .slice()
      .reverse();
  }

  async getAdminReports(status) {
    if (this.mode === 'mongodb') {
      const docs = await this.db.collection('reports')
        .find({ status })
        .sort({ _id: -1 })
        .limit(200)
        .toArray();
      return docs.map(doc => {
        const id = doc._id.toString();
        delete doc._id;
        return { ...doc, id };
      });
    }
    return this.localReports
      .filter(r => r.status === status)
      .slice()
      .reverse()
      .slice(0, 200);
  }

  async insertReport(record) {
    if (this.mode === 'mongodb') {
      const res = await this.db.collection('reports').insertOne(record);
      return res.insertedId.toString();
    }
    const id = (this.localReports.length + 1).toString();
    const item = { ...record, id };
    this.localReports.push(item);
    this.saveLocal();
    return id;
  }

  async updateReportStatus(rid, newStatus, reviewedAt) {
    if (this.mode === 'mongodb') {
      let query;
      try {
        query = { _id: new ObjectId(rid), status: 'pending' };
      } catch {
        query = { _id: rid, status: 'pending' };
      }
      const res = await this.db.collection('reports').updateOne(query, {
        $set: { status: newStatus, reviewed_at: reviewedAt }
      });
      return res.matchedCount === 1;
    }
    const item = this.localReports.find(r => r.id === rid && r.status === 'pending');
    if (!item) return false;
    item.status = newStatus;
    item.reviewed_at = reviewedAt;
    this.saveLocal();
    return true;
  }

  // --- Visitor & Analytics Tracking ---
  async recordVisit(meta = {}) {
    const todayStr = new Date().toISOString().slice(0, 10);
    if (this.mode === 'mongodb') {
      try {
        await this.db.collection('visits').insertOne({
          timestamp: new Date(),
          date: todayStr,
          ip: meta.ip || '',
          ua: meta.ua || ''
        });
        const counter = await this.db.collection('analytics').findOneAndUpdate(
          { _id: 'global_counter' },
          { $inc: { total_visits: 1 } },
          { upsert: true, returnDocument: 'after' }
        );
        const total = counter?.total_visits || await this.db.collection('visits').countDocuments();
        const today = await this.db.collection('visits').countDocuments({ date: todayStr });
        return { total, today };
      } catch (err) {
        console.error('Error recording visit:', err);
      }
    }
    this.localVisits.push({ timestamp: new Date().toISOString(), date: todayStr });
    const today = this.localVisits.filter(v => v.date === todayStr).length;
    return { total: this.localVisits.length, today };
  }

  async getVisitStats() {
    const todayStr = new Date().toISOString().slice(0, 10);
    if (this.mode === 'mongodb') {
      try {
        const counter = await this.db.collection('analytics').findOne({ _id: 'global_counter' });
        const total = counter?.total_visits || await this.db.collection('visits').countDocuments();
        const today = await this.db.collection('visits').countDocuments({ date: todayStr });
        return { total, today };
      } catch {
        return { total: 0, today: 0 };
      }
    }
    const today = this.localVisits.filter(v => v.date === todayStr).length;
    return { total: this.localVisits.length, today };
  }

  async getFullAnalytics() {
    const todayStr = new Date().toISOString().slice(0, 10);
    if (this.mode === 'mongodb') {
      const counter = await this.db.collection('analytics').findOne({ _id: 'global_counter' });
      const totalVisits = counter?.total_visits || await this.db.collection('visits').countDocuments();
      const todayVisits = await this.db.collection('visits').countDocuments({ date: todayStr });

      const totalReports = await this.db.collection('reports').countDocuments();
      const pendingReports = await this.db.collection('reports').countDocuments({ status: 'pending' });
      const approvedReports = await this.db.collection('reports').countDocuments({ status: 'approved' });
      const rejectedReports = await this.db.collection('reports').countDocuments({ status: 'rejected' });

      // Last 7 days visit trend
      const dailyVisits = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000);
        const dayKey = d.toISOString().slice(0, 10);
        const count = await this.db.collection('visits').countDocuments({ date: dayKey });
        dailyVisits.push({ date: dayKey, count });
      }

      return {
        total_visits: totalVisits,
        today_visits: todayVisits,
        total_reports: totalReports,
        pending_reports: pendingReports,
        approved_reports: approvedReports,
        rejected_reports: rejectedReports,
        daily_visits: dailyVisits
      };
    }

    // Local fallback
    const todayVisits = this.localVisits.filter(v => v.date === todayStr).length;
    const totalReports = this.localReports.length;
    const pendingReports = this.localReports.filter(r => r.status === 'pending').length;
    const approvedReports = this.localReports.filter(r => r.status === 'approved').length;
    const rejectedReports = this.localReports.filter(r => r.status === 'rejected').length;

    const dailyVisits = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const dayKey = d.toISOString().slice(0, 10);
      const count = this.localVisits.filter(v => v.date === dayKey).length;
      dailyVisits.push({ date: dayKey, count });
    }

    return {
      total_visits: this.localVisits.length,
      today_visits: todayVisits,
      total_reports: totalReports,
      pending_reports: pendingReports,
      approved_reports: approvedReports,
      rejected_reports: rejectedReports,
      daily_visits: dailyVisits
    };
  }
}

const dbService = new DatabaseService();

// Middleware
let dbInitPromise = null;
app.use(async (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "frame-ancestors 'none'");
  if (!dbInitPromise) {
    dbInitPromise = dbService.init();
  }
  await dbInitPromise;
  next();
});

app.use(express.json({ limit: '16kb' }));

// Static files
app.use(express.static(PUBLIC_DIR));

// Dedicated Admin Portal
app.get('/admin', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'admin.html'));
});

// 1. Metadata endpoint
app.get('/api/meta', (req, res) => {
  res.json({
    districts: districtsData.features.map(f => f.properties),
    types: TYPES
  });
});

// 2. Statistics & Public Visits Endpoint
app.get('/api/stats', async (req, res) => {
  const district = (req.query.district || '').toString();
  if (district && !DISTRICT_MAP[district]) {
    return res.status(400).json({ error: 'Invalid district' });
  }

  const approved = await dbService.getApprovedReports();
  const visitStats = await dbService.getVisitStats();

  const counts = {};
  for (const code of Object.keys(DISTRICT_MAP)) {
    counts[code] = 0;
  }
  for (const r of approved) {
    if (counts[r.district_code] !== undefined) {
      counts[r.district_code]++;
    }
  }

  const scoped = approved.filter(r => !district || r.district_code === district);
  const types = {};
  for (const t of TYPES) {
    types[t] = 0;
  }
  for (const r of scoped) {
    if (types[r.type] !== undefined) {
      types[r.type]++;
    }
  }

  const months = [];
  const now = new Date();
  for (let k = 5; k >= 0; k--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - k, 1));
    const yr = d.getUTCFullYear();
    const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
    const key = `${yr}-${mo}`;
    const count = scoped.filter(r => (r.incident_date || '').startsWith(key)).length;
    months.push({ month: key, count });
  }

  const incidents = scoped.slice(0, 50).map(r => ({
    id: r.id || (r._id ? r._id.toString() : ''),
    district_code: r.district_code,
    type: r.type,
    incident_date: r.incident_date,
    incident_time: r.incident_time,
    location: r.location,
    description: r.description,
    reporter_name: r.reporter_name,
    is_victim: r.is_victim,
    created_at: r.created_at
  }));

  res.json({
    total: approved.length,
    district_counts: counts,
    selected_count: scoped.length,
    types,
    months,
    district,
    incidents,
    total_visits: visitStats.total,
    today_visits: visitStats.today,
    db_mode: dbService.mode,
    data_status: 'live_approved_reports',
    risk_method: 'relative_report_count_not_crime_rate'
  });
});

// 3. Record visitor hit
app.post('/api/analytics/visit', async (req, res) => {
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
  const ua = req.headers['user-agent'] || '';
  const result = await dbService.recordVisit({ ip: clientIp, ua });
  res.json(result);
});

// 4. Submit Report
app.post('/api/reports', async (req, res) => {
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
  if (isRateLimited(`report:${clientIp}`, 12, 3600)) {
    return res.status(429).json({ error: 'Submission limit reached (12 per hour)' });
  }

  const body = req.body || {};
  const code = String(body.district_code || '');
  const kind = String(body.type || '');
  const name = String(body.reporter_name || '').trim();
  const location = String(body.location || '').trim();
  const description = String(body.description || '').trim();
  const day = String(body.incident_date || '');
  const clock = String(body.incident_time || '');
  const victim = body.is_victim;

  if (!DISTRICT_MAP[code] || !TYPES.includes(kind)) {
    return res.status(400).json({ error: 'Invalid district or type' });
  }
  if (location.length < 3 || location.length > 140 || description.length < 15 || description.length > 1500 || name.length > 100 || typeof victim !== 'boolean') {
    return res.status(400).json({ error: 'Check form fields and lengths' });
  }

  const parsedDate = new Date(day + 'T00:00:00Z');
  const now = new Date();
  const minDate = new Date();
  minDate.setUTCFullYear(minDate.getUTCFullYear() - 5);

  if (isNaN(parsedDate.getTime()) || parsedDate > now || parsedDate < minDate || !/^\d{2}:\d{2}$/.test(clock)) {
    return res.status(400).json({ error: 'Invalid date or time' });
  }

  const doc = {
    district_code: code,
    type: kind,
    incident_date: day,
    incident_time: clock,
    location,
    description,
    reporter_name: name,
    is_victim: victim ? 1 : 0,
    status: 'pending',
    created_at: new Date().toISOString(),
    reviewed_at: null
  };

  const rid = await dbService.insertReport(doc);
  res.status(201).json({ id: rid, status: 'pending', message: 'Submitted for moderation' });
});

// 5. Admin Login
app.post('/api/admin/login', (req, res) => {
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
  if (isRateLimited(`login:${clientIp}`, 15, 3600)) {
    return res.status(429).json({ error: 'Too many attempts; retry later' });
  }

  const password = String(req.body?.password || '').trim();
  if (password !== ADMIN_PASS) {
    return res.status(401).json({ error: 'Incorrect password' });
  }

  res.json({ token: generateToken() });
});

// 6. Admin Reports Queue
app.get('/api/admin/reports', async (req, res) => {
  if (!verifyToken(req.headers.authorization)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const status = (req.query.status || 'pending').toString();
  if (!['pending', 'approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const reports = await dbService.getAdminReports(status);
  res.json({ reports });
});

// 7. Admin Update Status
app.post('/api/admin/reports/:id/status', async (req, res) => {
  if (!verifyToken(req.headers.authorization)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const rid = req.params.id;
  const state = req.body?.status;
  if (!['approved', 'rejected'].includes(state)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const ok = await dbService.updateReportStatus(rid, state, new Date().toISOString());
  if (!ok) {
    return res.status(409).json({ error: 'Report not found or already reviewed' });
  }

  res.json({ id: rid, status: state });
});

// 8. Admin Detailed Analytics
app.get('/api/admin/analytics', async (req, res) => {
  if (!verifyToken(req.headers.authorization)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const analytics = await dbService.getFullAnalytics();
  res.json(analytics);
});

// Server bootstrap (works locally and on Vercel)
if (process.env.VERCEL !== '1') {
  dbService.init().then(() => {
    app.listen(PORT, '127.0.0.1', () => {
      console.log(`Bangladesh SafeMap (Node.js): http://localhost:${PORT}`);
      console.log('Admin password is read from SAFEMAP_ADMIN_PASSWORD (or generated at startup).');
    });
  });
}

module.exports = app;
