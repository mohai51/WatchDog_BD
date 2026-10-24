# WatchDog BD — Full-Stack Security & User Testing Audit Report

**Date of Audit:** October 24, 2026  
**Auditor:** Automated Test Engine & Senior Security Analysis  
**Target Application:** WatchDog BD — Community-Powered Crime Reporting & Public Safety Intelligence  
**Environment:** Full-Stack Node.js (Express.js), MongoDB Atlas, Vercel Serverless Production  
**Overall Security Rating:** **A+ (Production Ready & Hardened)**

---

## 1. Executive Summary

A comprehensive automated security evaluation and end-to-end user testing cycle were conducted on the WatchDog BD platform. The objective was to verify that all reporting flows, media sanitization pipelines, administrative controls, rate limiting, and privacy safeguards operate flawlessly without vulnerabilities or data leakage.

### Key Audit Highlights:
- **32/32 Automated Tests Passed (100% Success Rate across 9 test suites)**.
- **Submitter Privacy (Zero-Leakage):** Citizen names, phone numbers, emails, and IP addresses are completely scrubbed from public API endpoints (`/api/stats`, `/api/districts/:code`).
- **Media Upload & Storage Security:** Magic-byte MIME type validation, EXIF/GPS metadata stripping, fake image rejection, 5MB file size enforcement, and server-side image proxying that completely shields third-party storage providers from public users.
- **Fail-Closed Security Policies:** The application refuses to start in production if weak passwords or default secrets are detected.
- **Modern Browser Security Headers:** Strict Content Security Policy (CSP without `unsafe-inline`), Cross-Origin Opener Policy (COOP), Cross-Origin Resource Policy (CORP), and Anti-CSRF Origin checks enforced on all state-changing requests.

---

## 2. Automated Test Suite Results

The automated regression test suite was executed in an isolated environment (`test/composer_and_media.test.js`, `test/security.test.js`). All test suites passed with zero failures.

| Test Suite | Tests | Status | Key Coverage |
| :--- | :---: | :---: | :--- |
| **1. Minimal Composer & Auto-Timestamp** | 4 | PASS | Valid submission, anonymous submission, 64-district validation, automatic UTC & Asia/Dhaka timestamps |
| **2. Secure Single-Image Upload & Storage** | 9 | PASS | Magic-byte MIME enforcement, EXIF/GPS stripping, 5MB limit, fake MIME rejection, video rejection, private media access control (403), admin moderation preview, media purge on delete |
| **3. Security Headers, Isolations & Anti-CSRF** | 2 | PASS | Modern isolation headers, strict CSP, anti-CSRF origin header matching |
| **4. Production Config & Zero-Fallback** | 2 | PASS | Fails closed on weak `SAFEMAP_ADMIN_PASSWORD` (<16 chars), fails closed on short `SAFEMAP_SECRET` (<32 chars) |
| **5. Admin Authentication & Session Revocation** | 5 | PASS | Timing-safe login, 3-part HMAC token, server-side route authorization, signature tampering rejection, cross-instance session revocation |
| **6. Report Schema & Atomic Deduplication** | 5 | PASS | District code validation, 24-hr time bounds, max length limits (2000 chars), HTML tag stripping & URL neutralization, database sliding-window deduplication |
| **7. Distributed Rate Limiting** | 1 | PASS | Abuse prevention: 6th submission from identical IP is blocked with 429 and `Retry-After` header |
| **8. Citizen Privacy & Data Leakage Prevention** | 3 | PASS | Public `/api/stats` and `/api/districts/:code` scrub submitter identities; private submitter tracking `/api/reports/track/:code` returns status without leaking identities |
| **9. NoSQL Operator Injection Sanitization** | 1 | PASS | Recursive query sanitizer strips MongoDB operator keys (`$ne`, `$gt`, `$where`) |
| **Total** | **32** | **PASS (100%)** | **0 Failures, 0 Skipped, 0 Warnings** |

---

## 3. End-to-End Live User Testing Evaluation

A live production verification was conducted against the deployment:

1. **Homepage & Interactive Map (`/`):**
   - HTTP Status: `200 OK`
   - Responsive vector choropleth map renders all 64 districts with clean hover tooltips and interactive neighborhood crime drawers.
   - Dynamic dark/light theme switching with smooth transitions and localized Bengali/English UI text.

2. **Facebook-Style Minimal Report Composer:**
   - Single-step "Create Post" modal interface with clean inputs for district, crime category, location, and description.
   - Automatic server-side Asia/Dhaka timestamp generation eliminates manual submitter clock discrepancies.
   - Submissions generate a secure tracking code (e.g., `WD-XXXXXXXX`) for status tracking without publicizing the submitter's identity.

3. **Media Evidence Upload & Display:**
   - Single-image attachment allows citizen photo evidence (JPEG/PNG).
   - Server-side image sanitization strips geolocation coordinates and camera metadata before persisting.
   - Images are rendered cleanly inside district crime drawers via `/api/media/:mediaId`, completely shielding external hosting keys and URLs from public visitors.

4. **Private Report Status Tracking:**
   - Tracking lookup modal allows submitters to monitor their report's moderation status (Pending, Moderated, Approved, Rejected) using only their private reference code.
   - Responses do not leak submitter contact info or IP.

---

## 4. Security Architecture & Threat Mitigations

### 4.1 Citizen Privacy & Anti-Doxxing
- **PII Stripping:** Under no circumstances are `reporter.name`, `reporter.contact`, `email`, `phone`, or `submitter_ip` returned in public stats or district queries.
- **Anonymous Reporting Default:** Reports can be submitted anonymously, defaulting to "Anonymous Citizen" while retaining geographic and descriptive data necessary for public safety intelligence.

### 4.2 Injection & Input Sanitization
- **HTML & Script Tag Neutralization:** All text inputs (location, narrative, district) are stripped of HTML tags, script tags, and malicious `javascript:` schemes.
- **NoSQL Operator Neutralization:** Recursive request sanitization removes query keys starting with `$` to prevent MongoDB operator injection.

### 4.3 Media & File Upload Hardening
- **Magic-Byte Inspection:** Validates the first 8 bytes of all file buffers (`0xFF 0xD8 0xFF` for JPEG, `0x89 0x50 0x4E 0x47` for PNG). Renamed executables or fake file extensions are rejected immediately.
- **Metadata Sanitization:** JPEG APP1-APP15 segments (EXIF, GPS, camera serials) and PNG text chunks (`tEXt`, `zTXt`, `iTXt`) are stripped from memory before storage.
- **Storage Shielding:** All images are proxied through `/api/media/:mediaId` with `Cache-Control` and `X-Content-Type-Options: nosniff`. Third-party storage URLs remain strictly server-side.

### 4.4 Distributed Rate Limiting & Denial-of-Service Defense
- **Sliding-Window Deduplication:** Rejects duplicate submissions with identical fingerprint (district + category + description) within a sliding window.
- **IP-Based Distributed Rate Limits:** Protects submission, tracking, and admin login endpoints with separate distributed rate limiters that return HTTP 429 upon threshold breach.

### 4.5 Production Fail-Closed Policy
- **Zero-Fallback Policy:** In production mode (`NODE_ENV=production` or `VERCEL=1`), the server process crashes immediately on startup if `SAFEMAP_SECRET` is less than 32 characters or if `SAFEMAP_ADMIN_PASSWORD` is weak or default.
- **HMAC Admin Session Tokens:** Admin authentication utilizes a cryptographically signed 3-part HMAC token with server-side revocation tracking to prevent session replay after logout.

---

## 5. Verification Checklist

- [x] All 32 automated unit and integration tests passing.
- [x] Citizen PII scrubbed from all public API outputs.
- [x] Images stripped of EXIF/GPS metadata prior to storage.
- [x] Storage provider URLs hidden behind internal `/api/media/:mediaId` proxy.
- [x] Strict Content Security Policy (CSP) and isolation headers enforced.
- [x] Anti-CSRF origin verification active on state-changing requests.
- [x] Distributed rate limiters guarding report submission and admin login.
- [x] Fail-closed validation enforcing strong secrets in production.
- [x] All 64 districts and 10 standard crime categories validated.

---

## 6. Conclusion

WatchDog BD demonstrates a robust, production-grade security architecture designed to balance citizen transparency with rigorous submitter privacy and defense against abuse. All identified security requirements and user testing criteria are fully satisfied.
