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
const { validateAndSanitizeImage, storageService, parseMultipartBuffer } = require('./mediaStorage');

const app = express();
// Enable trust proxy for accurate client IP behind Vercel, Cloudflare, or reverse proxies
app.set('trust proxy', 1);

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
const TYPES = ['snatching', 'theft', 'robbery', 'extortion', 'harassment', 'assault', 'fraud', 'drug_related', 'rape', 'other'];

// Production Security Configuration

// 1. Secret Key Configuration (HMAC Token Signature)
let SECRET = (process.env.SAFEMAP_SECRET || '').trim();
if (IS_PROD) {
  const invalidSecrets = [
    '',
    'generate_a_random_64_char_hex_secret_here',
    'watchdog_bd_dev_secret_key_8492049104810284'
  ];
  if (!SECRET || SECRET.length < 32 || invalidSecrets.includes(SECRET)) {
    console.error('[SECURITY CRITICAL] SAFEMAP_SECRET must be set to a cryptographically secure random string of at least 32 characters in production. Deterministic fallbacks are strictly prohibited.');
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL CONFIGURATION ERROR: SAFEMAP_SECRET is missing, insecure, or under 32 characters in production.');
    }
  }
} else {
  if (!SECRET) {
    SECRET = 'watchdog_bd_dev_secret_key_8492049104810284';
  }
}

// 2. Administrator Password Configuration
let ADMIN_PASS = (process.env.SAFEMAP_ADMIN_PASSWORD || '').trim();
if (IS_PROD) {
  const weakPasswords = [
    '',
    'admin123',
    'admin',
    'password',
    'change_this_to_a_strong_password_in_production',
    '12345678',
    '1234567890'
  ];
  if (!ADMIN_PASS || ADMIN_PASS.length < 16 || weakPasswords.includes(ADMIN_PASS.toLowerCase())) {
    console.error('[AUTH CRITICAL] SAFEMAP_ADMIN_PASSWORD in production must be a strong, unique secret of at least 16 characters. Weak or default passwords are strictly prohibited.');
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL CONFIGURATION ERROR: SAFEMAP_ADMIN_PASSWORD is missing, weak, or under 16 characters in production.');
    }
  }
} else {
  if (!ADMIN_PASS) {
    ADMIN_PASS = 'admin123';
    console.warn('[AUTH WARNING] SAFEMAP_ADMIN_PASSWORD not set. Using dev default password: admin123 (Change for production!)');
  }
}

// Reliable Client IP extraction (supports Vercel, Cloudflare, proxies)
function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.headers['x-real-ip'] || req.ip || req.socket?.remoteAddress || '127.0.0.1';
}

// Distributed Rate Limiter (MongoDB Atlas shared collection with atomic increment + local sliding-window fallback)
class RateLimiter {
  constructor({ windowMs, max, message, keyPrefix }) {
    this.windowMs = windowMs;
    this.max = max;
    this.message = message;
    this.keyPrefix = keyPrefix || 'rl';
  }

  middleware() {
    return async (req, res, next) => {
      const ip = getClientIp(req);
      try {
        const { isLimited, remaining, retryAfterSec } = await dbService.checkRateLimit(
          this.keyPrefix, ip, this.windowMs, this.max
        );

        res.setHeader('X-RateLimit-Limit', this.max);
        res.setHeader('X-RateLimit-Remaining', remaining);

        if (isLimited) {
          res.setHeader('Retry-After', retryAfterSec);
          return res.status(429).json({
            error: this.message || 'অনেক বেশি অনুরোধ করা হয়েছে। অনুগ্রহ করে কিছুক্ষণ অপেক্ষা করে আবার চেষ্টা করুন। (Too many requests from this IP, please try again later.)',
            retry_after_seconds: retryAfterSec
          });
        }
        next();
      } catch (err) {
        console.error('[RATE LIMITER ERROR]', err.message);
        next();
      }
    };
  }
}

// Tiered distributed rate limiters:
const generalApiLimiter = new RateLimiter({
  windowMs: 60 * 1000,
  max: 150,
  message: 'API অনুরোধের সীমা অতিক্রম হয়েছে। অনুগ্রহ করে ১ মিনিট পর আবার চেষ্টা করুন। (API rate limit exceeded. Please wait 1 minute.)',
  keyPrefix: 'api'
});

const reportSubmitLimiter = new RateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'প্রতি ১৫ মিনিটে সর্বোচ্চ ৫টি রিপোর্ট জমা দেওয়া সম্ভব। অনুগ্রহ করে কিছুক্ষণ পর চেষ্টা করুন। (Submission limit reached: maximum 5 reports per 15 minutes per IP).',
  keyPrefix: 'submit'
});

const adminLoginLimiter = new RateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'অনেকবার ভুল পাসওয়ার্ড দিয়ে চেষ্টা করা হয়েছে। নিরাপত্তার স্বার্থে ১৫ মিনিট অপেক্ষা করুন। (Too many login attempts. Please wait 15 minutes before trying again.)',
  keyPrefix: 'login'
});

const reportTrackLimiter = new RateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 20,
  message: 'ট্র্যাকিং অনুসন্ধানের সীমা অতিক্রম হয়েছে। অনুগ্রহ করে ৫ মিনিট অপেক্ষা করুন। (Tracking query limit reached. Please wait 5 minutes.)',
  keyPrefix: 'track'
});

const visitAnalyticsLimiter = new RateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 30,
  message: 'ভিজিটর রেকর্ডিংয়ের সীমা অতিক্রম হয়েছে। (Visit recording rate limit reached.)',
  keyPrefix: 'visit'
});

// Production Hardened Input Sanitization & Helpers
function sanitizeInputString(str, maxLen = 2000) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '') // remove ASCII control characters
    .replace(/<[^>]*>?/gm, '') // strip any embedded HTML tags
    .slice(0, maxLen)
    .trim();
}

function sanitizeText(str) {
  return sanitizeInputString(str, 2000);
}

function sanitizeUrl(rawUrl) {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) return null;
  const trimmed = rawUrl.trim();
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.href;
    }
  } catch {}
  return null;
}

// Constant-time password verification to prevent timing side-channels
function verifyAdminPassword(inputPassword) {
  if (!ADMIN_PASS || typeof inputPassword !== 'string' || !inputPassword) return false;
  const aHash = crypto.createHash('sha256').update(inputPassword).digest();
  const bHash = crypto.createHash('sha256').update(ADMIN_PASS).digest();
  return crypto.timingSafeEqual(aHash, bHash);
}

// Recursive NoSQL Operator Sanitization
function stripMongoOperators(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  for (const key of Object.keys(obj)) {
    if (key.startsWith('$') || key.includes('.')) {
      delete obj[key];
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      stripMongoOperators(obj[key]);
      if (Object.keys(obj[key]).length === 0 && !Array.isArray(obj[key])) {
        delete obj[key];
      }
    }
  }
  return obj;
}

// Auth helpers
function generateToken() {
  const expiry = Math.floor(Date.now() / 1000) + 3600 * 12; // 12 hours
  const nonce = crypto.randomBytes(8).toString('hex');
  const raw = `${expiry}.${nonce}`;
  const sig = crypto.createHmac('sha256', SECRET).update(raw).digest('hex');
  return `${raw}.${sig}`;
}

async function verifyToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.slice(7).trim();
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const [expiryStr, nonce, sig] = parts;
    const expiry = parseInt(expiryStr, 10);
    if (isNaN(expiry) || expiry < Math.floor(Date.now() / 1000)) return false;

    // Check shared persistent token revocation in database
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const isRevoked = await dbService.isTokenRevoked(tokenHash);
    if (isRevoked) return false;

    const raw = `${expiry}.${nonce}`;
    const expected = crypto.createHmac('sha256', SECRET).update(raw).digest('hex');
    if (sig.length !== expected.length) return false;
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

// Server-Side Authorization Middleware
async function requireAdminAuth(req, res, next) {
  const authHeader = req.headers.authorization || (req.query.token ? `Bearer ${req.query.token}` : null);
  const isAuthorized = await verifyToken(authHeader);
  if (!isAuthorized) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
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
    this.localRevokedTokens = new Map();
    this.localFingerprints = new Map();
    this.localRateLimits = new Map();
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

        // Distributed Rate Limiting & TTL Auto-Cleanup Indexes
        await this.db.collection('rate_limits').createIndex({ reset_at: 1 }, { expireAfterSeconds: 0 });
        await this.db.collection('revoked_tokens').createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 });
        await this.db.collection('submission_fingerprints').createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 });

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
    if (newStatus === 'approved') {
      updateFields['image.status'] = 'approved';
    } else if (newStatus === 'rejected') {
      updateFields['image.status'] = 'rejected';
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
    if (item.image) {
      if (newStatus === 'approved') item.image.status = 'approved';
      else if (newStatus === 'rejected') item.image.status = 'rejected';
    }
    this.saveLocal();
    return true;
  }

  async getReportById(rid) {
    if (!rid) return null;
    if (this.mode === 'mongodb') {
      let query;
      try {
        query = { $or: [{ _id: new ObjectId(rid) }, { id: rid }, { _id: rid }] };
      } catch {
        query = { $or: [{ id: rid }, { _id: rid }] };
      }
      return await this.db.collection('reports').findOne(query);
    }
    return this.localReports.find(r => r.id === rid || r._id === rid) || null;
  }

  async getReportByMediaId(mediaId) {
    if (!mediaId) return null;
    if (this.mode === 'mongodb') {
      return await this.db.collection('reports').findOne({ 'image.media_id': mediaId });
    }
    return this.localReports.find(r => r.image && r.image.media_id === mediaId) || null;
  }

  async deleteReport(rid) {
    if (this.mode === 'mongodb') {
      let query;
      try {
        query = { $or: [{ _id: new ObjectId(rid) }, { id: rid }, { _id: rid }] };
      } catch {
        query = { $or: [{ id: rid }, { _id: rid }] };
      }
      const res = await this.db.collection('reports').deleteOne(query);
      return res.deletedCount === 1;
    }

    if (this.mode === 'disconnected') return false;

    const initialLen = this.localReports.length;
    this.localReports = this.localReports.filter(r => r.id !== rid && r._id !== rid);
    if (this.localReports.length < initialLen) {
      this.saveLocal();
      return true;
    }
    return false;
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

  // --- Distributed Persistent Rate Limiting ---
  async checkRateLimit(prefix, ip, windowMs, max) {
    const now = Date.now();
    const resetAt = new Date(now + windowMs);

    if (this.mode === 'mongodb' && this.db) {
      const key = `${prefix}:${ip}`;
      const doc = await this.db.collection('rate_limits').findOneAndUpdate(
        { _id: key, reset_at: { $gt: new Date(now) } },
        { $inc: { count: 1 } },
        { returnDocument: 'after' }
      );

      let currentCount = 1;
      let windowResetTime = resetAt.getTime();

      if (!doc) {
        await this.db.collection('rate_limits').updateOne(
          { _id: key },
          { $set: { count: 1, reset_at: resetAt } },
          { upsert: true }
        );
        currentCount = 1;
      } else {
        currentCount = doc.count;
        if (doc.reset_at) windowResetTime = new Date(doc.reset_at).getTime();
      }

      const remaining = Math.max(0, max - currentCount);
      const retryAfterSec = Math.max(1, Math.ceil((windowResetTime - now) / 1000));
      const isLimited = currentCount > max;

      return { isLimited, remaining, retryAfterSec };
    }

    // Local in-memory fallback
    const key = `${prefix}:${ip}`;
    const timestamps = (this.localRateLimits.get(key) || []).filter(t => now - t < windowMs);

    if (timestamps.length >= max) {
      const oldest = timestamps[0];
      const retryAfterSec = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
      return { isLimited: true, remaining: 0, retryAfterSec };
    }

    timestamps.push(now);
    this.localRateLimits.set(key, timestamps);
    return { isLimited: false, remaining: Math.max(0, max - timestamps.length), retryAfterSec: 0 };
  }

  // --- Distributed Persistent Token Revocation ---
  async revokeToken(tokenHash, expiresAtDate) {
    if (this.mode === 'mongodb' && this.db) {
      await this.db.collection('revoked_tokens').updateOne(
        { _id: tokenHash },
        { $set: { expires_at: expiresAtDate, revoked_at: new Date() } },
        { upsert: true }
      );
      return;
    }
    this.localRevokedTokens.set(tokenHash, expiresAtDate.getTime());
  }

  async isTokenRevoked(tokenHash) {
    if (this.mode === 'mongodb' && this.db) {
      const doc = await this.db.collection('revoked_tokens').findOne({ _id: tokenHash });
      if (!doc) return false;
      if (doc.expires_at && new Date(doc.expires_at).getTime() < Date.now()) return false;
      return true;
    }
    const exp = this.localRevokedTokens.get(tokenHash);
    if (!exp) return false;
    if (exp < Date.now()) {
      this.localRevokedTokens.delete(tokenHash);
      return false;
    }
    return true;
  }

  // --- Database-Backed Atomic Duplicate Submission Tracking ---
  async checkAndRecordDuplicateSubmission(fingerprintHash, windowSeconds = 600) {
    const expiresAt = new Date(Date.now() + windowSeconds * 1000);
    if (this.mode === 'mongodb' && this.db) {
      try {
        await this.db.collection('submission_fingerprints').insertOne({
          _id: fingerprintHash,
          created_at: new Date(),
          expires_at: expiresAt
        });
        return true;
      } catch (err) {
        if (err.code === 11000) {
          return false; // Atomic primary key collision in MongoDB Atlas
        }
        throw err;
      }
    }

    const exp = this.localFingerprints.get(fingerprintHash);
    if (exp && exp > Date.now()) {
      return false;
    }
    this.localFingerprints.set(fingerprintHash, expiresAt.getTime());
    return true;
  }
}

const dbService = new DatabaseService();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Multipart/form-data parser middleware for single-image and field submissions
app.use((req, res, next) => {
  const contentType = req.headers['content-type'] || '';
  if (contentType.includes('multipart/form-data')) {
    const match = contentType.match(/boundary=([^\s;]+)/i);
    if (!match) return next();
    const boundary = match[1].replace(/^["']|["']$/g, '');
    const chunks = [];
    let totalBytes = 0;
    const MAX_UPLOAD = 10 * 1024 * 1024; // 10MB

    req.on('data', chunk => {
      totalBytes += chunk.length;
      if (totalBytes > MAX_UPLOAD) {
        return res.status(413).json({ error: 'Payload too large. Maximum upload size is 5 MB.' });
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      try {
        const fullBuffer = Buffer.concat(chunks);
        const { fields, file } = parseMultipartBuffer(fullBuffer, boundary);
        req.body = { ...(req.body || {}), ...fields };
        if (file) {
          req.file = file;
        }
        next();
      } catch (err) {
        console.error('Multipart parse error:', err.message);
        res.status(400).json({ error: 'Failed to parse multipart form data.' });
      }
    });
    return;
  }
  next();
});

// Middleware: Comprehensive Security Headers, DB Init & NoSQL Sanitization
let dbInitPromise = null;
app.use(async (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');
  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' https://unpkg.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https://unpkg.com https://*.tile.openstreetmap.org; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';");

  // Anti-CSRF Origin Check for State-Changing Requests (POST, DELETE)
  const method = req.method.toUpperCase();
  if (['POST', 'DELETE', 'PUT', 'PATCH'].includes(method)) {
    const origin = req.headers['origin'];
    const host = req.headers['host'];
    if (origin && host) {
      try {
        const originHost = new URL(origin).host;
        if (originHost !== host) {
          return res.status(403).json({ error: 'Cross-origin request rejected for security.' });
        }
      } catch {
        return res.status(403).json({ error: 'Invalid origin header.' });
      }
    }
  }

  // Strip NoSQL operators from query, body, and params
  if (req.body) stripMongoOperators(req.body);
  if (req.query) stripMongoOperators(req.query);
  if (req.params) stripMongoOperators(req.params);

  if (!dbInitPromise) {
    dbInitPromise = dbService.init();
  }
  await dbInitPromise;
  next();
});

// Static files
app.use(express.static(PUBLIC_DIR));

// Dedicated Admin Portal
app.get('/admin', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'admin.html'));
});

// Global API Rate Limiter
app.use('/api', generalApiLimiter.middleware());

// 1. Metadata endpoint
app.get('/api/meta', (req, res) => {
  res.json({
    districts: districtsData.features.map(f => f.properties),
    types: TYPES
  });
});

// 2. Statistics & Public Incidents Endpoint (PII-SCRUBBED & SANITIZED)
app.get('/api/stats', async (req, res) => {
  const district = (typeof req.query.district === 'string') ? req.query.district.trim() : '';
  const category = (typeof req.query.type === 'string') ? req.query.type.trim() : '';

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
    const totalInDistrict = counts[code] || 0;

    const highest = sortedTypes.length > 0 ? sortedTypes[0] : null;

    // Lowest crime must be a distinct category from highest AND have strictly fewer reports
    let lowest = null;
    if (sortedTypes.length > 1) {
      const candidateLowest = sortedTypes[sortedTypes.length - 1];
      if (candidateLowest[0] !== highest[0] && candidateLowest[1] < highest[1]) {
        lowest = candidateLowest;
      }
    }

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

// 6. Report Status Tracking (Private Submitter Lookup - Rate Limited)
app.get('/api/reports/track/:code', reportTrackLimiter.middleware(), async (req, res) => {
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

// 7. Record Visitor Hit (Privacy Preserving - Rate Limited)
app.post('/api/analytics/visit', visitAnalyticsLimiter.middleware(), async (req, res) => {
  const clientIp = getClientIp(req);
  const result = await dbService.recordVisit({ ip: clientIp });
  res.json(result);
});

// 8. Submit Incident Report (Minimal Composer Backend with Auto-Timestamp, Single-Image Upload & Tracking Reference)
app.post('/api/reports', reportSubmitLimiter.middleware(), async (req, res) => {
  const body = req.body || {};
  const code = String(body.district_code || '').trim().toUpperCase();
  const kind = String(body.type || '').trim().toLowerCase();
  let rawLoc = String(body.location || body.approximate_area || '').trim();
  const rawDesc = String(body.description || '').trim();

  // Strict District & Crime Category Validation
  if (!DISTRICT_MAP[code] || !TYPES.includes(kind)) {
    return res.status(400).json({ error: 'Invalid district or incident category selected.' });
  }

  // Location: If not provided in minimal composer, fallback to district name
  if (!rawLoc && DISTRICT_MAP[code]) {
    rawLoc = DISTRICT_MAP[code].name;
  }
  if (rawLoc.length < 3 || rawLoc.length > 140) {
    return res.status(400).json({ error: 'Approximate area must be between 3 and 140 characters. (Do not provide exact residential addresses).' });
  }

  // Description Validation: 15 to 2,000 characters
  if (rawDesc.length < 15 || rawDesc.length > 2000) {
    return res.status(400).json({ error: 'Incident narrative must be between 15 and 2000 characters.' });
  }

  const location = sanitizeInputString(rawLoc, 140);
  const description = sanitizeInputString(rawDesc, 2000);

  // Anonymous & Reporter Identity Protection
  const isAnonymous = body.is_anonymous === true || body.is_anonymous === 'true' || !body.reporter_name;
  const reporterName = isAnonymous
    ? 'Anonymous Citizen'
    : sanitizeInputString(String(body.reporter_name || ''), 60);
  const reporterContact = sanitizeInputString(String(body.reporter_contact || ''), 80);
  const referenceUrl = sanitizeUrl(body.reference_url);

  const rawWitness = String(body.witness_status || '').trim().toLowerCase();
  const allowedWitness = ['victim', 'witness', 'concerned_citizen', 'other'];
  const witnessStatus = allowedWitness.includes(rawWitness)
    ? rawWitness
    : (body.is_victim ? 'victim' : 'witness');

  // Automatic Server-Side Date & Time Generation
  const nowUtc = new Date();
  const submissionTimestampUtc = nowUtc.toISOString();

  // Format in Bangladesh Time (Asia/Dhaka - UTC+6)
  const dhakaFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  const dhakaParts = dhakaFormatter.formatToParts(nowUtc);
  const partMap = {};
  dhakaParts.forEach(p => partMap[p.type] = p.value);
  const dhakaDateStr = `${partMap.year}-${partMap.month}-${partMap.day}`;
  const dhakaTimeStr = `${partMap.hour}:${partMap.minute}`;
  const dhakaFullString = `${dhakaDateStr} ${dhakaTimeStr}:${partMap.second} (Asia/Dhaka)`;

  let day = String(body.incident_date || '').trim();
  let clock = String(body.incident_time || '').trim();
  let dateIsSubmissionTime = false;

  if (!day && !clock) {
    // User submitted via minimal composer: Use automatic server-side timestamp
    day = dhakaDateStr;
    clock = dhakaTimeStr;
    dateIsSubmissionTime = true;
  } else {
    // Manual date/time provided (e.g. from existing regression test suite or API client)
    if (!clock) clock = '12:00';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^([01]\d|2[0-3]):([0-5]\d)$/.test(clock)) {
      return res.status(400).json({ error: 'Invalid incident date format (YYYY-MM-DD) or time format (HH:MM, 00:00-23:59).' });
    }
    const parsedDate = new Date(day + 'T00:00:00Z');
    const minDate = new Date();
    minDate.setUTCFullYear(minDate.getUTCFullYear() - 5);
    if (isNaN(parsedDate.getTime()) || parsedDate > nowUtc || parsedDate < minDate) {
      return res.status(400).json({ error: 'Incident date must be a valid date within the last 5 years.' });
    }
  }

  // Anti-Spam / Deduplication Fingerprint (Atomic database-backed with TTL expiration)
  const subFingerprint = crypto.createHash('sha256')
    .update(`${code}:${kind}:${day}:${description.slice(0, 100)}`)
    .digest('hex');
  const isUnique = await dbService.checkAndRecordDuplicateSubmission(subFingerprint, 600);
  if (!isUnique) {
    return res.status(409).json({
      error: 'একই ধরনের রিপোর্ট ইতিমধ্যে সিস্টেমে জমা দেওয়া হয়েছে। অনুগ্রহ করে কিছুক্ষণ অপেক্ষা করুন। (A duplicate report was already submitted recently.)'
    });
  }

  // Optional Single-Image Upload Processing
  let imageDoc = null;
  let imageBuffer = null;
  let imageFilename = 'incident.jpg';

  // 1) From multipart/form-data upload
  if (req.file && req.file.buffer && req.file.buffer.length > 0) {
    imageBuffer = req.file.buffer;
    imageFilename = req.file.filename || 'incident.jpg';
  }
  // 2) From JSON base64 upload
  else if (body.image && (body.image.data || typeof body.image === 'string')) {
    const rawData = body.image.data || body.image;
    const matches = rawData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (matches && matches[2]) {
      imageBuffer = Buffer.from(matches[2], 'base64');
      imageFilename = body.image.name || body.image_name || 'incident.jpg';
    } else if (!rawData.startsWith('data:')) {
      imageBuffer = Buffer.from(rawData, 'base64');
      imageFilename = body.image.name || body.image_name || 'incident.jpg';
    }
  } else if (body.image_base64 || body.image_data) {
    const rawData = body.image_base64 || body.image_data;
    const matches = typeof rawData === 'string' ? rawData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/) : null;
    if (matches && matches[2]) {
      imageBuffer = Buffer.from(matches[2], 'base64');
    } else if (typeof rawData === 'string') {
      imageBuffer = Buffer.from(rawData, 'base64');
    }
    imageFilename = body.image_name || 'incident.jpg';
  }

  if (imageBuffer) {
    try {
      // Validate magic bytes, enforce max 5MB, reject video/fake MIME, and strip EXIF
      const validated = validateAndSanitizeImage(imageBuffer, imageFilename);
      const mediaRef = await storageService.saveMedia(
        validated.sanitizedBuffer,
        validated.mimeType,
        validated.extension,
        validated.originalName
      );

      // Save media reference in MongoDB (NEVER save binary inside incident document!)
      imageDoc = {
        media_id: mediaRef.media_id,
        storage_key: mediaRef.storage_key,
        storage_provider: mediaRef.storage_provider,
        filename: mediaRef.filename,
        mime_type: mediaRef.mime_type,
        size_bytes: mediaRef.size_bytes,
        status: 'pending',
        uploaded_at: mediaRef.uploaded_at
      };
    } catch (imgErr) {
      return res.status(400).json({ error: imgErr.message });
    }
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
    submission_timestamp: submissionTimestampUtc,
    submission_time_dhaka: dhakaFullString,
    date_is_submission_time: dateIsSubmissionTime,
    is_timestamp_auto: dateIsSubmissionTime,
    location,
    approximate_area: location,
    description,
    witness_status: witnessStatus,
    status: 'pending',
    verification_status: 'community_submitted',
    reference_url: referenceUrl || null,
    news_source: null,
    image: imageDoc,
    reporter: {
      name: reporterName,
      contact: reporterContact || null,
      is_anonymous: isAnonymous
    },
    moderation: {
      reviewed_at: null,
      moderator_note: null
    },
    created_at: submissionTimestampUtc
  };

  try {
    const rid = await dbService.insertReport(doc);
    res.status(201).json({
      success: true,
      id: rid,
      tracking_code: trackingCode,
      status: 'pending',
      verification_status: 'community_submitted',
      submission_timestamp: submissionTimestampUtc,
      submission_time_dhaka: dhakaFullString,
      date_is_submission_time: doc.date_is_submission_time,
      has_image: !!imageDoc,
      image: imageDoc ? {
        media_id: imageDoc.media_id,
        filename: imageDoc.filename,
        mime_type: imageDoc.mime_type,
        status: 'pending'
      } : null,
      message: 'আপনার রিপোর্ট জমা হয়েছে। যাচাইয়ের পর প্রকাশ করা হবে।'
    });
  } catch (err) {
    console.error('[REPORT SUBMISSION ERROR]', err.message);
    const clientErr = IS_PROD
      ? 'Unable to store report at this time. Please try again later.'
      : (err.message || 'Unable to store report at this time.');
    res.status(503).json({ error: clientErr });
  }
});

// 8.1 Public & Private Media Retrieval Endpoint
app.get('/api/media/:mediaId', async (req, res) => {
  const mediaId = String(req.params.mediaId || '').trim();
  if (!/^m_[0-9a-fA-F]{32}$/.test(mediaId)) {
    return res.status(400).json({ error: 'Invalid media ID parameter.' });
  }

  const report = await dbService.getReportByMediaId(mediaId);
  if (!report || !report.image) {
    return res.status(404).json({ error: 'Media not found.' });
  }

  // Security Rule: Images remain strictly private until admin moderation approval
  if (report.status !== 'approved') {
    const authHeader = req.headers.authorization || (req.query.token ? `Bearer ${req.query.token}` : null);
    const isAuthorized = await verifyToken(authHeader);
    if (!isAuthorized) {
      return res.status(403).json({
        error: 'এই মিডিয়া পর্যালোচনাধীন রয়েছে। শুধুমাত্র অ্যাডমিনদের অ্যাক্সেস অনুমোদিত। (Media is pending moderation. Access restricted to administrators).'
      });
    }
  }

  const buffer = await storageService.getMedia(report.image.storage_key);
  if (!buffer) {
    return res.status(404).json({ error: 'Media file could not be retrieved from storage.' });
  }

  res.setHeader('Content-Type', report.image.mime_type || 'image/jpeg');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', report.status === 'approved' ? 'public, max-age=86400' : 'no-store, must-revalidate');
  res.send(buffer);
});

// 9. Admin Login (Timing-Safe & Distributed Rate-Limited)
app.post('/api/admin/login', adminLoginLimiter.middleware(), (req, res) => {
  const weakPasswords = ['admin123', 'admin', 'password', 'change_this_to_a_strong_password_in_production'];
  if (IS_PROD && (!ADMIN_PASS || ADMIN_PASS.length < 16 || weakPasswords.includes(ADMIN_PASS.toLowerCase()))) {
    return res.status(403).json({
      error: 'Administrator access is locked in production: SAFEMAP_ADMIN_PASSWORD is weak, default, or under 16 characters.'
    });
  }

  const password = String(req.body?.password || '').trim();
  if (!password || !verifyAdminPassword(password)) {
    return res.status(401).json({ error: 'Incorrect password' });
  }

  res.json({ token: generateToken() });
});

// Server-Side Authorization Enforcement: Automatically protect all other /api/admin/* endpoints
app.use('/api/admin', (req, res, next) => {
  if (req.path === '/login') return next();
  return requireAdminAuth(req, res, next);
});

// 9.1. Admin Logout (Persistent Shared Session Invalidation Across All Instances)
app.post('/api/admin/logout', requireAdminAuth, async (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    try {
      const parts = token.split('.');
      const expiry = parseInt(parts[0], 10);
      const expiresAt = !isNaN(expiry) ? new Date(expiry * 1000) : new Date(Date.now() + 12 * 3600 * 1000);
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      await dbService.revokeToken(tokenHash, expiresAt);
    } catch (err) {
      console.error('[LOGOUT ERROR]', err.message);
    }
  }
  res.json({ success: true, message: 'Admin session invalidated across all instances.' });
});

// 9.2. Admin Reports Queue (With Verification Filtering)
app.get('/api/admin/reports', requireAdminAuth, async (req, res) => {
  const status = (req.query.status || 'pending').toString();
  const verification = req.query.verification_status ? String(req.query.verification_status) : null;

  if (status && !['all', 'pending', 'approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status parameter' });
  }

  const reports = await dbService.getAdminReports(status === 'all' ? null : status, verification);
  res.json({ reports });
});

// 10. Admin Update Status & Verification Tier
app.post('/api/admin/reports/:id/status', requireAdminAuth, async (req, res) => {
  const rid = String(req.params.id || '').trim();
  if (!/^[0-9a-fA-F]{24}$/.test(rid) && !/^\d+$/.test(rid)) {
    return res.status(400).json({ error: 'Invalid report ID parameter.' });
  }

  const state = req.body?.status; // 'approved' | 'rejected'
  const verificationStatus = req.body?.verification_status; // 'moderated' | 'independently_verified' | 'published_news_report' | 'withdrawn'
  const moderatorNote = sanitizeInputString(String(req.body?.moderator_note || ''), 500);

  if (!['approved', 'rejected'].includes(state)) {
    return res.status(400).json({ error: 'Invalid status. Must be approved or rejected.' });
  }

  const allowedVerification = ['moderated', 'independently_verified', 'published_news_report', 'withdrawn', 'community_submitted'];
  if (verificationStatus && !allowedVerification.includes(verificationStatus)) {
    return res.status(400).json({ error: 'Invalid verification status selected.' });
  }

  const ok = await dbService.updateReportStatus(rid, state, verificationStatus, moderatorNote, new Date().toISOString());
  if (!ok) {
    return res.status(409).json({ error: 'Report not found or update could not be completed.' });
  }

  res.json({ id: rid, status: state, verification_status: verificationStatus });
});

// 10.1. Admin Delete / Purge Report Permanently (e.g. Fake / Spurious Report)
app.delete('/api/admin/reports/:id', requireAdminAuth, async (req, res) => {
  const rid = String(req.params.id || '').trim();
  if (!/^[0-9a-fA-F]{24}$/.test(rid) && !/^\d+$/.test(rid)) {
    return res.status(400).json({ error: 'Invalid report ID parameter.' });
  }

  // Look up existing report to purge associated media from persistent storage
  const existing = await dbService.getReportById(rid);
  if (!existing) {
    return res.status(404).json({ error: 'Report not found or could not be deleted.' });
  }

  if (existing.image && existing.image.storage_key) {
    try {
      await storageService.deleteMedia(existing.image.storage_key);
    } catch (err) {
      console.error('[MEDIA PURGE ERROR]', err.message);
    }
  }

  const ok = await dbService.deleteReport(rid);
  if (!ok) {
    return res.status(404).json({ error: 'Report not found or could not be deleted.' });
  }

  res.json({ success: true, id: rid, message: 'Report permanently deleted.' });
});

// 10.2 Admin Safe Media Preview Endpoint
app.get('/api/admin/media/:mediaId', requireAdminAuth, async (req, res) => {
  const mediaId = String(req.params.mediaId || '').trim();
  const report = await dbService.getReportByMediaId(mediaId);
  if (!report || !report.image) {
    return res.status(404).json({ error: 'Media not found.' });
  }
  const buffer = await storageService.getMedia(report.image.storage_key);
  if (!buffer) {
    return res.status(404).json({ error: 'Media file could not be retrieved from storage.' });
  }
  res.setHeader('Content-Type', report.image.mime_type || 'image/jpeg');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store, must-revalidate');
  res.send(buffer);
});

// 11. Admin Detailed Analytics
app.get('/api/admin/analytics', requireAdminAuth, async (req, res) => {
  const analytics = await dbService.getFullAnalytics();
  res.json(analytics);
});

// Server bootstrap (works locally and on Vercel)
if (require.main === module && !IS_PROD) {
  dbService.init().then(() => {
    app.listen(PORT, '127.0.0.1', () => {
      console.log(`WatchDog BD (Node.js): http://localhost:${PORT}`);
      console.log(`Admin Portal: http://localhost:${PORT}/admin`);
    });
  });
}

module.exports = app;
