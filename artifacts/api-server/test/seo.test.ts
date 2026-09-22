import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  SITEMAP_PATHS,
  buildAiSummary,
  buildRobotsTxt,
  buildSitemapXml,
  getSeoPage,
  isKnownPage,
  renderSeoDocument,
} from '../src/lib/seo.js';

const html = `<!doctype html><html><head>
<title>Old title</title>
<meta name="description" content="Old description" />
<meta name="robots" content="index, follow" />
<meta name="googlebot" content="index, follow" />
<link rel="canonical" href="https://aiwebvideo.com/" />
<meta property="og:title" content="Old title" />
<meta property="og:description" content="Old description" />
<meta property="og:url" content="https://aiwebvideo.com/" />
<meta name="twitter:title" content="Old title" />
<meta name="twitter:description" content="Old description" />
<script id="site-structured-data" type="application/ld+json">{}</script>
</head><body><div id="root"></div></body></html>`;

test('public routes receive distinct server-rendered metadata and crawlable body copy', () => {
  const page = getSeoPage('/url-to-video/');
  const rendered = renderSeoDocument(html, page, 'https://aiwebvideo.com');

  assert.equal(page.index, true);
  assert.match(rendered, /<title>URL to Video AI Generator — Turn a Website Into Video \| AiWebVideo<\/title>/);
  assert.match(rendered, /canonical" href="https:\/\/aiwebvideo\.com\/url-to-video"/);
  assert.match(rendered, /name="robots" content="index, follow"/);
  assert.match(rendered, /Turn any website URL into an AI video/);
  assert.match(rendered, /data-seo-initial="true"/);
  assert.match(rendered, /FAQPage/);
});

test('private and missing pages are noindex, and missing pages are identifiable', () => {
  const privatePage = getSeoPage('/admin');
  const rendered = renderSeoDocument(html, privatePage, 'https://aiwebvideo.com');

  assert.equal(privatePage.index, false);
  assert.equal(isKnownPage('/admin'), true);
  assert.equal(isKnownPage('/studio'), true);
  assert.equal(isKnownPage('/studio/project/example-id'), true);
  assert.equal(getSeoPage('/studio/project/example-id').index, false);
  assert.equal(isKnownPage('/does-not-exist'), false);
  assert.match(rendered, /name="robots" content="noindex, nofollow"/);
  assert.doesNotMatch(rendered, /site-structured-data/);
  assert.doesNotMatch(rendered, /data-seo-initial/);
});

test('sitemap exposes focused search pages but not account pages', () => {
  const sitemap = buildSitemapXml('https://aiwebvideo.com/');
  assert.match(sitemap, /https:\/\/aiwebvideo\.com\/url-to-video/);
  assert.match(sitemap, /https:\/\/aiwebvideo\.com\/website-video-generator/);
  assert.match(sitemap, /https:\/\/aiwebvideo\.com\/saas-demo-video-generator/);
  assert.match(sitemap, /https:\/\/aiwebvideo\.com\/product-page-to-video/);
  assert.match(sitemap, /https:\/\/aiwebvideo\.com\/guides\/turn-website-into-video/);
  assert.doesNotMatch(sitemap, /dashboard|profile|admin/);
  assert.doesNotMatch(sitemap, /\/studio(?:\/|<)/);
  for (const feature of ['/ai-video-generator', '/product-photo-generator', '/product-video-generator', '/talking-video-generator', '/ai-interior-design-generator', '/interior-design-walkthrough-video', '/real-estate-walkthrough-video', '/floor-plan-to-3d', '/room-redesign-ai']) {
    assert.ok(sitemap.includes(`https://aiwebvideo.com${feature}</loc>`), `${feature} must be in the sitemap`);
  }
});

test('every sitemap URL has a matching client route', () => {
  const appFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../aiwebvideo/src/App.tsx');
  const clientRoutes = readFileSync(appFile, 'utf8');
  for (const route of SITEMAP_PATHS) {
    assert.ok(clientRoutes.includes(`<Route path="${route}"`), `Missing client route for ${route}`);
  }
  assert.match(clientRoutes, /<Route path="\/studio" component=\{StudioIndexPage\}/);
  assert.match(clientRoutes, /<Route path="\/studio\/project\/:projectId" component=\{StudioDirectEditorPage\}/);
  for (const [oldPath, destination] of [
    ['/studio/idea', '/ai-video-generator'],
    ['/studio/product', '/product-photo-generator'],
    ['/studio/scenario', '/talking-video-generator'],
    ['/studio/interior', '/ai-interior-design-generator'],
  ]) {
    assert.ok(clientRoutes.includes(`<Route path="${oldPath}"><Redirect to="${destination}" /></Route>`), `Missing client redirect for ${oldPath}`);
  }
});

test('robots file points crawlers to the canonical sitemap', () => {
  const robots = buildRobotsTxt('https://aiwebvideo.com/');
  assert.match(robots, /Allow: \//);
  assert.match(robots, /Disallow: \/api\//);
  assert.match(robots, /Sitemap: https:\/\/aiwebvideo\.com\/sitemap\.xml/);
});

test('AI summary lists the focused public search pages', () => {
  const summary = buildAiSummary('https://aiwebvideo.com/');
  assert.match(summary, /URL to Video: .*https:\/\/aiwebvideo\.com\/url-to-video/);
  assert.match(summary, /SaaS Demo Video:/);
  assert.match(summary, /Product Page to Video/);
  assert.match(summary, /Product Photos: upload real product photos/);
  assert.match(summary, /Product Video: upload real product photos/);
  assert.match(summary, /Interior Design: upload room or property photos/);
  assert.match(summary, /Talking Video: describe characters/);
});

test('server HTML describes every creation mode and published media is escaped', () => {
  const home = renderSeoDocument(html, getSeoPage('/'), 'https://aiwebvideo.com');
  for (const term of ['Website to video', 'Idea or dialogue to video', 'Real product to photos or video', 'Real spaces to design images or walkthroughs']) {
    assert.ok(home.includes(term), `Missing ${term} from the initial HTML`);
  }
  const gallery = renderSeoDocument(html, getSeoPage('/examples'), 'https://aiwebvideo.com', [
    { url: '/api/assets/marketing/film.mp4', posterUrl: '/api/assets/marketing/poster.jpg', caption: '<script>alert(1)</script>', eyebrow: 'Product media' },
    { url: 'javascript:alert(1)', posterUrl: null, caption: 'Invalid', eyebrow: null },
  ]);
  assert.match(gallery, /Published campaign films/);
  assert.match(gallery, /poster\.jpg/);
  assert.match(gallery, /<video src="https:\/\/aiwebvideo\.com\/api\/assets\/marketing\/film\.mp4"/);
  assert.match(gallery, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(gallery, /javascript:alert/);
});

test('static search files agree with dynamic SEO endpoints', () => {
  const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../aiwebvideo/public');
  assert.equal(readFileSync(path.join(publicDir, 'sitemap.xml'), 'utf8'), buildSitemapXml('https://aiwebvideo.com'));
  assert.equal(readFileSync(path.join(publicDir, 'robots.txt'), 'utf8'), buildRobotsTxt('https://aiwebvideo.com'));
  assert.equal(readFileSync(path.join(publicDir, 'llms.txt'), 'utf8'), buildAiSummary('https://aiwebvideo.com'));
  assert.equal(readFileSync(path.join(publicDir, 'ai.txt'), 'utf8'), buildAiSummary('https://aiwebvideo.com'));
});
