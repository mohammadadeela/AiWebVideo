import assert from 'node:assert/strict';
import test from 'node:test';
import {
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
});

test('robots file points crawlers to the canonical sitemap', () => {
  const robots = buildRobotsTxt('https://aiwebvideo.com/');
  assert.match(robots, /Allow: \//);
  assert.match(robots, /Disallow: \/api\//);
  assert.match(robots, /Sitemap: https:\/\/aiwebvideo\.com\/sitemap\.xml/);
});

test('AI summary lists the focused public search pages', () => {
  const summary = buildAiSummary('https://aiwebvideo.com/');
  assert.match(summary, /URL to Video: https:\/\/aiwebvideo\.com\/url-to-video/);
  assert.match(summary, /SaaS Demo Video Generator/);
  assert.match(summary, /Product Page to Video/);
});
