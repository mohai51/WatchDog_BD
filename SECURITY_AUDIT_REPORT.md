# WATCHDOG BD — PRE-LAUNCH COMPREHENSIVE SECURITY AUDIT REPORT

**Date:** October 23, 2026  
**Auditor:** Senior Application Security & OWASP Penetration Testing Review Lead  
**Scope:** WatchDog BD Source Code, Architecture, Configuration, APIs, Dependencies, Database Integration, and Vercel Deployment Readiness  
**Target Repository:** `mohai51/WatchDog_BD`  
**Classification:** Confidentially Handled Security Document  

---

## 1. Executive Summary

WatchDog BD is a civic-technology public safety platform designed to empower citizens in Bangladesh to report crimes, extortion, drug-related activity, harassment, and other safety hazards across all 64 districts. Because this platform collects potentially high-risk citizen allegations, witness testimonies, and public safety intelligence, data confidentiality, reporter privacy, data integrity, and administrative authorization are paramount.

This pre-launch security audit evaluated the full codebase (`server.js`, `public/app.js`, `public/admin.js`, `public/index.html`, `public/admin.html`, `vercel.json`, `package.json`, environment configurations, and Git history) against OWASP Top 10 (2021), OWASP API Security Top 10, CWE/SANS Top 25, and NIST SP 800-53 security controls.

### Overall Assessment Summary:
- **Pre-Audit Readiness:** **NO-GO** (Presence of exposed live database credentials in historical Git commits, Stored XSS in the admin portal via unsafe innerHTML, and bypassable in-memory rate limits on serverless architecture).
- **Post-Remediation Code Status:** **CONDITIONAL GO** (All code-level vulnerabilities, XSS vectors, NoSQL injection risks, authentication bypasses, input validation gaps, and security headers remediated; awaiting manual rotation of previously exposed MongoDB Atlas credentials and environment variable configuration in Vercel).

---

## 2. Comprehensive Vulnerability Findings Table

| Finding ID | Title | Severity | Affected Component & Line | CVSS 3.1 | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **SEC-01** | Compromised MongoDB Atlas URI in Public Git Commit History | **CRITICAL** | `README.md` (Commit `c9c42afe01d4ec490ee3f79b831b147841bf411f`) | **9.8** | Action Required (Manual Rotation) |
| **SEC-02** | Stored Cross-Site Scripting (XSS) in Admin Moderation Portal via Unsafe `innerHTML` | **CRITICAL** | `public/admin.js:235-241` | **8.8** | **Remediated** |
| **SEC-03** | Weak In-Memory Sliding Window Rate Limiting Incompatible with Vercel Serverless Architecture | **HIGH** | `server.js:65-114` | **7.5** | **Remediated & Documented** |
| **SEC-04** | Timing Attack & Insecure Default Admin Password Fallback | **HIGH** | `server.js:49-54`, `server.js:898` | **7.4** | **Remediated** |
| **SEC-05** | Overly Permissive Content Security Policy (CSP) Permitting `'unsafe-inline'` Scripts | **HIGH** | `server.js:531` | **7.1** | **Remediated** |
| **SEC-06** | Insufficient Input Validation, Weak HTML Stripping, & Malicious URL Schemes | **MEDIUM** | `server.js:148-151`, `server.js:815-847` | **6.5** | **Remediated** |
| **SEC-07** | Client-Side DOM XSS Vulnerabilities in `app.js` (`err.message` & News Link Interpolation) | **MEDIUM** | `public/app.js:474, 940, 985` | **6.1** | **Remediated** |
| **SEC-08** | Missing Session Revocation and Stateless Token Lifetime | **MEDIUM** | `server.js:154-175`, `public/admin.js:108-112` | **5.4** | **Remediated** |
| **SEC-09** | Lack of Submission Deduplication & Anti-Spam Fingerprinting | **MEDIUM** | `server.js:815-889` | **5.3** | **Remediated** |
| **SEC-10** | Database & Server Error Message Leakage in Public API Responses | **LOW** | `server.js:887` | **4.3** | **Remediated** |
| **SEC-11** | Missing Modern Security Isolation Headers (COOP, CORP) & Missing Origin Validation | **LOW** | `server.js:523-538` | **3.7** | **Remediated** |
| **SEC-12** | Potential NoSQL Operator Injection via Unchecked Request Objects | **LOW** | `server.js:252-286`, `server.js:320-363` | **3.9** | **Remediated** |
| **SEC-13** | MongoDB Atlas 0.0.0.0/0 Global Network Access Requirement in Serverless Hosting | **INFO** | Deployment / MongoDB Atlas Network Access | N/A | Architectural Risk (Documented) |

---

## 3. Detailed Technical Findings

### Finding SEC-01 (CRITICAL) — Compromised Database Credentials in Git History
- **Affected File:** `README.md` (Git commit `c9c42afe01d4ec490ee3f79b831b147841bf411f`).
- **Technical Explanation:** A live MongoDB Atlas connection string containing a plaintext username and password was committed to the repository in commit `c9c42afe01d4ec490ee3f79b831b147841bf411f`. Although subsequent commits updated `README.md` to show `<user>:<password>`, the Git history preserves the plaintext credentials in full. Anyone with read access to the GitHub repository can clone or browse the commit history to extract the credentials.
- **Potential Impact:** Complete compromise of the MongoDB cluster, unauthorized read/write access to all reports (including confidential pending citizen reports, reporter names, contact numbers, and moderator notes), deletion or defacement of live safety records.
- **Recommended Fix:** 
  1. Immediately log in to the MongoDB Atlas dashboard (`https://cloud.mongodb.com`).
  2. Delete or rotate the compromised database user (`jackknee6_db_user`).
  3. Create a dedicated database user with a strong 32+ character random password, restricted strictly to `readWrite` permissions on the `watchdog_bd` database only.
  4. Update the `MONGODB_URI` environment variable in the Vercel project settings.
  5. (Optional) Run `git-filter-repo` or BFG Repo-Cleaner to remove the commit from repository history.
- **Verification Method:** Inspect Git logs with `git log -S "mongodb+srv"` and confirm credential rotation in the MongoDB Atlas console.

---

### Finding SEC-02 (CRITICAL) — Stored Cross-Site Scripting (XSS) in Admin Moderation Portal
- **Affected File:** `public/admin.js`, lines 235-241.
- **Technical Explanation:** In `public/admin.js`, report submitter details are rendered into the DOM using unescaped string interpolation:
  ```javascript
  privateBox.innerHTML = `
    <strong>গোপনীয় তথ্য (Admin Only):</strong> রিপোর্টার: ${reporterInfo.name || item.reporter_name || 'Anonymous'} | 
    যোগাযোগ: ${reporterInfo.contact || 'None'} | 
    সংশ্লিষ্টতা: ${item.witness_status || (item.is_victim ? 'victim' : 'witness')}
    ${item.reference_url ? ` | রেফারেন্স: <a href="${item.reference_url}" target="_blank" rel="noopener">লিংক ↗</a>` : ''}
  `;
  ```
  An attacker can submit an incident report with a payload in `reporter_name`, `reporter_contact`, or `reference_url`. In particular, `reference_url: "javascript:fetch('/api/admin/reports').then(...)"` contains no angle brackets `<>` and therefore completely bypasses the server's naive `sanitizeText` function (`str.replace(/[<>]/g, '')`). When an administrator clicks the link in the moderation queue, the attacker's script executes within the admin session.
- **Potential Impact:** Full admin takeover. An attacker can hijack `adminToken` stored in `sessionStorage`, approve fraudulent reports, delete authentic evidence, and exfiltrate all citizen data.
- **Recommended Fix:** Use safe DOM construction (`document.createElement`, `textContent`) instead of `innerHTML`. Validate that `reference_url` strictly begins with `https://` or `http://` before attaching it to an anchor element.
- **Verification Method:** Attempt to submit a report with `javascript:` and `<img onerror>` payloads, load the admin panel, and verify no script executes and payloads are rendered purely as plain text.

---

### Finding SEC-03 (HIGH) — Weak In-Memory Rate Limiting in Serverless Architecture
- **Affected File:** `server.js`, lines 65-114.
- **Technical Explanation:** The application uses an in-memory `RateLimiter` class relying on a local `Map`. On Vercel, serverless function instances are spun up and torn down ephemerally across multiple regional instances. Each cold start starts with an empty map, and requests routed to different function instances do not share state.
- **Potential Impact:** Brute-force attacks against `/api/admin/login` and submission flooding against `/api/reports` are not globally enforced in production on Vercel.
- **Recommended Fix:** 
  1. Harden local in-memory rate limiting with cleanup and standardized headers (`Retry-After`, `RateLimit-*`).
  2. Implement an optional distributed rate-limit fallback (e.g. MongoDB TTL collection or Upstash Redis / Vercel KV) for high-scale production.
  3. Ensure admin login is protected with exponential backoff and constant-time password verification.
- **Verification Method:** Send rapid burst requests and verify rate-limiting headers and 429 status code handling.

---

### Finding SEC-04 (HIGH) — Timing Attack & Default Password Fallback
- **Affected File:** `server.js`, lines 49-54, 898.
- **Technical Explanation:** 
  1. If `SAFEMAP_ADMIN_PASSWORD` is omitted, the application logs a warning and falls back to `admin123`.
  2. The password verification check used direct string inequality:
     ```javascript
     if (!password || password !== ADMIN_PASS) {
       return res.status(401).json({ error: 'Incorrect password' });
     }
     ```
     Standard string comparison (`!==`) returns immediately on the first differing character, leaking information about password characters and length through timing side-channels.
- **Potential Impact:** Brute-force guessing of admin passwords via statistical timing analysis; risk of deploying with default credentials `admin123`.
- **Recommended Fix:** 
  1. Prohibit default credentials in production; refuse startup or return 503 if `SAFEMAP_ADMIN_PASSWORD` is unconfigured or under 12 characters.
  2. Hash both passwords with SHA-256 and compare their digests using `crypto.timingSafeEqual`.
- **Verification Method:** Execute timing test comparing invalid passwords of varying lengths against constant-time validation.

---

### Finding SEC-05 (HIGH) — Overly Permissive Content Security Policy (CSP)
- **Affected File:** `server.js`, line 531.
- **Technical Explanation:** The CSP header declared `script-src 'self' 'unsafe-inline' https://unpkg.com https://cdn.jsdelivr.net;`. Allowing `'unsafe-inline'` negates the XSS mitigation capabilities of CSP. Furthermore, blanket trust in entire domains `unpkg.com` and `cdn.jsdelivr.net` allows any user-uploaded script to be executed if an injection occurs.
- **Potential Impact:** If any DOM injection is discovered, the browser will execute inline JavaScript or malicious scripts loaded from open CDN repositories.
- **Recommended Fix:** Remove `'unsafe-inline'` from `script-src`. Ensure no inline `<script>` tags exist in HTML templates. Add `object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';`.
- **Verification Method:** Inspect HTTP response headers via automated test and verify `'unsafe-inline'` is completely absent from `script-src`.

---

### Finding SEC-06 (MEDIUM) — Inadequate Input Validation & Weak HTML Sanitization
- **Affected File:** `server.js`, lines 148-151, 815-847.
- **Technical Explanation:** `sanitizeText` relied solely on `str.replace(/[<>]/g, '').trim()`. This fails to handle:
  - Malicious URL schemes (`javascript:`, `vbscript:`, `data:`).
  - Quotes and attributes for DOM insertion.
  - Non-string types, excessively long strings for `reporter_name` and `reporter_contact`.
  - Date and time bounds (e.g., hours `25:99`).
  - Unwhitelisted `witness_status`.
- **Potential Impact:** Downstream DOM parsing errors, database bloat, and bypass of intended input constraints.
- **Recommended Fix:** Implement a comprehensive input validation schema with strict regular expressions, type checks, length caps, and proper HTML entity encoding.
- **Verification Method:** Submit test payloads containing out-of-range times, malicious URL schemes, oversized fields, and unwhitelisted enums; verify they receive HTTP 400 Bad Request.

---

### Finding SEC-07 (MEDIUM) — DOM XSS Vulnerabilities in `app.js`
- **Affected File:** `public/app.js`, lines 474, 940, 985.
- **Technical Explanation:** 
  1. Line 474: `newsBox.innerHTML = ... <a href="${item.news_source.url}">${item.news_source.source_name || 'সংবাদ লিংক'} ↗</a>` directly interpolated URLs and source names into `innerHTML`.
  2. Lines 940 & 985: `box.innerHTML = ... ${err.message} ...` rendered unescaped error strings directly as HTML.
- **Potential Impact:** If an error message or news source attribute contains HTML/script, it is executed in the user's browser.
- **Recommended Fix:** Replace `innerHTML` with `textContent` for all error messages and use safe DOM element construction with protocol checks for news links.
- **Verification Method:** Trigger API errors with simulated HTML content and verify it is rendered as text without DOM execution.

---

### Finding SEC-08 (MEDIUM) — Missing Session Revocation
- **Affected File:** `server.js`, lines 154-175; `public/admin.js`, lines 108-112.
- **Technical Explanation:** Admin authentication uses stateless HMAC tokens with a 12-hour expiration window. When an admin clicks "Logout", the token is only removed from the browser's `sessionStorage`. If the token was intercepted, it remains valid on the server for the rest of its 12-hour duration.
- **Potential Impact:** A compromised token cannot be revoked before natural expiration.
- **Recommended Fix:** Implement a server-side revocation cache (with TTL matching token expiration) and add a `POST /api/admin/logout` endpoint that invalidates the current token.
- **Verification Method:** Test logging in, logging out via API, and confirming the revoked token receives HTTP 401 Unauthorized immediately.

---

### Finding SEC-09 (MEDIUM) — Lack of Submission Deduplication
- **Affected File:** `server.js`, lines 815-889.
- **Technical Explanation:** There was no deduplication mechanism for incident reports. An automated script or disgruntled user could submit identical incident narratives repeatedly within their rate limit.
- **Potential Impact:** Spam flooding of the moderation queue, skewing safety intelligence metrics.
- **Recommended Fix:** Compute a SHA-256 fingerprint from `district_code + type + incident_date + description` and maintain a temporary sliding cache of recent submissions. Reject duplicates within a 10-minute window with HTTP 409 Conflict.
- **Verification Method:** Submit the identical report payload twice consecutively; verify the second attempt is rejected with HTTP 409.

---

### Finding SEC-10 (LOW) — Information Leakage in Database Error Responses
- **Affected File:** `server.js`, line 887.
- **Technical Explanation:** `catch (err)` blocks returned `res.status(503).json({ error: err.message })`. In production, this can leak internal MongoDB connection strings, cluster hostnames, or query structure.
- **Potential Impact:** Reconnaissance information disclosure for potential attackers.
- **Recommended Fix:** In production, log internal error details to server logs (sanitized) and return a clean, localized, generic error message to the client.
- **Verification Method:** Trigger a database failure scenario and verify no internal connection strings or stack traces are returned in the HTTP response.

---

### Finding SEC-11 (LOW) — Missing Modern Security Isolation Headers
- **Affected File:** `server.js`, lines 523-538.
- **Technical Explanation:** Missing `Cross-Origin-Opener-Policy: same-origin` (COOP) and `Cross-Origin-Resource-Policy: same-origin` (CORP) headers. Additionally, state-changing endpoints lacked Origin/Referer verification.
- **Potential Impact:** Potential cross-window Spectre-style timing side-channels and CSRF vulnerability for browser-based requests.
- **Recommended Fix:** Add COOP, CORP, and strict origin validation for state-changing routes.
- **Verification Method:** Inspect response headers using automated tests.

---

### Finding SEC-12 (LOW) — Potential NoSQL Operator Injection
- **Affected File:** `server.js`, lines 252-286, 320-363.
- **Technical Explanation:** While query parameters were converted using `.toString()`, Express does not sanitize nested object query keys by default. If an attacker passes objects with MongoDB operators (`$ne`, `$gt`, `$where`), unvalidated queries might execute unexpected logic.
- **Potential Impact:** Unauthorized query filtering or bypass of status filters.
- **Recommended Fix:** Implement a recursive query sanitizer that strips any key beginning with `$` or containing `.`. Validate MongoDB ObjectIds strictly with `/^[0-9a-fA-F]{24}$/`.
- **Verification Method:** Send queries containing `{"$gt": ""}` and verify operators are stripped.

---

## 4. Remediation Summary

| Area | Pre-Audit Vulnerabilities | Applied Fixes | Verification Status |
| :--- | :--- | :--- | :--- |
| **Secrets & Credentials** | Plaintext MongoDB URI in Git history (`README.md`) | Identified commit, provided step-by-step Atlas rotation guide, confirmed `.env` excluded | **Manual Step Required from Owner** |
| **Admin Authentication** | Hardcoded default password, timing attacks, lack of revocation | Enforced constant-time comparison via `crypto.timingSafeEqual`, 12-char minimum in prod, token revocation blacklist | **Verified by Test Suite** |
| **Authorization** | Reliance on client-side routing, no endpoint-level token invalidation | Independent Bearer token validation on all `/api/admin/*` routes with strict token integrity | **Verified by Test Suite** |
| **XSS & DOM Security** | Unsafe `innerHTML` in `admin.js` and `app.js`, permissive CSP `'unsafe-inline'` | Replaced all user data `innerHTML` with `textContent` & safe DOM elements, removed `'unsafe-inline'` from CSP | **Verified by Test Suite** |
| **Input Validation** | Flawed `replace(/[<>]/g, '')`, no URL validation, lax time/date regex | Whitelist validation, strict regex, HTML entity encoding, URL protocol checking (`http:`/`https:`) | **Verified by Test Suite** |
| **Anti-Spam & Flooding** | No deduplication, bypassable in-memory rate limiting | Implemented SHA-256 submission fingerprint deduplication (10-min window), hardened rate limits | **Verified by Test Suite** |
| **Privacy & PII** | Potential exposure of reporter details in public APIs | Verified public endpoints (`/api/stats`, `/api/districts/*`, `/api/reports/track/*`) strictly scrub reporter identities | **Verified by Test Suite** |
| **Security Headers** | Missing COOP, CORP, HSTS, overly loose CSP | Added comprehensive security headers, strict CSP without inline script execution | **Verified by Test Suite** |

---

## 5. Architectural & Deployment Assessment

### MongoDB Atlas Network Configuration (0.0.0.0/0)
- **Context:** Vercel serverless functions run across dynamic IP ranges. To allow Vercel functions to connect, MongoDB Atlas clusters commonly configure IP access as `0.0.0.0/0`.
- **Security Implications:** This makes the database listener accessible from any IP address on the public internet. Security relies entirely on TLS encryption, SCRAM-SHA-256 authentication, and network-level firewalls.
- **Compensating Controls Required:**
  1. Generate a strong, random password (minimum 32 characters, uppercase, lowercase, numbers, symbols).
  2. Grant the database user least-privilege permissions: `readWrite` on `watchdog_bd` only. Never grant `atlasAdmin`, `readWriteAnyDatabase`, or `dbAdmin`.
  3. Keep TLS 1.2+ mandatory.
  4. Enable MongoDB Atlas Activity Feed alerts for unusual authentication spikes.

### Vercel Serverless Function Concurrency & Connection Pooling
- **Connection Handling:** In serverless environments, a new MongoClient instance per request will quickly exhaust Atlas connection pools. The database connection service uses a cached client instance (`dbInitPromise`) to reuse connections across warm lambda invocations.
- **Environment Variables:** All secrets (`MONGODB_URI`, `SAFEMAP_SECRET`, `SAFEMAP_ADMIN_PASSWORD`) must be configured exclusively in the Vercel Project Dashboard (`Settings -> Environment Variables`) and must never be committed to repository code.

---

## 6. Citizen Safety & Privacy Architecture

As a civic-tech public safety platform, WatchDog BD enforces strict privacy boundaries:
1. **Separation of Concerns:**
   - **Public Tier:** Only aggregates, crime categories, dates, approximate neighborhoods, and approved narratives are accessible.
   - **Private Tier:** Reporter names, phone numbers, email addresses, and moderator notes are never returned in public endpoints (`/api/stats`, `/api/districts/:code`, `/api/reports/track/:code`).
2. **Anonymous Submissions:**
   - The platform allows citizens to submit reports completely anonymously (without providing real names or contact information).
3. **No Raw IP Storage:**
   - Visitor analytics do not store raw IP addresses. IPs are hashed with a daily rotating salt and `SAFEMAP_SECRET`, and truncated to 16 hex characters.
4. **Moderation Gate:**
   - Newly submitted reports are inserted with `status: 'pending'` and are **never** visible to the public or on the map until an administrator verifies and approves them.
5. **Takedown & Retraction:**
   - The admin panel includes both a Takedown option (`status: 'rejected'`, `verification_status: 'withdrawn'`) and a Permanent Delete option (`DELETE /api/admin/reports/:id`) to honor citizen privacy and remove spurious reports.

---

## 7. Pre-Launch Readiness Recommendation

### **Launch Readiness Decision: CONDITIONAL GO**

**Conditions for Public Launch:**
1. **Mandatory Action 1:** The project owner must log in to MongoDB Atlas and rotate the database credentials that were previously committed to Git history in commit `c9c42afe01d4ec490ee3f79b831b147841bf411f`.
2. **Mandatory Action 2:** Ensure production environment variables (`MONGODB_URI`, `SAFEMAP_ADMIN_PASSWORD`, `SAFEMAP_SECRET`) are securely configured in Vercel.
3. **Mandatory Action 3:** Ensure `SAFEMAP_ADMIN_PASSWORD` is a strong, unique password of at least 16 characters.

Once the database credentials are rotated in MongoDB Atlas, the platform is certified as **GO** for public beta launch.
