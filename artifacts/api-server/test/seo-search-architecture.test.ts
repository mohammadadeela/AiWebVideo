import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { SITEMAP_PATHS, buildAiSummary, buildIndexNowPayload, buildRobotsTxt, getSeoPage, isValidIndexNowKey, renderSeoDocument } from '../src/lib/seo.js';

const BASE = 'https://aiwebvideo.com';
const shell = '<html><head><title>x</title><meta name="description" content="x"><meta name="robots" content="x"></head><body><div id="root"></div></body></html>';
const render = (route: string) => renderSeoDocument(shell, getSeoPage(route), BASE);
const fe = (file: string) => readFileSync(path.resolve(process.cwd(), '../aiwebvideo/src', file), 'utf8');
const tag = (html: string, pattern: RegExp) => pattern.exec(html)?.[1] ?? '';
const hrefsOf = (html: string) => [...html.matchAll(/<a href="(\/[^"#?]*)/g)].map((match) => match[1]).map((href) => href.replace(/\/$/, '') || '/');

test('every indexable page has its own title and description, one H1, a canonical, and a sensible length', () => {
  const titles = new Map<string, string>(), descriptions = new Map<string, string>();
  for (const route of SITEMAP_PATHS) {
    const html = render(route);
    const title = tag(html, /<title>([\s\S]*?)<\/title>/), description = tag(html, /name="description" content="([^"]*)"/);
    assert.ok(title.length >= 20 && title.length <= 80, `${route} title length ${title.length}`);
    assert.ok(description.length >= 50 && description.length <= 230, `${route} description length ${description.length}`);
    assert.equal(titles.get(title), undefined, `${route} repeats the title of ${titles.get(title)}`);
    assert.equal(descriptions.get(description), undefined, `${route} repeats the description of ${descriptions.get(description)}`);
    titles.set(title, route); descriptions.set(description, route);
    assert.equal((html.match(/<h1\b/g) ?? []).length, 1, `${route} H1 count`);
    assert.match(html, new RegExp(`<link rel="canonical" href="${BASE}${route === '/' ? '/' : route}" />`.replace('//"', '/"')), `${route} canonical`);
    assert.match(html, /name="robots" content="index, follow"/, route);
  }
});

test('the homepage title starts with the brand, and the brand is spelled one way', () => {
  const html = render('/');
  assert.match(tag(html, /<title>([\s\S]*?)<\/title>/), /^AiWebVideo — /);
  assert.match(html, /<h1>[^<]*AiWebVideo<\/h1>/);
  assert.match(html, /"name":"AiWebVideo"/);
  assert.doesNotMatch(html, /Ai Web Video|AIWEBVIDEO|AIWebVideo/);
});

test('no orphan pages: every page in the sitemap can be reached from the homepage by plain links', () => {
  const seen = new Set<string>(['/']);
  const queue = ['/'];
  while (queue.length) {
    for (const href of hrefsOf(render(queue.shift()!))) {
      if (!seen.has(href) && (SITEMAP_PATHS as readonly string[]).includes(href)) { seen.add(href); queue.push(href); }
    }
  }
  const missing = SITEMAP_PATHS.filter((route) => !seen.has(route));
  assert.deepEqual(missing, []);
});

test('Product Link and Architecture are first-class pages, linked from the homepage, and state their limits', () => {
  const home = hrefsOf(render('/'));
  for (const route of ['/product-page-to-video', '/ai-architectural-visualization', '/architecture-site-placement']) {
    assert.ok((SITEMAP_PATHS as readonly string[]).includes(route), route);
    assert.ok(home.includes(route), `${route} is linked from the homepage`);
  }
  const product = render('/product-page-to-video');
  assert.match(product, /only after you press create|only when you confirm|starts only when you confirm/i);          // never auto-generates
  assert.match(product, /block automated access|blocks automatic reading|refuse automated access/i);                  // honest about blocked shops
  assert.match(product, /upload/i);                                                                                    // and the fallback
  assert.doesNotMatch(product, /every (?:online )?(?:store|website|shop) (?:works|is supported)/i);
  for (const route of ['/ai-architectural-visualization', '/architecture-site-placement']) {
    assert.match(render(route), /not a surveyed or construction-accurate plan/i, route);
  }
  assert.match(render('/architecture-site-placement'), /trademarks of Google LLC/);                                    // Google's marks respected
  assert.doesNotMatch(render('/architecture-site-placement'), /Google (?:endorses|partner|official)/i);
});

test('the React pages carry the same questions and the same architecture notice as the server-rendered ones', () => {
  const source = fe('pages/SearchLandingPages.tsx');
  for (const route of ['/product-page-to-video', '/ai-architectural-visualization', '/architecture-site-placement']) {
    const html = render(route);
    const questions = [...html.matchAll(/<h3>([^<]+)<\/h3>/g)].map((match) => match[1].replace(/&amp;/g, '&').replace(/&#39;|&#x27;/g, "'"));
    assert.ok(questions.length >= 3, route);
    for (const question of questions) assert.ok(source.includes(question), `${route}: "${question}" is missing from the React page`);
  }
  assert.match(source, /path: "\/architecture-site-placement"/);
  assert.match(fe('App.tsx'), /Route path="\/architecture-site-placement"/);
  assert.match(fe('lib/useSeo.ts'), /options\.title\.includes\(SITE_NAME\)/);                                           // no "| AiWebVideo | AiWebVideo"
});

test('robots.txt: search crawlers (including ChatGPT search) may read public pages, private areas are kept out, GPTBot is untouched', () => {
  const robots = buildRobotsTxt(BASE);
  for (const agent of ['Googlebot', 'Bingbot', 'OAI-SearchBot', '*']) {
    const block = robots.split('\n\n').find((part) => part.startsWith(`User-agent: ${agent}\n`)) ?? '';
    assert.match(block, /Allow: \//, agent);
    for (const prefix of ['/api/', '/dashboard', '/profile', '/admin', '/studio']) assert.match(block, new RegExp(`Disallow: ${prefix}`), `${agent} ${prefix}`);
    assert.doesNotMatch(block, /Disallow: \/\s*$/m, agent);
  }
  assert.doesNotMatch(robots, /GPTBot/);                                                                              // a business decision, not changed here
  assert.match(robots, /Sitemap: https:\/\/aiwebvideo\.com\/sitemap\.xml/);
  // nothing private is in the sitemap
  for (const route of SITEMAP_PATHS) assert.doesNotMatch(route, /^\/(?:api|dashboard|profile|admin|studio)/);
});

test('IndexNow: keys are validated, and only this site\'s URLs are sent', () => {
  assert.equal(isValidIndexNowKey('a1b2c3d4e5f6'), true);
  for (const bad of [undefined, '', 'short', 'has space in it!', '../etc/passwd', 'x'.repeat(200)]) assert.equal(isValidIndexNowKey(bad), false, String(bad));
  const payload = buildIndexNowPayload(`${BASE}/`, 'a1b2c3d4e5f6', [`${BASE}/ai-video-generator`, `${BASE}/ai-video-generator`, 'https://evil.example/x', `${BASE}/about`]);
  assert.deepEqual(payload, { host: 'aiwebvideo.com', key: 'a1b2c3d4e5f6', keyLocation: `${BASE}/a1b2c3d4e5f6.txt`, urlList: [`${BASE}/ai-video-generator`, `${BASE}/about`] });
});

test('the AI summary (llms.txt) lists Product Link, Architecture and site placement', () => {
  const summary = buildAiSummary(BASE);
  for (const route of ['/product-page-to-video', '/ai-architectural-visualization', '/architecture-site-placement']) assert.ok(summary.includes(`${BASE}${route}`), route);
  assert.match(summary, /not construction-accurate/);
});
