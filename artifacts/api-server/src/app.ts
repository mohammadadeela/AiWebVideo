import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import fs from 'node:fs';
import router from './routes/index.js';
import { logger } from './lib/logger.js';
import {
  buildAiSummary,
  buildRobotsTxt,
  buildSitemapXml,
  getSeoPage,
  isKnownPage,
  renderSeoDocument,
} from './lib/seo.js';

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');

const publicUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://127.0.0.1:3001').replace(/\/$/, '');
let canonicalHost = '';
let canonicalOrigin = '';
try {
  const parsedPublicUrl = new URL(publicUrl);
  canonicalHost = parsedPublicUrl.hostname;
  canonicalOrigin = parsedPublicUrl.origin;
} catch {
  logger.warn({ publicUrl }, 'NEXT_PUBLIC_APP_URL is not a valid absolute URL');
}

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(self)');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  if (process.env.NODE_ENV === 'production') res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

// Consolidate the www and non-www versions into one canonical origin. This is
// deliberately limited to the exact alternate hostname so local health checks,
// preview hosts, and direct server access continue to work.
app.use((req, res, next) => {
  if (!canonicalHost) return next();
  const alternateHost = canonicalHost.startsWith('www.')
    ? canonicalHost.slice(4)
    : `www.${canonicalHost}`;
  if (req.hostname.toLowerCase() !== alternateHost.toLowerCase()) return next();
  return res.redirect(308, `${publicUrl}${req.originalUrl}`);
});

// CORS — allow all origins in dev; lock down in production via env
const allowedOrigin = process.env.ALLOWED_ORIGIN ?? (process.env.NODE_ENV === 'production' ? publicUrl : '*');
app.use(cors({
  origin: allowedOrigin,
  credentials: allowedOrigin !== '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Parse signed-in browser sessions before API security checks. The cookie is
// HttpOnly, so frontend JavaScript and injected scripts cannot read it.
app.use(cookieParser());

// Account, payment, generation, and admin responses must never be stored by a
// browser or intermediary cache. Cookie-authenticated writes also require the
// configured site origin, closing cross-site request forgery paths.
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  const unsafeMethod = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
  const hasSessionCookie = Boolean(req.cookies?.aiwebvideo_session);
  const usesBearer = req.headers.authorization?.startsWith('Bearer ') ?? false;
  if (unsafeMethod && hasSessionCookie && !usesBearer) {
    const origin = req.get('origin');
    if (!canonicalOrigin || origin !== canonicalOrigin) {
      res.status(403).json({ error: 'This request did not come from the configured site.', code: 'INVALID_ORIGIN' });
      return;
    }
  }
  next();
});

// JSON body
app.use(express.json({ limit: '2mb' }));

// Log incoming requests
app.use((req, _res, next) => {
  logger.debug({ method: req.method, url: req.url }, 'incoming request');
  next();
});

// Routes
app.use('/api', router);

app.get('/robots.txt', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400').type('text/plain').send(buildRobotsTxt(publicUrl));
});
app.get('/sitemap.xml', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400').type('application/xml').send(buildSitemapXml(publicUrl));
});
app.get(['/llms.txt', '/ai.txt'], (_req, res) => {
  res.set('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400').type('text/plain').send(buildAiSummary(publicUrl));
});

// Serve the production Vite build from the same process and origin as the API.
const staticDir = process.env.STATIC_DIR ?? path.resolve(process.cwd(), 'artifacts/aiwebvideo/dist/public');
if (fs.existsSync(staticDir)) {
  app.use('/assets', express.static(path.join(staticDir, 'assets'), { index: false, maxAge: '1y', immutable: true }));
  app.use(express.static(staticDir, { index: false, maxAge: '1h' }));
  const indexHtml = fs.readFileSync(path.join(staticDir, 'index.html'), 'utf8');
  app.get('/{*path}', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    const page = getSeoPage(req.path);
    const status = isKnownPage(req.path) ? 200 : 404;
    res
      .status(status)
      .set('Cache-Control', 'public, max-age=0, must-revalidate')
      .type('html')
      .send(renderSeoDocument(indexHtml, page, publicUrl));
  });
}

app.use((_req, res) => res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' }));

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, 'unhandled error');
  res.status(500).json({ error: 'Internal server error.', code: 'INTERNAL_ERROR' });
});

// Log startup config on first import (not on listen — that's index.ts's job)
logger.info({
  adminEmail: process.env.ADMIN_EMAIL ?? '(not set)',
  gemini: process.env.GEMINI_API_KEY ? '✓ configured' : '✗ not set',
  database: process.env.DATABASE_URL ? '✓ configured' : '✗ not set',
}, '[api-server] config');

export default app;
