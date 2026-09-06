import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Response } from 'express';
import { AppError, sendError } from '../src/lib/errors.js';
import {
  containsTechnicalError,
  publicApiErrorMessage,
  publicJobErrorMessage,
  publicJobMessageContent,
} from '../src/lib/public-errors.js';

const PERSON_GENERATION_ERROR = 'Something went wrong while producing your files. Exact error: scene 1: {"error":{"code":400,"message":"allow_adult for personGeneration is currently not supported.","status":"INVALID_ARGUMENT"}}. All your credits for this render have been refunded automatically.';

test('customer job errors never expose Gemini personGeneration diagnostics', () => {
  const message = publicJobErrorMessage(PERSON_GENERATION_ERROR);
  assert.equal(message, 'The video service rejected a temporary generation setting. Your reserved credits were restored. Create a fresh version and try again.');
  assert.doesNotMatch(message ?? '', /allow_adult|personGeneration|INVALID_ARGUMENT|\{"error"/i);
});

test('rate-limit and policy failures become actionable customer messages', () => {
  assert.match(publicJobErrorMessage('Exact error: 429 RESOURCE_EXHAUSTED quota exceeded') ?? '', /capacity.*credits were restored/i);
  assert.match(publicJobErrorMessage('Exact error: Request blocked for an unspecified policy reason') ?? '', /safety system.*adjust/i);
});

test('planning, partial delivery, and narration failures preserve the useful outcome', () => {
  assert.match(publicJobErrorMessage("We couldn't finish planning. Exact error: upstream 503 UNAVAILABLE") ?? '', /No credits were used/i);
  assert.match(publicJobErrorMessage('Video generation failed — photos were delivered instead. Exact error: upstream failed') ?? '', /photos are ready.*video credits were refunded/i);
  assert.match(publicJobMessageContent("Voiceover narration wasn't available and was refunded. Exact error: ETIMEDOUT"), /generated video is still ready/i);
});

test('friendly product messages pass through unchanged', () => {
  const message = 'This website could not be reached. Check the address and try again.';
  assert.equal(containsTechnicalError(message), false);
  assert.equal(publicJobErrorMessage(message), message);
  assert.equal(publicApiErrorMessage(message), message);
});

test('public API error sanitizer removes technical provider details', () => {
  const message = publicApiErrorMessage('{"error":{"code":400,"status":"INVALID_ARGUMENT","message":"personGeneration is unsupported"}}');
  assert.equal(message, 'The AI service rejected a temporary generation setting. Please try again with a fresh version.');
  assert.doesNotMatch(message, /personGeneration|INVALID_ARGUMENT|400/i);
});

function responseRecorder(isAdmin: boolean) {
  const recorded: { status?: number; body?: unknown } = {};
  const response = {
    locals: { isAdmin },
    status(code: number) { recorded.status = code; return this; },
    json(body: unknown) { recorded.body = body; return this; },
  } as unknown as Response;
  return { response, recorded };
}

test('sendError exposes exact diagnostics only to authenticated administrators', () => {
  const providerError = new AppError(PERSON_GENERATION_ERROR, 400, 'VIDEO_PROVIDER_ERROR');

  const customer = responseRecorder(false);
  sendError(customer.response, providerError);
  assert.equal(customer.recorded.status, 400);
  assert.doesNotMatch(JSON.stringify(customer.recorded.body), /allow_adult|personGeneration|INVALID_ARGUMENT/i);

  const admin = responseRecorder(true);
  sendError(admin.response, providerError);
  assert.equal(admin.recorded.status, 400);
  assert.match(JSON.stringify(admin.recorded.body), /allow_adult.*personGeneration.*INVALID_ARGUMENT/i);
  assert.match(JSON.stringify(admin.recorded.body), /"technical":true/);
});


test('customer errors never expose negativePrompt provider diagnostics', () => {
  const raw = 'Negative prompt is not supported in your use case.';
  const message = publicJobErrorMessage(raw);
  assert.ok(message);
  assert.doesNotMatch(message ?? '', /negative.?prompt|unsupported/i);
});
