import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isPaidProviderCallAuthorized,
  isPaidProviderReservationActive
} from '../src/lib/generation-authorization.js';

test('paid provider calls require ownership, the exact active stage, and the full credit reservation', () => {
  const fundedPlanning = {
    user_id: 'user-1',
    status: 'storyboarding',
    credits_spent: 38
  };
  const fundedRender = {
    user_id: 'user-1',
    status: 'rendering',
    credits_spent: 38
  };

  assert.equal(isPaidProviderCallAuthorized(fundedPlanning, 'user-1', 38, 'storyboarding'), true);
  assert.equal(isPaidProviderCallAuthorized(fundedRender, 'user-1', 38, 'rendering'), true);
  assert.equal(isPaidProviderCallAuthorized(fundedPlanning, 'user-1', 39, 'storyboarding'), false);
  assert.equal(isPaidProviderCallAuthorized(fundedPlanning, 'another-user', 38, 'storyboarding'), false);
  assert.equal(isPaidProviderCallAuthorized(fundedPlanning, 'user-1', 38, 'rendering'), false);
  assert.equal(
    isPaidProviderCallAuthorized({ ...fundedPlanning, status: 'done' }, 'user-1', 38, 'storyboarding'),
    false
  );
  assert.equal(
    isPaidProviderCallAuthorized(
      { ...fundedPlanning, status: 'failed', credits_spent: 0 },
      'user-1',
      38,
      'storyboarding'
    ),
    false
  );
  assert.equal(isPaidProviderCallAuthorized(null, 'user-1', 38, 'storyboarding'), false);
});

test('queued provider attempts stop after cancellation, refund, failure, or stage changes', () => {
  const active = {
    user_id: 'user-1',
    status: 'rendering',
    credits_spent: 24
  };

  assert.equal(isPaidProviderReservationActive(active, 'rendering'), true);
  assert.equal(isPaidProviderReservationActive({ ...active, credits_spent: 0 }, 'rendering'), false);
  assert.equal(isPaidProviderReservationActive({ ...active, status: 'cancelled' }, 'rendering'), false);
  assert.equal(isPaidProviderReservationActive({ ...active, status: 'failed' }, 'rendering'), false);
  assert.equal(isPaidProviderReservationActive({ ...active, status: 'done' }, 'rendering'), false);
  assert.equal(isPaidProviderReservationActive(active, 'storyboarding'), false);
  assert.equal(isPaidProviderReservationActive({ ...active, user_id: null }, 'rendering'), false);
});
