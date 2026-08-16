import { GoogleGenAI } from '@google/genai';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { ASSETS_DIR } from './capture.js';
import { GEMINI_COST_CATALOG, recordGenerationCost, recordGeminiTextUsage } from './costs.js';

const execFileAsync = promisify(execFile);

let _client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  if (!_client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY environment variable is not set.');
    _client = new GoogleGenAI({ apiKey });
  }
  return _client;
}

/** Reuses the same text model as storyboard planning — this is a plain text-generation call, not a TTS call. */
export function scriptModelName() {
  return process.env.GEMINI_STORYBOARD_MODEL ?? 'gemini-3.6-flash';
}
export function ttsModelName() {
  return process.env.GEMINI_TTS_MODEL ?? 'gemini-3.1-flash-tts-preview';
}
const TTS_VOICE = process.env.GEMINI_TTS_VOICE ?? 'Kore';

export interface NarrationLanguage { code: string; label: string; }

// Explicit-request detection first ("make it in French"), then the captured
// page's own <html lang> attribute, then English. This is intentionally a
// short, practical list, not a general-purpose language detector — Gemini's
// TTS model auto-detects pronunciation from the script text itself, so the
// only thing this decides is what language the SCRIPT gets written in.
const LANGUAGE_KEYWORDS: Array<{ code: string; label: string; patterns: RegExp[] }> = [
  { code: 'ar', label: 'Arabic', patterns: [/\barabic\b/i, /بالعربي/i, /باللغة العربية/i, /عربي/i] },
  { code: 'en', label: 'English', patterns: [/\benglish\b/i, /بالانجليزي/i, /بالإنجليزية/i] },
  { code: 'fr', label: 'French', patterns: [/\bfrench\b/i, /français/i] },
  { code: 'es', label: 'Spanish', patterns: [/\bspanish\b/i, /español/i] },
  { code: 'de', label: 'German', patterns: [/\bgerman\b/i, /deutsch/i] },
  { code: 'it', label: 'Italian', patterns: [/\bitalian\b/i] },
  { code: 'tr', label: 'Turkish', patterns: [/\bturkish\b/i, /türkçe/i] },
  { code: 'hi', label: 'Hindi', patterns: [/\bhindi\b/i] },
  { code: 'ur', label: 'Urdu', patterns: [/\burdu\b/i] },
  { code: 'pt', label: 'Portuguese', patterns: [/\bportuguese\b/i] },
  { code: 'ru', label: 'Russian', patterns: [/\brussian\b/i] },
  { code: 'zh', label: 'Chinese', patterns: [/\bchinese\b/i, /mandarin/i] },
  { code: 'ja', label: 'Japanese', patterns: [/\bjapanese\b/i] },
  { code: 'ko', label: 'Korean', patterns: [/\bkorean\b/i] },
];

export function resolveNarrationLanguage(creativeBrief: string | null | undefined, htmlLang: string | null | undefined, explicitCode?: string | null): NarrationLanguage {
  if (explicitCode) {
    const selected = LANGUAGE_KEYWORDS.find((entry) => entry.code === explicitCode.toLowerCase());
    if (selected) return { code: selected.code, label: selected.label };
  }
  const brief = creativeBrief ?? '';
  for (const entry of LANGUAGE_KEYWORDS) {
    if (entry.patterns.some((pattern) => pattern.test(brief))) return { code: entry.code, label: entry.label };
  }
  const normalized = (htmlLang ?? '').trim().toLowerCase().split('-')[0];
  const byHtmlLang = LANGUAGE_KEYWORDS.find((entry) => entry.code === normalized);
  if (byHtmlLang) return byHtmlLang;
  return { code: 'en', label: 'English' };
}

export interface VoiceoverScriptInput {
  jobId: string;
  siteTitle: string;
  concept: string;
  vibe: string;
  scenes: Array<{ shotDescription: string; sceneType?: string }>;
  targetDurationSeconds: number;
  language: NarrationLanguage;
  creativeBrief?: string | null;
}

/**
 * Writes a short narration script sized to the video's real length, grounded
 * strictly in the storyboard's own scenes/concept — never inventing a claim,
 * price, or feature beyond what the scenes already describe.
 */
export async function generateVoiceoverScript(input: VoiceoverScriptInput): Promise<string> {
  const { siteTitle, concept, vibe, scenes, targetDurationSeconds, language, creativeBrief } = input;
  // ~2.3 spoken words/second is a natural, unhurried voiceover pace.
  const targetWords = Math.max(8, Math.round(targetDurationSeconds * 2.3));
  const sceneList = scenes.map((scene, index) => `${index + 1}. (${scene.sceneType ?? 'feature'}) ${scene.shotDescription}`).join('\n');
  const prompt = `Write a short marketing voiceover script in ${language.label} (${language.code}) for a ${targetDurationSeconds}-second video about "${siteTitle}".

CONCEPT: ${concept}
MOOD: ${vibe}
${creativeBrief?.trim() ? `CUSTOMER NOTES: ${creativeBrief.trim()}\n` : ''}
SCENES THE VOICEOVER WILL PLAY OVER, IN ORDER:
${sceneList}

RULES:
- Target length: about ${targetWords} words total — this must fit naturally inside ${targetDurationSeconds} seconds spoken at a natural, unhurried pace. Being a little under is safer than running over.
- Write ONLY in ${language.label}. Do not mix languages.
- Ground every claim in the scenes/concept above. NEVER invent a feature, price, discount, guarantee, user count, or capability that isn't clearly implied by the scenes/concept.
- No generic filler ("in today's fast-paced world..."). Open with something concrete about this real site, move through 2-3 real highlights following the scene order, end with a simple, natural closing line — no fabricated CTA like a discount code or fake urgency.
- Return ONLY the spoken script text — no scene numbers, no stage directions, no quotation marks, no markdown.`;

  const client = getClient();
  const model = scriptModelName();
  const response = await client.models.generateContent({
    model,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: { temperature: 0.65 },
  });
  await recordGeminiTextUsage(input.jobId, model, 'voiceover_script', response.usageMetadata);
  const text = (response.text ?? '').trim();
  if (!text) throw new Error(`Gemini script model "${model}" returned an empty voiceover script.`);
  return text;
}

export interface SynthesizedVoiceover { path: string; durationSeconds: number; }

/**
 * Turns a finished script into a narration audio file. This is intentionally
 * never allowed to fail the overall render — callers must catch and continue
 * with a silent/music-only master, surfacing the exact error as a note
 * rather than losing the whole production over a voice synthesis hiccup.
 */
export async function synthesizeVoiceover(jobId: string, script: string, label = 0): Promise<SynthesizedVoiceover> {
  const model = ttsModelName();
  const prompt = `Read the following text aloud as a premium, confident brand-voiceover narrator: warm, clear tone, moderate unhurried pace, natural pauses at commas and sentence breaks. Do not add, translate, or omit any words from the transcript below.

TRANSCRIPT:
${script}`;

  const client = getClient();
  const interaction = await client.interactions.create({
    model,
    input: prompt,
    response_modalities: ['audio'],
    generation_config: { speech_config: [{ voice: TTS_VOICE }] },
  });
  const audio = interaction.output_audio;
  if (!audio?.data) throw new Error(`Gemini TTS model "${model}" returned no audio.`);

  const dir = path.join(ASSETS_DIR, jobId);
  await fs.mkdir(dir, { recursive: true });
  const rawPath = path.join(dir, `narration-${label}.pcm`);
  const wavPath = path.join(dir, `narration-${label}.wav`);
  await fs.writeFile(rawPath, Buffer.from(audio.data, 'base64'));
  try {
    // Gemini TTS returns raw 16-bit PCM (no container header) at the
    // reported sample rate/channel count — ffmpeg needs to be told the raw
    // format explicitly rather than auto-detecting it.
    const sampleRate = audio.sample_rate ?? 24000;
    const channels = audio.channels ?? 1;
    await execFileAsync('ffmpeg', [
      '-y', '-f', 's16le', '-ar', String(sampleRate), '-ac', String(channels), '-i', rawPath,
      '-c:a', 'pcm_s16le', wavPath,
    ]);
  } finally {
    await fs.rm(rawPath, { force: true }).catch(() => {});
  }
  const { stdout } = await execFileAsync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', wavPath]);
  const durationSeconds = Number(stdout.trim()) || 0;
  if (!(durationSeconds > 0)) throw new Error('Generated narration audio has no measurable duration.');
  await recordGenerationCost({
    jobId, provider: 'gemini', model, operation: 'voiceover_tts',
    quantity: durationSeconds, unit: 'audio_second', unitCostUsd: GEMINI_COST_CATALOG.ttsAudioSecond,
  });
  return { path: wavPath, durationSeconds };
}
