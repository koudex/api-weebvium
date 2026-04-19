/**
 * Anime API - Consolidated Server
 * Serverless-ready for Vercel and Netlify
 * One-click deployment supported
 */

import express from "express";
import serverless from "serverless-http";
import rateLimit from "express-rate-limit";
import NodeCache from "node-cache";

// ==================== CONFIGURATION ====================

const PORT = process.env.PORT ?? 3001;
const IS_SERVERLESS = process.env.VERCEL || process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME;

const headers = {
  USER_AGENT_HEADER: "Mozilla/5.0 (X11; Linux x86_64; rv:122.0) Gecko/20100101 Firefox/122.0",
  ACCEPT_ENCODEING_HEADER: "gzip, deflate, br",
  ACCEPT_HEADER: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"
};

const websites_collection = {
  AniWatch: {
    BASE: "https://aniwatchtv.to",
    CLONES: {
      HiAnime: [
        "https://hianimez.is",
        "https://hianimez.to",
        "https://hianime.nz",
        "https://hianime.bz",
        "https://hianime.pe",
      ],
    },
  },
  GogoAnime: {
    BASE: "https://ww24.gogoanimes.fi",
  },
  KickAssAnime: {
    BASE: "https://kickass-anime.ro",
  },
};

// ==================== UTILITIES ====================

const isSiteReachable = async (url) => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(url, { 
      method: 'HEAD',
      signal: controller.signal 
    });
    clearTimeout(timeout);
    return response.ok;
  } catch (error) {
    return false;
  }
};

// ==================== CACHE MIDDLEWARE ====================

class AdvancedCache {
  constructor(options) {
    this.cache = new NodeCache({
      stdTTL: options.defaultTTL,
      checkperiod: options.checkPeriod || 600,
      maxKeys: options.maxKeys || -1,
    });

    this.defaultConfig = {
      duration: options.defaultTTL,
      keyParams: [],
      ignoreParams: [],
      varyByHeaders: [],
    };
  }

  generateCacheKey(req, config) {
    if (config.customKeyGenerator) {
      return config.customKeyGenerator(req);
    }

    const components = [req.method, req.path];
    const queryParams = {};
    
    if (req.query) {
      Object.keys(req.query).forEach((key) => {
        if (
          (!config.keyParams?.length || config.keyParams.includes(key)) &&
          !config.ignoreParams?.includes(key)
        ) {
          queryParams[key] = req.query[key];
        }
      });
    }

    components.push(JSON.stringify(queryParams));
    return components.join("|");
  }

  middleware(config = {}) {
    const finalConfig = { ...this.defaultConfig, ...config };

    return (req, res, next) => {
      if (req.method !== "GET" && !config?.customKeyGenerator) {
        return next();
      }

      const cacheKey = this.generateCacheKey(req, finalConfig);
      const cachedResponse = this.cache.get(cacheKey);

      if (cachedResponse) {
        return res.json(cachedResponse);
      }

      const originalJson = res.json.bind(res);
      res.json = (body) => {
        this.cache.set(cacheKey, body, finalConfig.duration);
        return originalJson(body);
      };

      next();
    };
  }

  clearCache(pattern) {
    if (!pattern) {
      this.cache.flushAll();
      return;
    }

    const keys = this.cache.keys();
    keys.forEach((key) => {
      if (pattern.test(key)) {
        this.cache.del(key);
      }
    });
  }
}

const cacheManager = new AdvancedCache({
  defaultTTL: IS_SERVERLESS ? 300 : 3600 * 24, // Shorter TTL for serverless
  checkPeriod: 600,
  maxKeys: 500,
});

// ==================== RATE LIMITER ====================

const limiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 100,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: () => IS_SERVERLESS, // Skip in serverless (handled by platform)
  message: {
    success: false,
    error: "Too many requests from this IP, please try again after 1 hour"
  }
});

// ==================== STANDARDIZED RESPONSE ====================

const createResponse = (success, data = null, error = null, meta = {}) => {
  const response = {
    success,
    timestamp: new Date().toISOString(),
  };

  if (success && data !== null) {
    response.data = data;
  }

  if (!success && error) {
    response.error = {
      message: error.message || error,
      code: error.code || 'UNKNOWN_ERROR',
      status: error.status || 500
    };
  }

  if (Object.keys(meta).length > 0) {
    response.meta = meta;
  }

  return response;
};

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((error) => {
    const statusCode = error.status || error.statusCode || 500;
    res.status(statusCode).json(
      createResponse(false, null, {
        message: error.message || 'Internal Server Error',
        code: error.code || 'INTERNAL_ERROR',
        status: statusCode
      })
    );
  });
};

// ==================== IMPORT SERVICE MODULES ====================

import { createAniwatchRouter } from './aniwatch.js';
import { createGogoanimeRouter } from './gogoanime.js';
import { createKickassanimeRouter } from './kickassanime.js';

// ==================== DOCUMENTATION ====================

const API_DOCS = {
  title: "Anime API Documentation",
  version: "2.0.0",
  description: "A comprehensive API for fetching anime data from multiple sources. Serverless-ready for Vercel and Netlify.",
  baseUrl: "/api",
  deployment: {
    vercel: "One-click deploy with vercel.json included",
    netlify: "One-click deploy with netlify.toml included",
    local: "Run with 'npm start' or 'node server.js'"
  },
  services: {
    aniwatch: {
      name: "AniWatch / HiAnime",
      baseRoute: "/api/aniwatch",
      aliases: ["/api/hianime", "/api/zoro"],
      endpoints: [
        { method: "GET", path: "/", description: "Get home page data including spotlight, trending, latest episodes, and more", parameters: [], example: "/api/aniwatch/" },
        { method: "GET", path: "/search", description: "Search for anime", parameters: [{ name: "keyword", type: "string", required: true, description: "Search query" }, { name: "page", type: "number", required: false, default: 1, description: "Page number" }], example: "/api/aniwatch/search?keyword=naruto&page=1" },
        { method: "GET", path: "/anime/:id", description: "Get detailed information about a specific anime", parameters: [{ name: "id", type: "string", required: true, description: "Anime ID/slug" }], example: "/api/aniwatch/anime/one-piece-100" },
        { method: "GET", path: "/episodes/:id", description: "Get episode list for an anime", parameters: [{ name: "id", type: "string", required: true, description: "Anime ID" }], example: "/api/aniwatch/episodes/one-piece-100" },
        { method: "GET", path: "/servers", description: "Get available servers for an episode", parameters: [{ name: "id", type: "string", required: true, description: "Episode ID" }], example: "/api/aniwatch/servers?id=one-piece-100?ep=12345" },
        { method: "GET", path: "/episode-srcs", description: "Get streaming sources for an episode", parameters: [{ name: "id", type: "string", required: true, description: "Episode ID" }, { name: "server", type: "string", required: false, default: "vidstreaming", description: "Server name" }, { name: "category", type: "string", required: false, default: "sub", description: "sub, dub, or raw" }], example: "/api/aniwatch/episode-srcs?id=one-piece-100?ep=12345&server=vidstreaming&category=sub" },
        { method: "GET", path: "/az-list", description: "Get anime listed alphabetically", parameters: [{ name: "page", type: "number", required: false, default: 1, description: "Page number" }], example: "/api/aniwatch/az-list?page=1" },
        { method: "GET", path: "/:category", description: "Get anime by category", parameters: [{ name: "category", type: "string", required: true, description: "Category name" }, { name: "page", type: "number", required: false, default: 1, description: "Page number" }], example: "/api/aniwatch/top-airing?page=1" }
      ]
    },
    gogoanime: {
      name: "GogoAnime / Anitaku",
      baseRoute: "/api/gogoanime",
      aliases: ["/api/anitaku"],
      endpoints: [
        { method: "GET", path: "/home", description: "Get home page data", parameters: [], example: "/api/gogoanime/home" },
        { method: "GET", path: "/search", description: "Search for anime", parameters: [{ name: "keyword", type: "string", required: true, description: "Search query" }, { name: "page", type: "number", required: false, default: 1, description: "Page number" }], example: "/api/gogoanime/search?keyword=naruto&page=1" },
        { method: "GET", path: "/anime/:id", description: "Get detailed information about a specific anime", parameters: [{ name: "id", type: "string", required: true, description: "Anime ID" }], example: "/api/gogoanime/anime/one-piece" },
        { method: "GET", path: "/episodes/:id", description: "Get episode list for an anime", parameters: [{ name: "id", type: "string", required: true, description: "Anime internal ID" }], example: "/api/gogoanime/episodes/21" },
        { method: "GET", path: "/recent-releases", description: "Get recently released episodes", parameters: [{ name: "page", type: "number", required: false, default: 1, description: "Page number" }], example: "/api/gogoanime/recent-releases?page=1" },
        { method: "GET", path: "/new-seasons", description: "Get new season anime", parameters: [{ name: "page", type: "number", required: false, default: 1, description: "Page number" }], example: "/api/gogoanime/new-seasons?page=1" },
        { method: "GET", path: "/popular", description: "Get popular anime", parameters: [{ name: "page", type: "number", required: false, default: 1, description: "Page number" }], example: "/api/gogoanime/popular?page=1" },
        { method: "GET", path: "/completed", description: "Get completed anime", parameters: [{ name: "page", type: "number", required: false, default: 1, description: "Page number" }], example: "/api/gogoanime/completed?page=1" },
        { method: "GET", path: "/anime-movies", description: "Get anime movies", parameters: [{ name: "page", type: "number", required: false, default: 1, description: "Page number" }], example: "/api/gogoanime/anime-movies?page=1" },
        { method: "GET", path: "/top-airing", description: "Get top airing anime", parameters: [{ name: "page", type: "number", required: false, default: 1, description: "Page number" }], example: "/api/gogoanime/top-airing?page=1" }
      ]
    },
    kickassanime: {
      name: "KickAssAnime",
      baseRoute: "/api/kickassanime",
      endpoints: [
        { method: "GET", path: "/search", description: "Search for anime", parameters: [{ name: "keyword", type: "string", required: true, description: "Search query" }, { name: "page", type: "number", required: false, default: 1, description: "Page number" }], example: "/api/kickassanime/search?keyword=naruto&page=1" },
        { method: "GET", path: "/anime/:id", description: "Get detailed information about a specific anime", parameters: [{ name: "id", type: "string", required: true, description: "Anime slug" }], example: "/api/kickassanime/anime/one-piece" },
        { method: "GET", path: "/recent", description: "Get recently updated anime", parameters: [{ name: "page", type: "number", required: false, default: 1, description: "Page number" }], example: "/api/kickassanime/recent?page=1" },
        { method: "GET", path: "/servers/*", description: "Get streaming servers for an episode", parameters: [{ name: "*", type: "string", required: true, description: "Episode path" }], example: "/api/kickassanime/servers/one-piece/episode/ep-1-abcd" }
      ]
    }
  },
  commonResponses: {
    success: { description: "Successful response", example: { success: true, timestamp: "2024-01-01T00:00:00.000Z", data: "..." } },
    error: { description: "Error response", example: { success: false, timestamp: "2024-01-01T00:00:00.000Z", error: { message: "Error description", code: "ERROR_CODE", status: 500 } } }
  }
};

const generateDocsHTML = () => {
  const endpointRows = (endpoints, baseRoute) => endpoints.map(ep => `
    <tr>
      <td><span class="method method-${ep.method.toLowerCase()}">${ep.method}</span></td>
      <td><code>${baseRoute}${ep.path}</code></td>
      <td>${ep.description}</td>
      <td>${ep.parameters.length > 0 ? `<ul class="params-list">${ep.parameters.map(p => `<li><code>${p.name}</code> (${p.type})${p.required ? ' <span class="required">*</span>' : ''}${p.default !== undefined ? ` - default: ${p.default}` : ''}<br><small>${p.description}</small></li>`).join('')}</ul>` : '<em>None</em>'}</td>
      <td><code class="example">${ep.example}</code></td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${API_DOCS.title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; line-height: 1.6; color: #333; background: #0f0f0f; }
    .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
    header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); color: white; padding: 60px 20px; text-align: center; margin-bottom: 30px; border-radius: 16px; border: 1px solid #333; }
    header h1 { font-size: 2.8rem; margin-bottom: 15px; background: linear-gradient(90deg, #00d9ff, #00ff88); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
    header p { opacity: 0.9; font-size: 1.2rem; max-width: 600px; margin: 0 auto; }
    .version { background: rgba(0,217,255,0.2); border: 1px solid #00d9ff; padding: 8px 20px; border-radius: 25px; display: inline-block; margin-top: 20px; color: #00d9ff; font-weight: 600; }
    .deploy-badges { margin-top: 25px; display: flex; gap: 15px; justify-content: center; flex-wrap: wrap; }
    .deploy-badge { background: #1a1a1a; border: 1px solid #333; padding: 10px 20px; border-radius: 8px; color: #fff; text-decoration: none; display: flex; align-items: center; gap: 8px; transition: all 0.3s ease; }
    .deploy-badge:hover { border-color: #00d9ff; background: #222; }
    .deploy-badge svg { width: 20px; height: 20px; }
    .service { background: #1a1a1a; border: 1px solid #333; border-radius: 16px; padding: 30px; margin-bottom: 25px; }
    .service h2 { color: #00d9ff; margin-bottom: 15px; display: flex; align-items: center; gap: 12px; font-size: 1.5rem; }
    .service-badge { background: linear-gradient(90deg, #00d9ff, #00ff88); color: #0f0f0f; padding: 5px 15px; border-radius: 20px; font-size: 0.75rem; font-weight: 700; }
    .aliases { color: #888; font-size: 0.9rem; margin-bottom: 20px; }
    .aliases code { background: #2a2a2a; padding: 3px 8px; border-radius: 4px; color: #00ff88; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
    th, td { padding: 15px; text-align: left; border-bottom: 1px solid #333; }
    th { background: #222; font-weight: 600; color: #00d9ff; text-transform: uppercase; font-size: 0.8rem; letter-spacing: 0.5px; }
    td { color: #ccc; }
    tr:hover { background: #222; }
    .method { padding: 5px 12px; border-radius: 6px; font-size: 0.75rem; font-weight: bold; text-transform: uppercase; }
    .method-get { background: #00ff8820; color: #00ff88; border: 1px solid #00ff88; }
    .method-post { background: #00d9ff20; color: #00d9ff; border: 1px solid #00d9ff; }
    .params-list { list-style: none; font-size: 0.85rem; }
    .params-list li { margin-bottom: 10px; padding: 8px; background: #222; border-radius: 6px; }
    .params-list code { background: #333; padding: 2px 6px; border-radius: 4px; color: #00ff88; }
    .required { color: #ff4757; font-weight: bold; }
    .example { background: #222; padding: 8px 12px; border-radius: 6px; font-size: 0.8rem; display: block; word-break: break-all; color: #00d9ff; border: 1px solid #333; }
    .response-format { background: #1a1a1a; border: 1px solid #333; padding: 30px; border-radius: 16px; margin-top: 30px; }
    .response-format h3 { margin-bottom: 20px; color: #00d9ff; font-size: 1.3rem; }
    .response-format h4 { color: #00ff88; margin: 20px 0 10px 0; }
    .response-format pre { background: #0a0a0a; color: #00ff88; padding: 20px; border-radius: 10px; overflow-x: auto; border: 1px solid #333; font-family: 'Monaco', 'Menlo', monospace; }
    footer { text-align: center; padding: 30px; color: #666; font-size: 0.9rem; }
    footer a { color: #00d9ff; text-decoration: none; }
    @media (max-width: 768px) {
      table { display: block; overflow-x: auto; }
      header h1 { font-size: 2rem; }
      .deploy-badges { flex-direction: column; align-items: center; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>${API_DOCS.title}</h1>
      <p>${API_DOCS.description}</p>
      <span class="version">v${API_DOCS.version}</span>
      <div class="deploy-badges">
        <a href="https://vercel.com/new/clone?repository-url=YOUR_REPO_URL" class="deploy-badge" target="_blank">
          <svg viewBox="0 0 76 65" fill="currentColor"><path d="M37.5274 0L75.0548 65H0L37.5274 0Z"/></svg>
          Deploy to Vercel
        </a>
        <a href="https://app.netlify.com/start/deploy?repository=YOUR_REPO_URL" class="deploy-badge" target="_blank">
          <svg viewBox="0 0 256 256" fill="currentColor"><path d="M128 0C57.3 0 0 57.3 0 128s57.3 128 128 128 128-57.3 128-128S198.7 0 128 0zm0 230.4c-56.5 0-102.4-45.9-102.4-102.4S71.5 25.6 128 25.6s102.4 45.9 102.4 102.4-45.9 102.4-102.4 102.4z"/></svg>
          Deploy to Netlify
        </a>
      </div>
    </header>

    ${Object.entries(API_DOCS.services).map(([key, service]) => `
      <section class="service">
        <h2>${service.name}<span class="service-badge">${service.baseRoute}</span></h2>
        ${service.aliases ? `<p class="aliases">Aliases: ${service.aliases.map(a => `<code>${a}</code>`).join(', ')}</p>` : ''}
        <table>
          <thead><tr><th>Method</th><th>Endpoint</th><th>Description</th><th>Parameters</th><th>Example</th></tr></thead>
          <tbody>${endpointRows(service.endpoints, service.baseRoute)}</tbody>
        </table>
      </section>
    `).join('')}

    <section class="response-format">
      <h3>Response Format</h3>
      <h4>Success Response:</h4>
      <pre>${JSON.stringify(API_DOCS.commonResponses.success.example, null, 2)}</pre>
      <h4>Error Response:</h4>
      <pre>${JSON.stringify(API_DOCS.commonResponses.error.example, null, 2)}</pre>
    </section>

    <footer>
      <p>Anime API - Serverless Ready | <a href="/docs/json">JSON Documentation</a></p>
    </footer>
  </div>
</body>
</html>`;
};

// ==================== EXPRESS APP ====================

const app = express();

// Middleware
app.use(express.json());
app.use(limiter);

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Root route
app.get("/", (req, res) => {
  res.json(createResponse(true, {
    name: "Anime API",
    version: API_DOCS.version,
    description: API_DOCS.description,
    documentation: "/docs",
    endpoints: {
      aniwatch: "/api/aniwatch",
      gogoanime: "/api/gogoanime",
      kickassanime: "/api/kickassanime"
    },
    deployment: {
      platform: IS_SERVERLESS ? (process.env.VERCEL ? "Vercel" : process.env.NETLIFY ? "Netlify" : "Serverless") : "Local",
      region: process.env.VERCEL_REGION || process.env.AWS_REGION || "unknown"
    }
  }));
});

// Documentation route
app.get("/docs", (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(generateDocsHTML());
});

// API docs JSON
app.get("/docs/json", (req, res) => {
  res.json(createResponse(true, API_DOCS));
});

// Health check
app.get("/health", (req, res) => {
  res.json(createResponse(true, { 
    status: "healthy", 
    uptime: process.uptime(),
    serverless: IS_SERVERLESS,
    timestamp: new Date().toISOString()
  }));
});

// API Routes
const aniwatchRouter = createAniwatchRouter({ cacheManager, createResponse, asyncHandler, headers, websites_collection, isSiteReachable });
const gogoanimeRouter = createGogoanimeRouter({ cacheManager, createResponse, asyncHandler, headers, websites_collection, isSiteReachable });
const kickassanimeRouter = createKickassanimeRouter({ cacheManager, createResponse, asyncHandler, headers, websites_collection, isSiteReachable });

// Mount routers under /api/
app.use("/api/aniwatch", aniwatchRouter);
app.use("/api/hianime", aniwatchRouter); // Alias
app.use("/api/zoro", aniwatchRouter); // Alias

app.use("/api/gogoanime", gogoanimeRouter);
app.use("/api/anitaku", gogoanimeRouter); // Alias

app.use("/api/kickassanime", kickassanimeRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json(
    createResponse(false, null, {
      message: `Route ${req.method} ${req.path} not found`,
      code: 'ROUTE_NOT_FOUND',
      status: 404,
      availableRoutes: {
        documentation: "/docs",
        aniwatch: "/api/aniwatch",
        gogoanime: "/api/gogoanime",
        kickassanime: "/api/kickassanime"
      }
    })
  );
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json(
    createResponse(false, null, {
      message: err.message || 'Internal Server Error',
      code: err.code || 'INTERNAL_ERROR',
      status: statusCode
    })
  );
});

// ==================== EXPORTS ====================

// For Vercel Serverless Functions
export default app;

// For Netlify Functions (serverless-http wrapper)
export const handler = serverless(app);

// For local development
if (!IS_SERVERLESS) {
  app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║                    ANIME API SERVER                        ║
╠════════════════════════════════════════════════════════════╣
║  Server running at: http://localhost:${PORT}                  ║
║  Documentation:     http://localhost:${PORT}/docs              ║
║  Health Check:      http://localhost:${PORT}/health            ║
╠════════════════════════════════════════════════════════════╣
║  API Endpoints:                                            ║
║    - /api/aniwatch    (AniWatch / HiAnime)                 ║
║    - /api/gogoanime   (GogoAnime / Anitaku)                ║
║    - /api/kickassanime (KickAssAnime)                      ║
╚════════════════════════════════════════════════════════════╝
    `);
  });
}
