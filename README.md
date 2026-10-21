# 🛡️ WatchDog BD — Community-Powered Crime Reporting & Public Safety Intelligence

A modern, trustworthy, map-first public safety intelligence and crowdsourced incident reporting platform for Bangladesh.

Built with **100% Full-Stack JavaScript** (Node.js + Express.js + Vanilla JS + Leaflet.js + Chart.js + MongoDB Atlas Cloud).

- **Repository**: [https://github.com/mohai51/WatchDog_BD](https://github.com/mohai51/WatchDog_BD)
- **Live Deployment**: [https://watch-dog-bd.vercel.app/](https://watch-dog-bd.vercel.app/)
- **Design Inspiration**: Unseen Bangladesh (minimalist vector map, guided experience, side drawer)

---

## 🌟 Key Features

### 1. Map-First Geospatial Experience
- **Authentic 64-District Vector Map**: Pure GeoJSON vector boundaries with no external tile trackers, streets, or rivers.
- **Deep Linking**: Dynamic URL hash support (e.g. `#district=BD3026`) for direct district bookmarking and sharing.
- **Multi-Attribute Filtering**: Filter incidents by crime category (Extortion, Theft, Robbery, Snatching, Drug-related, Harassment, Fraud, Other), date range (7 days, 30 days, 6 months, all), division pills, and search in both Bengali and English.
- **Desktop Side Drawer & Mobile Bottom Sheet**: Slide-out drawer with district KPIs, category distribution charts, 6-month trends, verified incident feeds, and sharing actions.

### 2. Guided 3-Step Incident Reporting
- **Step 1 (Incident Info)**: Category, district, approximate locality (no personal home addresses), date & time.
- **Step 2 (Narrative & Privacy)**: Structured narrative, eyewitness/victim status, optional reference URL, and optional strictly confidential contact info.
- **Step 3 (Review & Declaration)**: Summary review, accuracy declaration, emergency 999 notice, and one-click submission.
- **Private Submitter Tracking Code**: Generates a cryptographically secure tracking reference (e.g. `WD-8F3K9A`) allowing reporters to check review status without exposing personal details.

### 3. Trust & 5-Tier Verification Taxonomy
- `community_submitted` — Awaiting moderation review.
- `moderated` — Approved for publication based on community guidelines.
- `independently_verified` — Corroborated by independent evidence or police GD records.
- `published_news_report` — Attributed to recognized national news sources with original publisher links.
- `rejected` / `withdrawn` — Removed from public view.

### 4. Public Value Modules
- **District Comparison**: Compare incident density and category breakdown between any two districts.
- **Safety Resources & Emergency Center**: 999, 109, 106, cyber crime hotlines, and GD filing instructions.
- **Transparency & Methodology**: Explains data collection limits and clarifies that map colors show report density, not definitive crime rates.
- **Bilingual (BN/EN) & Theme Switching**: Seamless toggle between Bengali/English and Dark/Light modes.

### 5. Isolated Admin Workspace (`/admin`)
- Accessible only at `/admin` (zero public navbar links).
- Secure password authentication with fail-safe production validation.
- Moderation queue with verification tier assignment, moderator audit notes, and takedown management.
- Live traffic analytics and 7-day visitor trend graph.

---

## 🔒 Security & Privacy Architecture

- **PII Scrubbing**: Reporter names and victim status are strictly scrubbed from all public APIs.
- **No Ephemeral Disk Fallback**: In production (`NODE_ENV=production` or `VERCEL=1`), local file writes are disabled to prevent silent data loss.
- **Privacy-Preserving Analytics**: Visitor IP addresses are hashed with daily salt (SHA-256) rather than stored raw.
- **Security Headers**: HSTS, X-Frame-Options: DENY, Content-Security-Policy, Referrer-Policy, and Permissions-Policy.

---

## 🚀 Local Development (Node.js 18+)

```bash
# 1. Clone repository
git clone https://github.com/mohai51/WatchDog_BD.git
cd WatchDog_BD

# 2. Install dependencies
npm install

# 3. Setup environment variables
cp .env.example .env
# Edit .env with your MongoDB Atlas URI and desired admin password

# 4. Start local development server
npm run dev
```

Open **http://localhost:8000** in your browser.  
Admin Portal is at **http://localhost:8000/admin** (Default dev password: `admin123`).

---

## 🌐 Deploy to Vercel (Production)

1. Import the repository in **[Vercel](https://vercel.com/new)**.
2. In **Settings ➜ Environment Variables**, configure:
   - `MONGODB_URI`: `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/<database>?retryWrites=true&w=majority`
   - `SAFEMAP_ADMIN_PASSWORD`: A strong, random administrator password (minimum 12 characters).
   - `SAFEMAP_SECRET`: A 64-character random hex string for signing admin JWT/tokens.
   - `NODE_ENV`: `production`
3. Click **Deploy**.
