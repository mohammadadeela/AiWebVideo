import type { Response } from 'express';

export class AppError extends Error {
  status: number;
  code: string;
  constructor(message: string, status = 400, code = 'BAD_REQUEST') {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
  }
}

const FRIENDLY_FIELD_NAMES: Record<string, string> = {
  email: 'email address',
  password: 'password',
  url: 'website URL',
  vibeBrief: 'description',
  durationSeconds: 'video length',
  mode: 'generation mode',
};

export function sendError(res: Response, err: unknown): void {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: err.message, code: err.code });
    return;
  }
  // Validation errors (zod) → clear, friendly 400s instead of a scary 500
  if (err instanceof Error && err.name === 'ZodError') {
    const issues = (err as unknown as { issues?: Array<{ path: (string | number)[]; message: string }> }).issues ?? [];
    const first = issues[0];
    const field = first ? FRIENDLY_FIELD_NAMES[String(first.path[0])] ?? String(first.path[0] ?? 'input') : 'input';
    const detail =
      first?.message === 'Required'
        ? `Please provide your ${field}.`
        : first?.path[0] === 'password'
          ? 'Your password needs to be at least 6 characters.'
          // Custom .refine()/.email()/.url() messages are already specific
          // and useful (e.g. "Enter a full https:// link or upload a video
          // file.") — show them directly instead of a vague fallback.
          : first?.message
            ? first.message
            : `Please check the ${field} and try again.`;
    res.status(400).json({ error: detail, code: 'VALIDATION_ERROR' });
    return;
  }
  // Malformed UUIDs in URL params hit Postgres as invalid input (22P02).
  // To the customer that's simply "not found", never a server error.
  if ((err as { code?: string })?.code === '22P02') {
    res.status(404).json({ error: 'Job not found.', code: 'NOT_FOUND' });
    return;
  }
  if (err instanceof Error) {
    console.error('[api] unhandled error:', err.message, err.stack);
    res.status(500).json({ error: 'Internal server error.', code: 'INTERNAL_ERROR' });
    return;
  }
  res.status(500).json({ error: 'Internal server error.', code: 'INTERNAL_ERROR' });
}
