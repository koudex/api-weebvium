# Anime API - Serverless Ready

A comprehensive Anime API that aggregates data from **AniWatch/HiAnime**, **GogoAnime/Anitaku**, and **KickAssAnime**. Built for serverless deployment with one-click support for **Vercel** and **Netlify**.

---

## One-Click Deploy

### Deploy to Vercel (Recommended)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/koudex/api-weebvium.git)

**Steps:**
1. Click the deploy button above
2. Connect your GitHub account (if not already)
3. Click **Deploy** - Done!

### Deploy to Netlify

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/koudex/api-weebvium.git)

**Steps:**
1. Click the deploy button above
2. Connect your GitHub account (if not already)
3. Click **Deploy site** - Done!

---

## Project Structure

```
anime-api/
├── server.js              # Main Express app (serverless-ready)
├── aniwatch.js            # AniWatch/HiAnime service module
├── gogoanime.js           # GogoAnime/Anitaku service module
├── kickassanime.js        # KickAssAnime service module
├── package.json           # Dependencies and scripts
├── vercel.json            # Vercel deployment configuration
├── netlify.toml           # Netlify deployment configuration
├── api/
│   └── index.js           # Vercel serverless entry point
└── netlify/
    └── functions/
        └── api.js         # Netlify serverless entry point
```

---

## Local Development

### Prerequisites
- Node.js 18 or higher
- npm, yarn, or pnpm

### Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start the server
npm start

# Server runs at http://localhost:3001
```

### Development Mode (Auto-reload)

```bash
npm run dev
```

### Test with Platform CLI

```bash
# Test Vercel locally
npm run vercel-dev

# Test Netlify locally
npm run netlify-dev
```

---

## Manual Deployment

### Vercel (via CLI)

```bash
# Install Vercel CLI globally
npm install -g vercel

# Login to your Vercel account
vercel login

# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

### Netlify (via CLI)

```bash
# Install Netlify CLI globally
npm install -g netlify-cli

# Login to your Netlify account
netlify login

# Initialize and link to a site
netlify init

# Deploy to preview
netlify deploy

# Deploy to production
netlify deploy --prod
```

### Vercel (via Dashboard)

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your Git repository
3. Framework Preset: **Other**
4. Click **Deploy**

### Netlify (via Dashboard)

1. Go to [app.netlify.com](https://app.netlify.com)
2. Click **Add new site** > **Import an existing project**
3. Connect your Git repository
4. Build command: `npm install`
5. Click **Deploy site**

---

## API Documentation

Once deployed, visit `/docs` for interactive API documentation with examples.

### Utility Endpoints

| Endpoint | Description |
|----------|-------------|
| `/` | API info and available endpoints |
| `/docs` | Interactive HTML documentation |
| `/docs/json` | JSON documentation |
| `/health` | Health check and server status |

---

## API Endpoints

### AniWatch / HiAnime

**Base:** `/api/aniwatch` (aliases: `/api/hianime`, `/api/zoro`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Home page (spotlight, trending, latest) |
| GET | `/search?keyword=<query>&page=1` | Search anime |
| GET | `/anime/:id` | Anime details |
| GET | `/episodes/:id` | Episode list |
| GET | `/servers?id=<episodeId>` | Available servers |
| GET | `/episode-srcs?id=<epId>&server=vidstreaming&category=sub` | Streaming sources |
| GET | `/az-list?page=1` | Alphabetical listing |
| GET | `/:category?page=1` | Category (top-airing, movie, etc.) |

### GogoAnime / Anitaku

**Base:** `/api/gogoanime` (alias: `/api/anitaku`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/home` | Home page data |
| GET | `/search?keyword=<query>&page=1` | Search anime |
| GET | `/anime/:id` | Anime details |
| GET | `/episodes/:id` | Episode list |
| GET | `/recent-releases?page=1` | Recent episodes |
| GET | `/new-seasons?page=1` | New season anime |
| GET | `/popular?page=1` | Popular anime |
| GET | `/completed?page=1` | Completed anime |
| GET | `/anime-movies?page=1` | Anime movies |
| GET | `/top-airing?page=1` | Top airing |

### KickAssAnime

**Base:** `/api/kickassanime`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/search?keyword=<query>&page=1` | Search anime |
| GET | `/anime/:id` | Anime details with episodes |
| GET | `/recent?page=1` | Recent updates |
| GET | `/servers/<anime>/<episode>/<slug>` | Episode servers |

---

## Response Format

### Success
```json
{
  "success": true,
  "timestamp": "2024-01-01T00:00:00.000Z",
  "data": { ... }
}
```

### Error
```json
{
  "success": false,
  "timestamp": "2024-01-01T00:00:00.000Z",
  "error": {
    "message": "Description",
    "code": "ERROR_CODE",
    "status": 400
  }
}
```

---

## Configuration Files

### vercel.json
- Routes all requests to serverless function
- Configures CORS headers
- Sets 5-minute edge caching
- Allocates 1024MB memory, 30s timeout

### netlify.toml
- Configures function bundling (esbuild)
- Sets up URL redirects
- Configures CORS headers
- Sets cache control

---

## Features

| Feature | Description |
|---------|-------------|
| Serverless | Works on Vercel, Netlify, AWS Lambda |
| Caching | In-memory + edge caching |
| Rate Limiting | 100 req/hour (local only) |
| CORS | Enabled for all origins |
| Documentation | Auto-generated at `/docs` |
| Error Handling | Standardized error responses |
| Health Check | `/health` endpoint |

---

## Environment Variables

**None required!** The API works out of the box.

Optional:
- `PORT` - Local server port (default: 3001)

---

## Troubleshooting

### Vercel Issues
- Ensure Node.js 18+ in project settings
- Check `"type": "module"` in package.json
- Verify `api/index.js` exists

### Netlify Issues
- Build command should be `npm install`
- Ensure `netlify/functions/api.js` exists
- Check function logs in dashboard

### CORS Errors
- Headers are pre-configured
- No additional setup needed

### Timeouts
- Increase function timeout in platform settings
- First request may be slow (cold start)

---

## Tech Stack

- **Runtime:** Node.js 18+
- **Framework:** Express.js
- **Scraping:** Cheerio, Axios
- **Caching:** node-cache
- **Serverless:** serverless-http

---

## License

MIT License - Free for personal and commercial use.
