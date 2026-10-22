#!/usr/bin/env node
/**
 * WatchDog BD — Community-Powered Crime Reporting & Public Safety Intelligence
 * 100% Full-Stack JavaScript Backend (Express.js + MongoDB Atlas Cloud)
 * Production Hardened, Vercel Serverless Ready
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
const IS_PROD = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';

if (!fs.existsSync(DATA_DIR) && !IS_PROD) {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch {}
}

// Load district GeoJSON
const districtsData = JSON.parse(fs.readFileSync(path.join(PUBLIC_DIR, 'districts.geojson'), 'utf8'));
const DISTRICT_MAP = {};
for (const f of districtsData.features) {
  DISTRICT_MAP[f.properties.code] = f.properties;
}

// Configured crime categories
const TYPES = ['snatching', 'theft', 'robbery', 'extortion', 'harassment', 'assault', 'fraud', 'drug_related', 'other'];

// Production Security Configuration
let SECRET = (process.env.SAFEMAP_SECRET || '').trim();
if (!SECRET) {
  if (IS_PROD) {
    SECRET = crypto.createHash('sha256').update(process.env.MONGODB_URI || 'watchdog_bd_fallback_salt_2026').digest('hex');
    console.warn('[SECURITY WARNING] SAFEMAP_SECRET missing in production. Using cluster-derived deterministic signature.');
  } else {
    SECRET = 'watchdog_bd_dev_secret_key_8492049104810284';
  }
}

let ADMIN_PASS = (process.env.SAFEMAP_ADMIN_PASSWORD || 'admin123').trim();
if (!process.env.SAFEMAP_ADMIN_PASSWORD) {
  console.log('[AUTH] SAFEMAP_ADMIN_PASSWORD not set. Using default admin password: admin123');
} else {
  console.log('[AUTH] Admin password configured from environment variable.');
}


// Rate Limiting (In-memory fallback + Mongo TTL supported)
const rateMap = new Map();
function isRateLimited(key, maxRequests = 20, windowSec = 3600) {
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
  const expiry = Math.floor(Date.now() / 1000) + 3600 * 12; // 12 hours
  const nonce = crypto.randomBytes(8).toString('hex');
  const raw = `${expiry}.${nonce}`;
  const sig = crypto.createHmac('sha256', SECRET).update(raw).digest('hex');
  return `${raw}.${sig}`;
}

function verifyToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.slice(7).trim();
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
    this.mode = 'disconnected';
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

        // Security & Performance Indexes
        await this.db.collection('reports').createIndex({ status: 1, district_code: 1 });
        await this.db.collection('reports').createIndex({ verification_status: 1 });
        await this.db.collection('reports').createIndex({ tracking_code: 1 }, { unique: true, sparse: true });
        await this.db.collection('reports').createIndex({ incident_date: -1 });
        await this.db.collection('reports').createIndex({ created_at: -1 });
        await this.db.collection('visits').createIndex({ date: -1 });

        this.mode = 'mongodb';
        this.initDone = true;
        console.log(`[DATABASE] Connected to MongoDB Atlas successfully! (Database: ${dbName})`);
        return;
      } catch (err) {
        console.error(`[DATABASE ERROR] MongoDB Atlas connection failed: ${err.message}`);
        if (IS_PROD) {
          this.mode = 'disconnected';
          this.initDone = true;
          return;
        }
      }
    }

    if (IS_PROD) {
      this.mode = 'disconnected';
      this.initDone = true;
      console.error('[DATABASE CRITICAL] MONGODB_URI not configured in production. Local disk fallback disabled.');
      return;
    }

    // Dev mode fallback only
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
    if (this.mode === 'local' && !IS_PROD) {
      try { fs.writeFileSync(this.localFilePath, JSON.stringify(this.localReports, null, 2), 'utf8'); } catch {}
    }
  }

  async getApprovedReports(filters = {}) {
    if (this.mode === 'mongodb') {
      const query = { status: 'approved' };
      if (filters.district) query.district_code = filters.district;
      if (filters.type) query.type = filters.type;
      if (filters.verification_status) query.verification_status = filters.verification_status;

      const docs = await this.db.collection('reports')
        .find(query)
        .sort({ incident_date: -1, _id: -1 })
        .toArray();
      return docs.map(doc => ({ ...doc, id: doc._id ? doc._id.toString() : '' }));
    }

    if (this.mode === 'disconnected') {
      return [];
    }

    return this.localReports
      .filter(r => r.status === 'approved' && (!filters.district || r.district_code === filters.district))
      .slice()
      .reverse();
  }

  async getAdminReports(status, verificationStatus) {
    if (this.mode === 'mongodb') {
      const query = {};
      if (status) query.status = status;
      if (verificationStatus) query.verification_status = verificationStatus;

      const docs = await this.db.collection('reports')
        .find(query)
        .sort({ _id: -1 })
        .limit(250)
        .toArray();
      return docs.map(doc => {
        const id = doc._id.toString();
        delete doc._id;
        return { ...doc, id };
      });
    }

    if (this.mode === 'disconnected') return [];

    return this.localReports
      .filter(r => (!status || r.status === status) && (!verificationStatus || r.verification_status === verificationStatus))
      .slice()
      .reverse()
      .slice(0, 250);
  }

  async insertReport(record) {
    if (this.mode === 'mongodb') {
      const res = await this.db.collection('reports').insertOne(record);
      return res.insertedId.toString();
    }

    if (this.mode === 'disconnected') {
      throw new Error('Database service unavailable. Please retry in a few moments.');
    }

    const id = (this.localReports.length + 1).toString();
    const item = { ...record, id };
    this.localReports.push(item);
    this.saveLocal();
    return id;
  }

  async updateReportStatus(rid, newStatus, verificationStatus, moderatorNote, reviewedAt) {
    const updateFields = {
      status: newStatus,
      reviewed_at: reviewedAt
    };
    if (verificationStatus) {
      updateFields.verification_status = verificationStatus;
    }
    if (moderatorNote) {
      updateFields['moderation.moderator_note'] = moderatorNote;
      updateFields['moderation.reviewed_at'] = reviewedAt;
    }

    if (this.mode === 'mongodb') {
      let query;
      try {
        query = { _id: new ObjectId(rid) };
      } catch {
        query = { _id: rid };
      }
      const res = await this.db.collection('reports').updateOne(query, { $set: updateFields });
      return res.matchedCount === 1;
    }

    if (this.mode === 'disconnected') return false;

    const item = this.localReports.find(r => r.id === rid);
    if (!item) return false;
    Object.assign(item, updateFields);
    this.saveLocal();
    return true;
  }

  async getReportByTracking(code) {
    const cleanCode = String(code || '').trim().toUpperCase();
    if (!cleanCode) return null;
    if (this.mode === 'mongodb') {
      return await this.db.collection('reports').findOne(
        { tracking_code: cleanCode },
        { projection: { tracking_code: 1, status: 1, verification_status: 1, district_code: 1, type: 1, created_at: 1, reviewed_at: 1 } }
      );
    }
    const item = this.localReports.find(r => r.tracking_code === cleanCode);
    if (!item) return null;
    return {
      tracking_code: item.tracking_code,
      status: item.status,
      verification_status: item.verification_status,
      district_code: item.district_code,
      type: item.type,
      created_at: item.created_at,
      reviewed_at: item.reviewed_at
    };
  }

  // --- Privacy-Preserving Visitor Analytics ---
  async recordVisit(meta = {}) {
    const todayStr = new Date().toISOString().slice(0, 10);
    // Hash IP with daily salt so raw IPs are NEVER stored in the database
    const ipRaw = String(meta.ip || '');
    const ipHash = crypto.createHash('sha256').update(ipRaw + todayStr + SECRET).digest('hex').slice(0, 16);

    if (this.mode === 'mongodb') {
      try {
        await this.db.collection('visits').insertOne({
          timestamp: new Date(),
          date: todayStr,
          ip_hash: ipHash
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

      // Last 7 days trend
      const dailyVisits = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000);
        const dayKey = d.toISOString().slice(0, 10);
        const count = await this.db.collection('visits').countDocuments({ date: dayKey });
        dailyVisits.push({ date: dayKey, count });
      }

      // Verification status distribution
      const verifiedNews = await this.db.collection('reports').countDocuments({ verification_status: 'published_news_report' });
      const independentlyVerified = await this.db.collection('reports').countDocuments({ verification_status: 'independently_verified' });
      const moderated = await this.db.collection('reports').countDocuments({ verification_status: 'moderated' });

      return {
        total_visits: totalVisits,
        today_visits: todayVisits,
        total_reports: totalReports,
        pending_reports: pendingReports,
        approved_reports: approvedReports,
        rejected_reports: rejectedReports,
        verification_breakdown: {
          published_news_report: verifiedNews,
          independently_verified: independentlyVerified,
          moderated: moderated
        },
        daily_visits: dailyVisits
      };
    }

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
      verification_breakdown: {
        published_news_report: 0,
        independently_verified: 0,
        moderated: approvedReports
      },
      daily_visits: dailyVisits
    };
  }
}

const dbService = new DatabaseService();

// Middleware: Comprehensive Security Headers & DB Init
let dbInitPromise = null;
app.use(async (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');
  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' https://unpkg.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https://unpkg.com https://*.tile.openstreetmap.org; connect-src 'self'; frame-ancestors 'none';");

  if (!dbInitPromise) {
    dbInitPromise = dbService.init();
  }
  await dbInitPromise;
  next();
});

app.use(express.json({ limit: '32kb' }));

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

// 2. Statistics & Public Incidents Endpoint (PII-SCRUBBED & SANITIZED)
app.get('/api/stats', async (req, res) => {
  const district = (req.query.district || '').toString();
  const category = (req.query.type || '').toString();

  if (district && !DISTRICT_MAP[district]) {
    return res.status(400).json({ error: 'Invalid district code' });
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

  let scoped = approved;
  if (district) {
    scoped = scoped.filter(r => r.district_code === district);
  }
  if (category && TYPES.includes(category)) {
    scoped = scoped.filter(r => r.type === category);
  }

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

  // PRIVACY DEFENSE: Reporter identities & victim flags are strictly removed
  const incidents = scoped.slice(0, 100).map(r => ({
    id: r.id || (r._id ? r._id.toString() : ''),
    district_code: r.district_code,
    type: r.type,
    incident_date: r.incident_date,
    incident_time: r.incident_time,
    location: r.approximate_area || r.location, // Approximate neighborhood only
    description: r.description,
    verification_status: r.verification_status || 'moderated',
    news_source: r.news_source || null,
    created_at: r.created_at
  }));

  // Counts for drug-related published reports
  const drugRelatedCount = approved.filter(r => r.type === 'drug_related').length;

  // Calculate crime breakdown per district for dynamic intelligence card
  const districtCrimeBreakdown = {};
  for (const r of approved) {
    if (!districtCrimeBreakdown[r.district_code]) {
      districtCrimeBreakdown[r.district_code] = {};
    }
    districtCrimeBreakdown[r.district_code][r.type] = (districtCrimeBreakdown[r.district_code][r.type] || 0) + 1;
  }

  const district_insights = Object.entries(districtCrimeBreakdown).map(([code, typeCounts]) => {
    const dInfo = DISTRICT_MAP[code];
    const sortedTypes = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);
    const highest = sortedTypes[0];
    const lowest = sortedTypes.length > 1 ? sortedTypes[sortedTypes.length - 1] : sortedTypes[0];
    const totalInDistrict = counts[code] || 0;
    return {
      code,
      name: dInfo ? dInfo.name : code,
      division: dInfo ? dInfo.division : '',
      total: totalInDistrict,
      highest_crime: highest ? {
        type: highest[0],
        count: highest[1],
        percent: Math.round((highest[1] / totalInDistrict) * 100)
      } : null,
      lowest_crime: lowest ? {
        type: lowest[0],
        count: lowest[1],
        percent: Math.round((lowest[1] / totalInDistrict) * 100)
      } : null
    };
  }).sort((a, b) => b.total - a.total);

  res.json({
    total: approved.length,
    drug_related_total: drugRelatedCount,
    district_counts: counts,
    district_insights,
    selected_count: scoped.length,
    types,
    months,
    district,
    incidents,
    total_visits: visitStats.total,
    today_visits: visitStats.today,
    db_mode: dbService.mode,
    data_status: 'live_approved_reports',
    risk_method: 'relative_report_count_not_crime_rate',
    last_updated: approved.length > 0 ? (approved[0].incident_date || approved[0].created_at) : new Date().toISOString().slice(0, 10)
  });
});

// 3. District Comparison Endpoint (Must be defined before :code route)
app.get('/api/districts/compare', async (req, res) => {
  const d1 = String(req.query.d1 || '').trim().toUpperCase();
  const d2 = String(req.query.d2 || '').trim().toUpperCase();

  if (!DISTRICT_MAP[d1] || !DISTRICT_MAP[d2]) {
    return res.status(400).json({ error: 'Both district codes (d1 and d2) must be valid.' });
  }

  const r1 = await dbService.getApprovedReports({ district: d1 });
  const r2 = await dbService.getApprovedReports({ district: d2 });

  const getBreakdown = (list) => {
    const counts = {};
    for (const t of TYPES) counts[t] = 0;
    for (const item of list) counts[item.type] = (counts[item.type] || 0) + 1;
    return counts;
  };

  res.json({
    district1: {
      code: d1,
      name: DISTRICT_MAP[d1].name,
      division: DISTRICT_MAP[d1].division,
      total_reports: r1.length,
      categories: getBreakdown(r1)
    },
    district2: {
      code: d2,
      name: DISTRICT_MAP[d2].name,
      division: DISTRICT_MAP[d2].division,
      total_reports: r2.length,
      categories: getBreakdown(r2)
    },
    caveat: 'Comparison based strictly on verified community submissions and public news records, not per-capita crime rates.'
  });
});

// 4. District Safety Profile Endpoint (Deep Link & Sharing)
app.get('/api/districts/:code', async (req, res) => {
  const code = String(req.params.code || '').trim().toUpperCase();
  const districtProp = DISTRICT_MAP[code];
  if (!districtProp) {
    return res.status(404).json({ error: 'District not found' });
  }

  const approved = await dbService.getApprovedReports({ district: code });
  const categoryCounts = {};
  for (const t of TYPES) categoryCounts[t] = 0;
  for (const r of approved) {
    if (categoryCounts[r.type] !== undefined) categoryCounts[r.type]++;
  }

  const sanitizedIncidents = approved.slice(0, 50).map(r => ({
    id: r.id || (r._id ? r._id.toString() : ''),
    district_code: r.district_code,
    type: r.type,
    incident_date: r.incident_date,
    incident_time: r.incident_time,
    location: r.approximate_area || r.location,
    description: r.description,
    verification_status: r.verification_status || 'moderated',
    news_source: r.news_source || null,
    created_at: r.created_at
  }));

  res.json({
    code,
    name: districtProp.name,
    division: districtProp.division,
    total_reports: approved.length,
    categories: categoryCounts,
    incidents: sanitizedIncidents,
    last_updated: approved.length > 0 ? (approved[0].incident_date || approved[0].created_at) : null,
    limitations: 'Data reflects citizen submissions and verified news reports. It does not represent total official police crime statistics.'
  });
});

// 5. Crime Categories Explorer Endpoint
app.get('/api/categories', async (req, res) => {
  const approved = await dbService.getApprovedReports();
  const distribution = {};
  for (const t of TYPES) distribution[t] = 0;
  for (const r of approved) {
    if (distribution[r.type] !== undefined) distribution[r.type]++;
  }
  res.json({
    categories: TYPES,
    distribution,
    total_approved: approved.length
  });
});

// 6. Report Status Tracking (Private Submitter Lookup)
app.get('/api/reports/track/:code', async (req, res) => {
  const trackingCode = String(req.params.code || '').trim().toUpperCase();
  if (trackingCode.length < 6 || trackingCode.length > 20) {
    return res.status(400).json({ error: 'Invalid tracking reference code' });
  }

  const record = await dbService.getReportByTracking(trackingCode);
  if (!record) {
    return res.status(404).json({ error: 'Report not found with this tracking reference.' });
  }

  res.json({
    tracking_code: record.tracking_code,
    status: record.status, // 'pending' | 'approved' | 'rejected'
    verification_status: record.verification_status || 'community_submitted',
    district_code: record.district_code,
    type: record.type,
    submitted_at: record.created_at,
    reviewed_at: record.reviewed_at || null
  });
});

// 7. Record Visitor Hit (Privacy Preserving)

app.post('/api/analytics/visit', async (req, res) => {
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
  const result = await dbService.recordVisit({ ip: clientIp });
  res.json(result);
});

// 7. Submit Incident Report (3-Step Guided Backend with Tracking Reference)
app.post('/api/reports', async (req, res) => {
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
  if (isRateLimited(`report:${clientIp}`, 10, 3600)) {
    return res.status(429).json({ error: 'Submission rate limit reached (maximum 10 per hour). Please try later.' });
  }

  const body = req.body || {};
  const code = String(body.district_code || '').trim().toUpperCase();
  const kind = String(body.type || '').trim().toLowerCase();
  const location = String(body.location || body.approximate_area || '').trim();
  const description = String(body.description || '').trim();
  const day = String(body.incident_date || '').trim();
  const clock = String(body.incident_time || '12:00').trim();
  const witnessStatus = String(body.witness_status || (body.is_victim ? 'victim' : 'witness')).trim();
  const reporterName = String(body.reporter_name || '').trim();
  const reporterContact = String(body.reporter_contact || '').trim();
  const referenceUrl = String(body.reference_url || '').trim();

  // Strict Validation
  if (!DISTRICT_MAP[code] || !TYPES.includes(kind)) {
    return res.status(400).json({ error: 'Invalid district or incident category selected.' });
  }
  if (location.length < 3 || location.length > 140) {
    return res.status(400).json({ error: 'Approximate area must be between 3 and 140 characters. (Do not provide exact residential addresses).' });
  }
  if (description.length < 15 || description.length > 2000) {
    return res.status(400).json({ error: 'Incident narrative must be between 15 and 2000 characters.' });
  }

  const parsedDate = new Date(day + 'T00:00:00Z');
  const now = new Date();
  const minDate = new Date();
  minDate.setUTCFullYear(minDate.getUTCFullYear() - 5);

  if (isNaN(parsedDate.getTime()) || parsedDate > now || parsedDate < minDate || !/^\d{2}:\d{2}$/.test(clock)) {
    return res.status(400).json({ error: 'Invalid incident date or time format (HH:MM).' });
  }

  // Generate private submitter tracking code: WD-XXXXXXXX
  const trackingCode = 'WD-' + crypto.randomBytes(4).toString('hex').toUpperCase();

  const doc = {
    tracking_code: trackingCode,
    district_code: code,
    division: DISTRICT_MAP[code].division,
    type: kind,
    incident_date: day,
    incident_time: clock,
    location,
    approximate_area: location,
    description,
    witness_status: witnessStatus,
    status: 'pending',
    verification_status: 'community_submitted',
    reference_url: referenceUrl || null,
    news_source: null,
    reporter: {
      name: reporterName || 'Anonymous Citizen',
      contact: reporterContact || null
    },
    moderation: {
      reviewed_at: null,
      moderator_note: null
    },
    created_at: new Date().toISOString()
  };

  try {
    const rid = await dbService.insertReport(doc);
    res.status(201).json({
      id: rid,
      tracking_code: trackingCode,
      status: 'pending',
      verification_status: 'community_submitted',
      message: 'Your report has been received and queued for review.'
    });
  } catch (err) {
    res.status(503).json({ error: err.message || 'Unable to store report at this time.' });
  }
});

// 8. Admin Login (Hardened & Rate-Limited)
app.post('/api/admin/login', (req, res) => {
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
  if (isRateLimited(`login:${clientIp}`, 10, 3600)) {
    return res.status(429).json({ error: 'Too many login attempts. Please try again in 1 hour.' });
  }

  if (IS_PROD && !ADMIN_PASS) {
    return res.status(403).json({ error: 'Administrator access is disabled in production because SAFEMAP_ADMIN_PASSWORD is not configured.' });
  }

  const password = String(req.body?.password || '').trim();
  if (!password || password !== ADMIN_PASS) {
    return res.status(401).json({ error: 'Incorrect password' });
  }

  res.json({ token: generateToken() });
});

// 9. Admin Reports Queue (With Verification Filtering)
app.get('/api/admin/reports', async (req, res) => {
  if (!verifyToken(req.headers.authorization)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const status = (req.query.status || 'pending').toString();
  const verification = req.query.verification_status ? String(req.query.verification_status) : null;

  if (status && !['all', 'pending', 'approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status parameter' });
  }

  const reports = await dbService.getAdminReports(status === 'all' ? null : status, verification);
  res.json({ reports });
});

// 10. Admin Update Status & Verification Tier
app.post('/api/admin/reports/:id/status', async (req, res) => {
  if (!verifyToken(req.headers.authorization)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const rid = req.params.id;
  const state = req.body?.status; // 'approved' | 'rejected'
  const verificationStatus = req.body?.verification_status; // 'moderated' | 'independently_verified' | 'published_news_report' | 'withdrawn'
  const moderatorNote = String(req.body?.moderator_note || '').trim();

  if (!['approved', 'rejected'].includes(state)) {
    return res.status(400).json({ error: 'Invalid status. Must be approved or rejected.' });
  }

  const ok = await dbService.updateReportStatus(rid, state, verificationStatus, moderatorNote, new Date().toISOString());
  if (!ok) {
    return res.status(409).json({ error: 'Report not found or update could not be completed.' });
  }

  res.json({ id: rid, status: state, verification_status: verificationStatus });
});

// 11. Admin Detailed Analytics
app.get('/api/admin/analytics', async (req, res) => {
  if (!verifyToken(req.headers.authorization)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const analytics = await dbService.getFullAnalytics();
  res.json(analytics);
});

// Server bootstrap (works locally and on Vercel)
if (!IS_PROD) {
  dbService.init().then(() => {
    app.listen(PORT, '127.0.0.1', () => {
      console.log(`WatchDog BD (Node.js): http://localhost:${PORT}`);
      console.log(`Admin Portal: http://localhost:${PORT}/admin`);
    });
  });
}

module.exports = app;
