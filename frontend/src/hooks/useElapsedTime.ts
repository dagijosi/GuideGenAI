import { useEffect, useRef, useState } from 'react';

/**
 * Tracks elapsed time (in seconds) since `startedAt`.
 * Only ticks while `active` is true. Returns 0 if no startedAt is provided.
 */
export function useElapsedTime(startedAt: string | null, active: boolean) {
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!startedAt || !active) {
      setElapsed(0);
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const tick = () => {
      const diff = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
      setElapsed(Math.max(0, diff));
    };
    tick();
    timerRef.current = setInterval(tick, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [startedAt, active]);

  return elapsed;
}

/**
 * Automatically captures the timestamp when `active` becomes true.
 * Returns elapsed seconds since that moment.
 */
export function useAutoElapsedTime(active: boolean) {
  const [startedAt, setStartedAt] = useState<string | null>(null);

  useEffect(() => {
    if (active && !startedAt) {
      setStartedAt(new Date().toISOString());
    }
    if (!active) {
      setStartedAt(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return useElapsedTime(startedAt, active);
}

/** Format seconds as "1m 23s" or "42s" */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return s > 0 ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
}

/**
 * Given current progress (0-100) and elapsed seconds,
 * returns an estimated remaining time in seconds (or null if not calculable).
 */
export function estimateRemaining(progress: number, elapsedSeconds: number): number | null {
  if (progress <= 2 || elapsedSeconds < 5) return null; // not enough data yet
  if (progress >= 100) return 0;
  const rate = progress / elapsedSeconds; // % per second
  const remaining = (100 - progress) / rate;
  return Math.ceil(remaining);
}
