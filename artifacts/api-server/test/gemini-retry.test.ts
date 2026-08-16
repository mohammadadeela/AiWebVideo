import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isRetryableGeminiError } from '../src/lib/veo.js';

/**
 * Regression coverage for a real production issue: Gemini's spend-based rate
 * limit (a rolling 10-minute spend cap tied to account usage tier — $10/10min
 * on Tier 1, completely separate from prepaid balance — see
 * https://ai.google.dev/gemini-api/docs/rate-limits) was surfacing as a
 * 429 RESOURCE_EXHAUSTED error identical in shape to a real "out of prepaid
 * credits" failure, and the app fell back to the slow/lower-quality
 * open-source provider immediately instead of retrying Gemini after a short
 * wait — even though the spend window reliably clears within minutes.
 *
 * This only tests classification (retryable vs. permanent), not the actual
 * retry loop's timing/network behavior, since that requires a live Gemini
 * client. The real request payloads below are taken directly from production
 * logs for this exact failure.
 */

test('classifies the real production 429 RESOURCE_EXHAUSTED (spend-based rate limit) as retryable', () => {
  const real = '{"error":{"code":429,"message":"You exceeded your current quota, please check your plan and billing details. For more information on this error, head to: https://ai.google.dev/gemini-api/docs/rate-limits. To monitor your current usage, head to: https://ai.dev/rate-limit. ","status":"RESOURCE_EXHAUSTED"}}';
  assert.equal(isRetryableGeminiError(real), true);
});

test('classifies a genuinely depleted prepaid balance as retryable too (still a 429, still worth one short retry)', () => {
  const depleted = '{"error":{"code":429,"message":"Your prepayment credits are depleted. Please go to AI Studio at https://ai.studio/projects to manage your project and billing.","status":"RESOURCE_EXHAUSTED"}}';
  assert.equal(isRetryableGeminiError(depleted), true);
});

test('classifies transient service errors (503/UNAVAILABLE) as retryable', () => {
  assert.equal(isRetryableGeminiError('{"error":{"code":503,"status":"UNAVAILABLE","message":"The model is overloaded."}}'), true);
  assert.equal(isRetryableGeminiError('connect ETIMEDOUT 142.250.0.1:443'), true);
  assert.equal(isRetryableGeminiError('read ECONNRESET'), true);
});

test('does not retry permanent/non-recoverable errors', () => {
  assert.equal(isRetryableGeminiError('{"error":{"code":400,"status":"INVALID_ARGUMENT","message":"seed parameter is only supported in Gemini Enterprise Agent Platform mode"}}'), false);
  assert.equal(isRetryableGeminiError('{"error":{"code":403,"status":"PERMISSION_DENIED","message":"API key not valid"}}'), false);
  assert.equal(isRetryableGeminiError('No website screenshot is available for AI video grounding.'), false);
});
