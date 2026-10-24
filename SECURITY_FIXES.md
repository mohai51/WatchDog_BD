# WatchDog BD — Security Fixes & Implementation Changelog

This document details all security hardening changes implemented in WatchDog BD across backend services, middleware, frontend scripts, and configuration.

---

## 1. Backend Hardening (`server.js`)

### 1.1 Persistent Shared Token Revocation
* **Before:** `revokedTokens = new Set()` in process memory. Each Vercel serverless container had its own memory, rendering token revocation useless across multi-instance environments.
* **After:** Added `revoked_tokens` collection in MongoDB Atlas with automatic TTL index on `expires_at`.
* **Methods:**
  - `dbService.revokeToken(tokenHash, expiresAtDate)`: Atomically upserts `{ _id: tokenHash, expires_at: expiresAtDate }`.
  - `dbService.isTokenRevoked(tokenHash)`: Checks database before authorizing any admin Bearer token.
  - Maintains in-memory fallback only for offline local development.

### 1.2 Distributed Tiered Rate Limiting
* **Before:** `Map`-based in-memory rate limiting. Could be trivially bypassed by spreading requests across serverless instances.
* **After:** Replaced with `DistributedRateLimiter` class backed by `rate_limits` collection in MongoDB Atlas with atomic `$inc` operations and automatic TTL index on `reset_at`.
* **Limits:**
  - General API: 150 requests / minute / IP
  - Report Submissions: 5 submissions / 15 minutes / IP
  - Admin Login: 5 attempts / 15 minutes / IP
  - Tracking Reference: 20 queries / 5 minutes / IP
  - Analytics Visits: 30 recordings / hour / IP

### 1.3 Database-Backed Atomic Deduplication
* **Before:** Duplicate reports checked via in-memory Map of SHA-256 fingerprints.
* **After:** Fingerprints stored in MongoDB `submission_fingerprints` collection with unique `_id: hash` constraint and 10-minute TTL index on `expires_at`. Uses atomic database write to detect duplicates across serverless containers with HTTP 409 Conflict.

### 1.4 Zero-Fallback Production Secret & Password Policies
* **Before:** `SAFEMAP_SECRET` fell back to a default dev string. `SAFEMAP_ADMIN_PASSWORD` logged a console warning on weak passwords.
* **After:** In production (`NODE_ENV === 'production'` or `VERCEL_ENV === 'production'`):
  - Missing or weak `SAFEMAP_SECRET` (< 32 chars) triggers `FATAL CONFIGURATION ERROR` and halts the process.
  - Missing, weak (< 16 chars), or common `SAFEMAP_ADMIN_PASSWORD` triggers `FATAL CONFIGURATION ERROR` and halts the process.

### 1.5 Server-Side Authorization Middleware
* **Before:** Some admin handlers relied on ad-hoc token verification or client-side checks.
* **After:** Centralized `requireAdminAuth` middleware applied to all `/api/admin/*` endpoints:
  - Validates 3-part HMAC SHA-256 token.
  - Constant-time signature comparison using `crypto.timingSafeEqual`.
  - Database check for token revocation.

### 1.6 Advanced Security Headers & Anti-CSRF
* Added:
  - `Cross-Origin-Opener-Policy: same-origin`
  - `Cross-Origin-Resource-Policy: same-origin`
  - Strict `Content-Security-Policy` with no `'unsafe-inline'` for `script-src`
  - Origin verification on state-changing requests (`POST`, `DELETE`, `PUT`, `PATCH`)

### 1.7 Input Validation & NoSQL Injection Protection
* Recursive operator sanitizer (`stripMongoOperators`) cleanses `req.body`, `req.query`, and `req.params`.
* Validates raw lengths before string truncation so oversized payloads trigger validation errors rather than silent truncation.

---

## 2. Frontend Security Hardening

### 2.1 Admin Portal (`public/admin.js`)
* **Before:** Dynamically constructed HTML using `privateBox.innerHTML = ...` with unescaped `report.reference_url`, vulnerable to XSS and `javascript:` URIs.
* **After:** Rewritten using safe DOM node construction:
  - `document.createElement('div')`
  - `textContent` for all citizen inputs and reporter data
  - URL protocol check (`url.protocol === 'http:' || url.protocol === 'https:'`) before creating clickable links

### 2.2 Public Application (`public/app.js`)
* Ensured error messages and news source attributions are safely assigned using `element.textContent` rather than `innerHTML`.

---

## 3. Automated Test Suite (`test/security.test.js`)

* 19 automated tests validating:
  1. Security headers & CSP strictness
  2. Anti-CSRF origin checks
  3. Production zero-fallback fail-closed process termination
  4. Timing-safe password checks
  5. Cross-instance session revocation across independent HTTP servers
  6. Distributed IP rate limiting barrier
  7. Atomic duplicate submission rejection
  8. PII sanitization in public stats and district profiles
  9. Recursive NoSQL operator stripping
