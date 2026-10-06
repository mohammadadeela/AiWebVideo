import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { ASSETS_DIR } from '../src/lib/capture.js';
import {
  BRAND_LOCKUP_FILE,
  addBrandEnding,
  brandDomain,
  brandEndingHoldSeconds,
  deriveBrandName,
  hasBrandLockup,
} from '../src/lib/brand-ending.js';
import {
  BRAND_ENDING_DIRECTIVE,
  PRODUCT_ACCURACY_RULES,
  REAL_PRODUCTION_LOOK_RULES,
  REAL_UI_REALISM_RULES,
  VIDEO_MASTER_PROMPTS,
  WEBSITE_VIDEO_MODES,
  buildAiVideoScenePrompt,
  buildContinuousExtensionPrompt,
  buildContinuousVideoPrompt,
  isWebsiteVideoMode,
} from '../src/lib/video-prompts.js';
import { ARCHITECTURE_MASTER_DIRECTION, INTERIOR_MASTER_DIRECTION } from '../src/lib/studio-direction.js';
import { INTERNAL_MASTER_IMAGE_QUALITY_DIRECTIVE, MARKETING_PHOTO_MASTER_PROMPTS } from '../src/lib/imagen.js';
import { MASTER_CREATIVE_DIRECTOR_SYSTEM, type StoryboardScene } from '../src/lib/gemini.js';

const execFileAsync = promisify(execFile);

async function probe(file: string) {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'error', '-show_entries', 'stream=codec_type,width,height:format=duration', '-of', 'json', file,
  ]);
  const parsed = JSON.parse(stdout) as { streams: Array<{ codec_type: string; width?: number; height?: number }>; format: { duration: string } };
  const video = parsed.streams.find((s) => s.codec_type === 'video');
  return {
    seconds: Number(parsed.format.duration),
    width: video?.width ?? 0,
    height: video?.height ?? 0,
    audio: parsed.streams.some((s) => s.codec_type === 'audio'),
  };
}

async function frameLuma(file: string, atSeconds: number): Promise<number> {
  // Average luma of one frame: used to prove the ending really dims the film.
  const { stderr } = await execFileAsync('ffmpeg', [
    '-hide_banner', '-ss', atSeconds.toFixed(3), '-i', file, '-frames:v', '1',
    '-vf', 'signalstats,metadata=print:key=lavfi.signalstats.YAVG', '-f', 'null', '-',
  ]);
  const match = stderr.match(/YAVG=([\d.]+)/);
  assert.ok(match, `no YAVG in ffmpeg output for ${file}`);
  return Number(match[1]);
}

test('brand ending keeps duration, frame size and audio while dimming only the final seconds', async () => {
  const jobId = `brand-ending-${process.pid}-${Date.now()}`;
  const dir = path.join(ASSETS_DIR, jobId);
  await fs.mkdir(dir, { recursive: true });
  try {
    const source = path.join(dir, 'film.mp4');
    await execFileAsync('ffmpeg', [
      '-y', '-hide_banner', '-loglevel', 'error',
      '-f', 'lavfi', '-i', 'color=c=0x9a9a9a:s=640x360:r=24:d=8',
      '-f', 'lavfi', '-i', 'sine=frequency=330:duration=8',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', source,
    ]);
    // A transparent "logo" plate: white rounded shape on alpha.
    const lockup = path.join(dir, BRAND_LOCKUP_FILE);
    await execFileAsync('ffmpeg', [
      '-y', '-hide_banner', '-loglevel', 'error',
      '-f', 'lavfi', '-i', 'color=c=white@0.0:s=1200x400:d=0.1,format=rgba',
      '-vf', "format=rgba,geq=r=255:g=255:b=255:a='if(lt(hypot((X-600)/600,(Y-200)/200),1),255,0)'",
      '-frames:v', '1', lockup,
    ]);
    assert.equal(await hasBrandLockup(jobId), true);

    const output = path.join(dir, 'film-branded.mp4');
    assert.equal(await addBrandEnding(source, output, jobId), true);

    const before = await probe(source);
    const after = await probe(output);
    assert.ok(Math.abs(after.seconds - before.seconds) < 0.3, `duration changed: ${before.seconds} -> ${after.seconds}`);
    assert.equal(after.width, 640);
    assert.equal(after.height, 360);
    assert.equal(after.audio, true, 'soundtrack must survive the ending pass');

    const early = await frameLuma(output, 1.0);
    const corner = await frameLuma(output, before.seconds - 0.2);
    assert.ok(early > 120 && early < 170, `the film before the ending stays untouched (luma ${early})`);
    assert.ok(corner < early, `the final seconds are dimmed under the plate (${corner} vs ${early})`);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('brand ending is skipped cleanly when no lockup was captured', async () => {
  const jobId = `brand-ending-missing-${process.pid}-${Date.now()}`;
  const dir = path.join(ASSETS_DIR, jobId);
  await fs.mkdir(dir, { recursive: true });
  try {
    const source = path.join(dir, 'film.mp4');
    await execFileAsync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=gray:s=320x180:r=24:d=8', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', source]);
    assert.equal(await hasBrandLockup(jobId), false);
    assert.equal(await addBrandEnding(source, path.join(dir, 'out.mp4'), jobId), false);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('brand name and domain derivation prefer the real site name over generic title words', () => {
  assert.equal(brandDomain('https://www.Example-Shop.com/path?q=1'), 'example-shop.com');
  assert.equal(deriveBrandName('Home | Noor Boutique', null, 'noorboutique.com'), 'Noor Boutique');
  assert.equal(deriveBrandName('Noor Boutique – Dresses, Abayas & More', null, 'noorboutique.com'), 'Noor Boutique');
  assert.equal(deriveBrandName('Welcome', 'Acme Tools', 'acme.io'), 'Acme Tools');
  assert.equal(deriveBrandName('Home', null, 'brightpath.app'), 'Brightpath');
  assert.equal(deriveBrandName('الرئيسية | متجر لمسة', null, 'lamsa.ps'), 'متجر لمسة');
  assert.equal(brandEndingHoldSeconds(8), 2.4);
  assert.equal(brandEndingHoldSeconds(24), 3.2);
});

test('website modes get real-UI rules and the brand-ending directive; studio modes do not', () => {
  for (const mode of ['video', 'tutorial', 'buy', 'tour', 'character', 'demo', 'both', 'mockup', 'linkedin']) {
    assert.ok(isWebsiteVideoMode(mode), mode);
    assert.ok(WEBSITE_VIDEO_MODES.has(mode));
  }
  for (const mode of ['custom', 'ai-video', 'product-video', 'talking-scene']) assert.equal(isWebsiteVideoMode(mode), false, mode);

  const scenes: StoryboardScene[] = [0, 1, 2].map((index) => ({
    sceneNumber: index + 1,
    durationSeconds: 8,
    sceneType: index === 0 ? 'hook' : index === 2 ? 'closing' : 'interaction',
    shotDescription: `Beat ${index + 1}`,
    sourceIndices: [0],
    composition: 'single',
    motion: 'static',
    focusX: 0.5,
    focusY: 0.5,
    onScreenCopy: '',
    transition: '',
  }));
  const website = buildContinuousVideoPrompt({ mode: 'video', siteTitle: 'Example', concept: 'promo', vibe: 'clean', scenes, targetDurationSeconds: 24, referenceLabels: ['Homepage'], nativeAudio: true });
  assert.ok(website.includes('LOOKS SHOT BY A REAL CREW'));
  assert.ok(website.includes('REAL INTERFACE REALISM'));
  assert.ok(website.includes('BRANDED ENDING — LEAVE ROOM FOR THE REAL LOGO'));
  assert.ok(website.includes('Never neon or glowing outlines'));
  assert.ok(!website.includes('PRODUCT ACCURACY — THE REAL PRODUCT'));

  const product = buildContinuousVideoPrompt({ mode: 'product-video', siteTitle: 'Bag', concept: 'launch', vibe: 'luxury', scenes, targetDurationSeconds: 24, referenceLabels: ['Product photo'], nativeAudio: true });
  assert.ok(product.includes('PRODUCT ACCURACY — THE REAL PRODUCT'));
  assert.ok(product.includes('LOOKS SHOT BY A REAL CREW'));
  assert.ok(!product.includes('BRANDED ENDING'));
  assert.ok(!product.includes('REAL INTERFACE REALISM'));

  const custom = buildContinuousVideoPrompt({ mode: 'custom', siteTitle: 'Idea', concept: 'story', vibe: 'warm', scenes, targetDurationSeconds: 24, referenceLabels: [], nativeAudio: true });
  assert.ok(custom.includes('LOOKS SHOT BY A REAL CREW'));
  assert.ok(!custom.includes('BRANDED ENDING'));

  const finalWindow = buildContinuousExtensionPrompt(website, 21, 24);
  assert.ok(finalWindow.includes('the real logo is composited there in finishing'));

  // Per-scene runtime prompts stay compact and only the closing website beat carries the ending note.
  const base = { mode: 'buy', siteTitle: 'Example Store', concept: 'purchase journey', vibe: 'premium', targetDurationSeconds: 24, nativeAudio: true, referenceLabels: ['Homepage'], aspectRatio: '16:9' as const };
  const opening = buildAiVideoScenePrompt({ ...base, scene: scenes[0], sceneIndex: 0, totalScenes: 3 });
  const closing = buildAiVideoScenePrompt({ ...base, scene: scenes[2], sceneIndex: 2, totalScenes: 3 });
  assert.ok(opening.includes('REAL-CREW LOOK'));
  assert.ok(opening.includes('REAL UI:'));
  assert.ok(!opening.includes('ENDING: the real logo'));
  assert.ok(closing.includes('ENDING: the real logo is added in finishing'));
  assert.ok(closing.length < 5200, `scene prompt too large: ${closing.length}`);
  const productScene = buildAiVideoScenePrompt({ ...base, mode: 'product-video', scene: scenes[1], sceneIndex: 1, totalScenes: 3 });
  assert.ok(productScene.includes('PRODUCT TRUTH'));
  assert.ok(!productScene.includes('REAL UI:'));
});

test('every mode master prompt carries a creative playbook and the shared rule blocks are substantive', () => {
  for (const [mode, prompt] of Object.entries(VIDEO_MASTER_PROMPTS)) assert.ok(prompt.includes('CREATIVE PLAYBOOK'), mode);
  assert.ok(REAL_PRODUCTION_LOOK_RULES.includes('neon cyan/magenta/purple'));
  assert.ok(REAL_UI_REALISM_RULES.includes('standard OS arrow'));
  assert.ok(BRAND_ENDING_DIRECTIVE.includes('NEVER draw, imitate, animate or invent a logo'));
  assert.ok(PRODUCT_ACCURACY_RULES.includes('Count and lock the product'));
  assert.ok(MASTER_CREATIVE_DIRECTOR_SYSTEM.includes('real crew'));
  assert.ok(MASTER_CREATIVE_DIRECTOR_SYSTEM.includes('Never describe glowing, neon, gradient-pill'));
});

test('image masters demand photographer realism and engineering-grade product, interior and architecture accuracy', () => {
  assert.ok(INTERNAL_MASTER_IMAGE_QUALITY_DIRECTIVE.includes('real professional photographer'));
  assert.ok(MARKETING_PHOTO_MASTER_PROMPTS['product-photos'].includes('PRODUCT ACCURACY — THE REAL PRODUCT'));
  assert.ok(MARKETING_PHOTO_MASTER_PROMPTS['product-photos'].includes('exact referenced product'));
  assert.ok(INTERIOR_MASTER_DIRECTION.includes('ACCURACY CHECKLIST'));
  assert.ok(INTERIOR_MASTER_DIRECTION.includes('real interior photographer'));
  assert.ok(ARCHITECTURE_MASTER_DIRECTION.includes('ACCURACY CHECKLIST'));
  assert.ok(ARCHITECTURE_MASTER_DIRECTION.includes('Floor count, floor-to-floor heights'));
});
