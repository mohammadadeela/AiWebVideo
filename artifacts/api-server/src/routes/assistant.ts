import { Router } from 'express';
import { GoogleGenAI } from '@google/genai';
import { tryAuth } from '../lib/auth.js';
import { AppError, sendError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { storyboardModelName } from '../lib/gemini.js';
import {
  ASSISTANT_SCHEMA,
  ASSISTANT_SYSTEM,
  contextBlock,
  createTurnLimiter,
  normalizeAssistantTurn,
  sanitizeContext,
  sanitizeMessages,
} from '../lib/assistant.js';

const router = Router();

// The assistant costs the site a little on every turn, so it is limited per account (or per address for visitors).
const TEN_MINUTES = 10 * 60 * 1000;
const allowVisitor = createTurnLimiter(10, TEN_MINUTES);
const allowVisitorDaily = createTurnLimiter(40, 24 * 60 * 60 * 1000);
const allowAccount = createTurnLimiter(40, TEN_MINUTES);
const TURN_TIMEOUT_MS = 15_000;

let client: GoogleGenAI | null = null;
function assistantClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new AppError('The assistant is not available right now.', 503, 'ASSISTANT_UNAVAILABLE');
  client ??= new GoogleGenAI({ apiKey });
  return client;
}

function assistantModel(): string {
  return process.env.GEMINI_ASSISTANT_MODEL?.trim() || storyboardModelName();
}

/** Whether the page should talk to the assistant at all (it falls back to starting directly when this is off). */
router.get('/status', (_req, res) => {
  res.json({ enabled: process.env.ASSISTANT_ENABLED !== 'false' && Boolean(process.env.GEMINI_API_KEY) });
});

router.post('/chat', tryAuth, async (req, res) => {
  try {
    if (process.env.ASSISTANT_ENABLED === 'false') throw new AppError('The assistant is not available right now.', 503, 'ASSISTANT_UNAVAILABLE');

    const address = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    const allowed = req.user
      ? allowAccount(`user:${req.user.id}`)
      : allowVisitor(`ip:${address}`) && allowVisitorDaily(`ip:${address}`);
    if (!allowed) {
      throw new AppError(
        req.user ? 'You are sending messages very quickly. Give it a minute and try again.' : 'Sign in to keep talking to Linkreel.',
        429,
        'ASSISTANT_RATE_LIMITED',
      );
    }

    const messages = sanitizeMessages((req.body as { messages?: unknown } | undefined)?.messages);
    if (!messages.length) throw new AppError('Write a message first.', 400, 'ASSISTANT_EMPTY');
    const context = sanitizeContext((req.body as { context?: unknown } | undefined)?.context, Boolean(req.user));

    const contents = messages.map((message, index) => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      // The page state rides along with the newest message only.
      parts: [{ text: index === messages.length - 1 ? `${contextBlock(context)}\n\nMESSAGE\n${message.text}` : message.text }],
    }));

    const model = assistantModel();
    const ai = assistantClient();
    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction: ASSISTANT_SYSTEM,
        responseMimeType: 'application/json',
        responseSchema: ASSISTANT_SCHEMA as Parameters<typeof ai.models.generateContent>[0]['config'] extends { responseSchema?: infer T } ? T : never,
        temperature: 0.4,
        // Room for the model's own reasoning as well as the short JSON answer.
        maxOutputTokens: 4096,
        abortSignal: AbortSignal.timeout(TURN_TIMEOUT_MS),
      },
    });

    let parsed: unknown = null;
    try {
      parsed = JSON.parse(response.text ?? '');
    } catch {
      throw new AppError('The assistant could not answer just now.', 502, 'ASSISTANT_BAD_ANSWER');
    }
    res.json(normalizeAssistantTurn(parsed, context));
  } catch (error) {
    if (!(error instanceof AppError)) {
      logger.warn({ err: (error as Error)?.message }, '[assistant] turn failed');
      // Whatever went wrong upstream, the page gets one stable answer and quietly starts the request the direct way.
      sendError(res, new AppError('The assistant could not answer just now.', 503, 'ASSISTANT_UNAVAILABLE'));
      return;
    }
    sendError(res, error);
  }
});

export default router;
