import { useEffect, useRef, useState } from 'react';
import { fetchJob } from '@/lib/api-client';
import type { JobStatusResponse } from '@/components/chat/types';

const TERMINAL_STATUSES = new Set(['done', 'failed']);
const POLL_INTERVAL_MS = 1800;

export function useJobPolling(jobId: string | null, active: boolean) {
  const [job, setJob] = useState<JobStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setJob(null);
    setError(null);
  }, [jobId]);

  useEffect(() => {
    if (!jobId || !active) return;

    let cancelled = false;

    async function poll() {
      if (cancelled) return;
      try {
        const result = await fetchJob(jobId!);
        if (!cancelled) {
          setJob(result);
          setError(null);
          if (!TERMINAL_STATUSES.has(result.status)) {
            timerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Polling error');
          timerRef.current = setTimeout(poll, POLL_INTERVAL_MS * 2);
        }
      }
    }

    poll();

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [jobId, active]);

  return { job, error };
}
