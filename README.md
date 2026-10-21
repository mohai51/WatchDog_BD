# Bangladesh SafeMap — 64 District MVP (100% Full-Stack JavaScript)

A working web application using the **uploaded `district.json`** as the sole geographic source. It shows Bangladesh's 64 district boundaries, with **no street, river or background map layers**.

Built with **100% Full-Stack JavaScript** (Express.js + Vanilla JS + MongoDB Atlas).

## Run (Node.js 18+)

From the `bangladesh_safemap` directory:

```bash
# 1. Install dependencies (first time only)
npm install

# 2. Start the server
npm start
```

Or for automatic reload during development:
```bash
npm run dev
```

Open **http://localhost:8000** in your browser.

- Default admin password is set in `.env` (`admin123`) or automatically generated in terminal.
- Cloud Database: Set `MONGODB_URI` in `.env` to connect directly to MongoDB Atlas Free Tier.
- Zero-config fallback: If no `MONGODB_URI` is provided, it automatically saves to local storage in `data/`.

## Included

- **100% JavaScript**: Single language across frontend and backend (Node.js + Express)
- **MongoDB Atlas Support**: Free tier cloud database integration with zero maintenance
- 64 authentic district polygons from the user-supplied GeoJSON, topology-preserving simplified for fast loading
- English/Bangla toggle, dark/light theme, responsive map and dashboard
- Clickable districts, division filter, search, reset, choropleth fill
- District-level charts using **approved incident report counts only**
- Incident submission (name optional, victim flag, type, district, date/time, location and description)
- Admin login, pending/approved/rejected moderation, review workflow
- Same-origin API, request validation, HTML-safe rendering, rate limiting
- Public API returns only aggregate data, never names or incident narratives

## 🚀 Deploy to Vercel (1-Click Deployment)

This application is ready to deploy directly on [Vercel](https://vercel.com):

1. **Push to GitHub**: Repository `https://github.com/mohai51/WatchDog_BD.git`
2. **Import in Vercel**:
   - Go to [vercel.com/new](https://vercel.com/new)
   - Select and import `WatchDog_BD`
   - Framework Preset: **Other** (Root directory: `./`)
3. **Set Environment Variables in Vercel Settings**:
   - `MONGODB_URI`: `mongodb+srv://jackknee6_db_user:LPzlditmCsfShxpX@dog.5kigqw5.mongodb.net/safemap?retryWrites=true&w=majority&appName=dog`
   - `SAFEMAP_ADMIN_PASSWORD`: Your secret admin password (e.g. `admin123`)
4. **Deploy**: Click **Deploy** and your site will be live!

---

## 📊 Analytics & Visitor Tracking

- **Public View**: Shows total website visits and today's visits directly in the top KPI stats bar.
- **Admin Workspace Analytics**:
  - Secure Moderation & Analytics Tab switcher.
  - KPI Cards: Total Visits, Today Visits, Total Reports, Pending Moderation.
  - Report Status Split: Approved vs. Rejected count.
  - **7-Day Visitor Trend Chart**: Visual bar chart rendered with Chart.js showing daily traffic over the last week.
  - Data is stored atomically in MongoDB Atlas (`analytics` and `visits` collections).

---

## Files

- `server.js` — Node.js / Express backend with MongoDB Atlas & Vercel serverless support
- `vercel.json` — Vercel serverless function routing configuration
- `package.json` — Node.js project manifest & dependencies
- `public/index.html` — UI with Public Stats & Admin Analytics dashboard
- `public/style.css` — Responsive design with tabbed admin view & analytics grid
- `public/app.js` — Interactions, visitor recording, moderation & analytics charts
- `public/districts.geojson` — authentic 64-district boundaries
- `.env.example` — environment configuration template (Port, Admin password, MongoDB URI)

