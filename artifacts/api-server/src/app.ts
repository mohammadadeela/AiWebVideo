import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import router from './routes/index.js';
import { logger } from './lib/logger.js';

const app = express();
app.set('trust proxy', 1);

// Raw body for Stripe webhooks
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));

// CORS — allow all origins in dev; lock down in production via env
const allowedOrigin = process.env.ALLOWED_ORIGIN ?? '*';
app.use(cors({
  origin: allowedOrigin,
  credentials: allowedOrigin !== '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// JSON body
app.use(express.json({ limit: '2mb' }));

// Log incoming requests
app.use((req, _res, next) => {
  logger.debug({ method: req.method, url: req.url }, 'incoming request');
  next();
});

// Routes
app.use('/api', router);

const publicUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://127.0.0.1:3001').replace(/\/$/, '');
app.get('/robots.txt', (_req, res) => {
  res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${publicUrl}/sitemap.xml\n`);
});
app.get('/sitemap.xml', (_req, res) => {
  const updated = new Date().toISOString().slice(0, 10);
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${publicUrl}/</loc><lastmod>${updated}</lastmod><changefreq>weekly</changefreq><priority>1.0</priority></url>
  <url><loc>${publicUrl}/features</loc><lastmod>${updated}</lastmod><changefreq>monthly</changefreq><priority>0.9</priority></url>
  <url><loc>${publicUrl}/how-it-works</loc><lastmod>${updated}</lastmod><changefreq>monthly</changefreq><priority>0.9</priority></url>
  <url><loc>${publicUrl}/pricing</loc><lastmod>${updated}</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>${publicUrl}/about</loc><lastmod>${updated}</lastmod><changefreq>monthly</changefreq><priority>0.6</priority></url>
  <url><loc>${publicUrl}/faq</loc><lastmod>${updated}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>${publicUrl}/privacy</loc><lastmod>${updated}</lastmod><changefreq>yearly</changefreq><priority>0.3</priority></url>
  <url><loc>${publicUrl}/terms</loc><lastmod>${updated}</lastmod><changefreq>yearly</changefreq><priority>0.3</priority></url>
</urlset>`);
});
app.get(['/llms.txt', '/ai.txt'], (_req, res) => {
  res.type('text/plain').send(`# AiWebVideo

AiWebVideo is a private website-to-video production studio. It captures real, fully loaded pages and a smooth-scroll recording, then creates customizable promotional videos, product tours, tutorials, SaaS demos, and marketing photos.

## Best for
- Ecommerce and fashion campaigns
- SaaS product demos and launch videos
- Website tutorials and purchase walkthroughs
- 16:9 and 9:16 exports, with 1080p or 4K mastered delivery

## Pricing
Free capture and storyboard preview. Paid generation uses one credit per generated video second. Failed scenes are automatically refunded.

Canonical website: ${publicUrl}
Pricing: ${publicUrl}/pricing
`);
});

// Serve the production Vite build from the same process and origin as the API.
const staticDir = process.env.STATIC_DIR ?? path.resolve(process.cwd(), 'artifacts/aiwebvideo/dist/public');
if (fs.existsSync(staticDir)) {
  app.use(express.static(staticDir, { index: false, maxAge: '1h' }));
  app.get('/{*path}', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(staticDir, 'index.html'));
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
