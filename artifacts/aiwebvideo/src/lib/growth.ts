import { request } from './api-client';

export interface WelcomeGrowthOffer {
  active: boolean;
  startedAt?: string;
  expiresAt: string;
  discountPercent: number;
  bonusPercent?: number;
  starterCredits: number;
  bonusCreditsGranted: number;
  balanceInternal: number;
  balanceDisplay: number;
  eligibleProducts: string[];
}

export async function fetchWelcomeGrowthOffer(): Promise<WelcomeGrowthOffer> {
  return request<WelcomeGrowthOffer>('/api/growth/welcome', { method: 'GET' });
}

export function discountedPrice(amountUsd: number, percent: number): number {
  const safeAmount = Math.max(0, Number(amountUsd) || 0);
  const safePercent = Math.max(0, Math.min(100, Number(percent) || 0));
  return Math.round((safeAmount * (1 - safePercent / 100) + Number.EPSILON) * 100) / 100;
}

export function formatUsd(amountUsd: number): string {
  return `$${Math.max(0, Number(amountUsd) || 0).toFixed(2)}`;
}

export function formatWelcomeCountdown(expiresAt: string | null | undefined, now = Date.now()): string {
  const end = expiresAt ? new Date(expiresAt).getTime() : 0;
  const remaining = Math.max(0, end - now);
  const totalSeconds = Math.ceil(remaining / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
