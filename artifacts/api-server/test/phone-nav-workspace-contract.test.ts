import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const fe = (file: string) => readFile(path.resolve(process.cwd(), '../aiwebvideo/src', file), 'utf8');

test('the workspace keeps its original solid background, while other cinematic pages are unchanged', async () => {
  const dashboard = await fe('components/dashboard/DashboardClient.tsx');
  assert.match(dashboard, /className="cinematic-page workspace-page min-h-screen bg-bg lg:flex"/);
  const css = await fe('cinematic-theme.css');
  // profile / admin keep letting the page background show...
  assert.match(css, /\.cinematic-page\.bg-bg \{ background-color: transparent; \}/);
  // ...but the workspace is the plain app colour again (more specific, so it wins), covering the fixed space picture
  assert.match(css, /\.cinematic-page\.workspace-page\.bg-bg \{ background-color: var\(--color-bg\); \}/);
  assert.ok(css.indexOf('.cinematic-page.workspace-page.bg-bg') > css.indexOf('.cinematic-page.bg-bg {'), 'the workspace rule comes after the general one');
  const index = await fe('index.css');
  assert.match(index, /--color-bg: #140f27;/);                                          // the colour the workspace always had
  // no other page was given the workspace class
  assert.equal((dashboard.match(/workspace-page/g) ?? []).length, 1);
});

test('phones get a swipeable rail of every feature, an "All" sheet of large cards, and a button once the rail folds away', async () => {
  const menu = await fe('components/landing/FeatureMenu.tsx');
  assert.match(menu, /export function FeatureRail\(/);
  assert.match(menu, /sm:hidden/);                                                      // phones only: larger screens keep the pills / pop-over
  assert.match(menu, /aria-label="All features"/);                                      // the first chip opens everything
  assert.match(menu, /CREATION_FEATURES\.map\(\(\{ id, short, label, icon: Icon \}\) => \(\s*<button\s+key=\{id\}\s+ref=/);   // one chip per feature, from the shared list
  assert.match(menu, /h-10 shrink-0/);                                                  // 40 px tall touch targets
  assert.match(menu, /aria-pressed=\{active === id\}/);                                 // the open feature is marked
  assert.match(menu, /prefers-reduced-motion: reduce/);                                 // the first-visit nudge respects it
  assert.match(menu, /RAIL_HINT_KEY/);                                                  // ...and happens once per device
  assert.match(menu, /export function FeatureMenuButton\(/);
  // the bottom sheet (phones) and the pop-over (tablets) both keep the same label and sign-in note
  assert.match(menu, /<Dialog\.Root open=\{open\} onOpenChange=\{setOpen\}>/);
  assert.match(menu, /min-h-\[112px\]/);                                                // large cards
  assert.equal((menu.match(/aria-label="Choose a feature"/g) ?? []).length, 2);
  assert.equal((menu.match(/Sign in or create a free account when you press Generate\./g) ?? []).length, 2);
  assert.match(menu, /OPEN_FEATURE_MENU_EVENT/);

  const nav = await fe('components/landing/Nav.tsx');
  assert.match(nav, /<FeatureRail onPick=\{pickFeature\} collapsed=\{scrolled\} \/>/);
  assert.match(nav, /\{scrolled && <FeatureMenuButton \/>\}/);
  // Log in and Sign up stay in the first row on phones
  assert.match(nav, /Sign up/);

  const css = await fe('cinematic-theme.css');
  assert.match(css, /\.feature-sheet\[role="dialog"\] \{ width: 100%; max-width: 100vw; \}/);   // beats the global "dialog max-width: 100vw - 16px" phone rule
  assert.match(css, /\.feature-rail \{[^}]*scrollbar-width: none;/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{ \.feature-sheet, \.feature-sheet-overlay \{ animation: none; \} \}/);
});
