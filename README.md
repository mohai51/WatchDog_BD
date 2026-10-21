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

## Files

- `server.js` — Node.js / Express backend with MongoDB Atlas
- `package.json` — Node.js project manifest & dependencies
- `public/index.html` — UI
- `public/style.css` — responsive design
- `public/app.js` — interactions and charts
- `public/districts.geojson` — authentic 64-district boundaries
- `.env` — environment configuration (Port, Admin password, MongoDB URI)
