# WatchDog BD — Community-Powered Crime Reporting & Public Safety Intelligence

A full-stack, privacy-centric public safety intelligence platform designed for Bangladesh. WatchDog BD empowers citizens to report localized incidents safely, anonymously, and instantly, while providing an interactive, data-driven map visualization across all 64 districts of Bangladesh.

---

## 🌟 Overview & Features

- **Interactive 64-District Choropleth Map:** Visualizes crime frequency, density, and category breakdowns across all divisions and districts of Bangladesh using Leaflet.js vector layers.
- **Minimal "Create Post" Report Composer:** A streamlined, Facebook-style single-step modal allowing citizens to report incidents quickly without navigating cumbersome multi-step wizards.
- **Automatic Asia/Dhaka Timestamps:** Automatically records server-side timestamps in both UTC and Asia/Dhaka timezone (`YYYY-MM-DD HH:mm:ss`), eliminating submitter device clock inaccuracies.
- **Secure Single-Image Evidence Upload:**
  - Enforces strict magic-byte MIME type validation (JPEG/PNG only; rejects fake extensions and videos).
  - Automatically strips EXIF, GPS coordinates, and camera metadata in memory before persistence.
  - Enforces a 5 MB maximum file size limit.
  - Server-side image proxying (`/api/media/:mediaId`) ensures external cloud storage endpoints and keys remain strictly confidential.
- **Submitter Privacy & Zero-Leakage Architecture:** Under no circumstances are reporter identities, contact details, emails, or IP addresses returned to public visitors.
- **Anonymous Reporting by Default:** Allows citizens to report safely as "Anonymous Citizen" without fear of reprisal.
- **Private Submitter Status Tracking:** Generates a unique tracking reference (e.g., `WD-XXXXXXXX`) so submitters can privately check moderation progress without publicizing their identity.
- **Administrative Moderation Dashboard:** Authenticated admin portal (`/admin`) with HMAC token security, session revocation, and moderation actions (Approve, Reject, Delete).
- **Hardened Production Security:** Modern Content Security Policy (CSP), isolation headers (COOP, CORP), anti-CSRF origin verification, NoSQL query sanitization, and distributed sliding-window rate limiting.

---

## 🏗️ System Architecture

```
[ Citizen Browser / Client ]
            │
            ├─► GET  / (Interactive Map & Public Statistics)
            ├─► POST /api/reports (Minimal Facebook-Style Composer + Evidence Photo)
            ├─► GET  /api/reports/track/:code (Private Status Lookup)
            └─► GET  /api/media/:mediaId (Internal Image Proxy)
                        │
                        ▼
      [ Express.js Backend Application Engine ]
      ├── Security Headers & Anti-CSRF Origin Guard
      ├── Recursive NoSQL Query Sanitizer
      ├── Distributed Sliding-Window Rate Limiters
      ├── Magic-Byte Validator & EXIF/GPS Metadata Stripper
      └── Automatic Asia/Dhaka Timestamp Engine
                        │
            ┌───────────┴───────────┐
            ▼                       ▼
  [ MongoDB Atlas / DB ]    [ Object Storage / ImgBB ]
  (Reports, Visits, TTL)    (Sanitized Evidence Photos)
```

---

## 🔄 How the Reporting Workflow Works

1. **Submission:**
   - The user opens the composer modal and selects their district, crime category, location/area, and description.
   - Optionally, an evidence photo (JPEG or PNG) can be attached.
2. **Sanitization & Processing:**
   - The server validates the district against the official 64-district GeoJSON dictionary.
   - Text fields are stripped of HTML tags, script elements, and dangerous schemes.
   - If a photo is attached, magic bytes are inspected to verify authenticity, and all EXIF/GPS tags are stripped from memory.
   - Server-side UTC and Asia/Dhaka timestamps are generated automatically.
3. **Storage & Confirmation:**
   - The report is saved with status `pending`.
   - A unique private tracking code (`WD-XXXXXXXX`) is returned to the submitter.
   - The photo is assigned an internal media ID (`m_<hex32>`) and served strictly through `/api/media/:mediaId`.
4. **Moderation & Public Display:**
   - Administrators review reports in the secure admin portal.
   - Once approved, the incident appears on the interactive map and inside the district intelligence drawer.

---

## 🛡️ Security & Privacy Model

- **No Public PII Exposure:** Endpoints `/api/stats` and `/api/districts/:code` return scrubbed incident summaries. Submitter names, contacts, and IP addresses are completely excluded.
- **Anti-Spam & Deduplication:** Submissions with identical fingerprints (district + category + description) within a sliding time window are automatically rejected.
- **Distributed Rate Limiting:** Report submission, tracking lookup, and admin login endpoints are protected by IP-based rate limiters returning HTTP 429 when thresholds are exceeded.
- **Fail-Closed Configuration Policy:** In production environments, the application strictly refuses to start if admin passwords are weak or if secret keys are under 32 characters.
- **Timing-Safe Admin Login:** Password verification utilizes constant-time cryptographic comparisons to prevent timing attacks.

---

## ⚙️ Environment Configuration

Create a `.env` file in the project root. **Never commit actual production passwords or secret keys to version control.**

```bash
# Server Environment ('development' or 'production')
NODE_ENV=development
PORT=8000

# Security Secret (Must be at least 32 characters in production)
SAFEMAP_SECRET=your_long_random_cryptographic_secret_key_here_32chars

# Admin Portal Password (Must be at least 16 characters in production)
SAFEMAP_ADMIN_PASSWORD=your_strong_admin_password_here

# MongoDB Atlas Connection URI
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.example.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB_NAME=safemap

# Image Storage Provider API Key (ImgBB)
IMGBB_API_KEY=your_imgbb_api_key_here
```

---

## 🚀 Running Locally

### Prerequisites
- Node.js (v18.x, v20.x, or v22.x LTS)
- npm (v9.x or later)

### Installation
```bash
# Clone the repository
git clone https://github.com/mohai51/WatchDog_BD.git
cd WatchDog_BD

# Install dependencies
npm install

# Start development server
npm run dev
# or
node server.js
```

The application will be accessible at:
- **Public Map & Portal:** `http://localhost:8000/`
- **Admin Portal:** `http://localhost:8000/admin`

---

## 🧪 Running the Automated Test Suite

WatchDog BD includes a comprehensive automated test suite covering composer workflows, single-image uploads, EXIF stripping, PII privacy defense, rate limiting, and NoSQL injection mitigation.

```bash
# Run all automated security and composer test suites
npm test
# or directly via node test runner:
node --test test/composer_and_media.test.js test/security.test.js
```

---

## 📂 Project Structure

```
├── data/                       # Local fallback data store (development only)
├── public/                     # Static frontend assets
│   ├── app.js                  # Frontend client application logic
│   ├── style.css               # Design system & responsive layout styles
│   ├── index.html              # Interactive map centerpiece & report composer
│   ├── admin.html              # Authenticated admin moderation portal
│   ├── districts.geojson       # Official 64-district vector boundary definitions
│   └── logo.png                # Brand identity shield emblem
├── test/                       # Automated test suites
│   ├── composer_and_media.test.js # Composer, image validation & storage tests
│   └── security.test.js        # Security headers, CSRF, auth & privacy tests
├── mediaStorage.js             # Media sanitization, EXIF stripping & storage service
├── server.js                   # Express.js backend API & serverless handler
├── vercel.json                 # Vercel serverless deployment routing config
├── SECURITY_AUDIT_REPORT.md    # Full-stack security audit & verification report
└── README.md                   # System documentation & developer guide
```

---

## ⚖️ License & Public Safety Mission

WatchDog BD is built for public safety transparency and citizen awareness in Bangladesh. Information submitted is moderated to prevent misinformation and hate speech while ensuring maximum submitter protection.
