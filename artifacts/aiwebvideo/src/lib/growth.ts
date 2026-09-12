import { request } from './api-client';
import { displayCredits } from './credits';

export interface WelcomeGrowthOffer {
  active: boolean;
  expiresAt: string;
  bonusPercent: number;
  starterCredits: number;
  bonusCreditsGranted: number;
  balanceInternal: number;
  balanceDisplay: number;
  eligibleProducts: string[];
}

export async function fetchWelcomeGrowthOffer(): Promise<WelcomeGrowthOffer> {
  return request<WelcomeGrowthOffer>('/api/growth/welcome', { method: 'GET' });
}

export function welcomeBonusDisplayCredits(internalCredits: number, percent: number): number {
  const bonusInternal = Math.max(0, Math.floor(internalCredits * (Math.max(0, percent) / 100)));
  return displayCredits(bonusInternal);
}

export function formatWelcomeCountdown(expiresAt: string | null | undefined, now = Date.now()): string {
  const end = expiresAt ? new Date(expiresAt).getTime() : 0;
  const remaining = Math.max(0, end - now);
  const totalSeconds = Math.ceil(remaining / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
