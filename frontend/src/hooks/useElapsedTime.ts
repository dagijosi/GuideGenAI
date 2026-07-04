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

interface ProgressSample {
  progress: number;
  timestamp: number; // ms
}

/**
 * Tracks a rolling window of progress samples and returns a hook that
 * gives an estimated remaining time in seconds (or null if not enough data).
 *
 * Uses a rolling average over the last N samples so that phase changes
 * (fast crawl → slow AI docs) are reflected quickly rather than being
 * diluted by old history.
 */
export function useEtaEstimator(windowSize = 6) {
  const samplesRef = useRef<ProgressSample[]>([]);

  const recordProgress = (progress: number) => {
    const now = Date.now();
    const samples = samplesRef.current;

    // Only record when progress actually advances
    if (samples.length > 0 && samples[samples.length - 1].progress >= progress) return;

    samples.push({ progress, timestamp: now });
    // Keep only the last N samples
    if (samples.length > windowSize) {
      samplesRef.current = samples.slice(-windowSize);
    }
  };

  const getEta = (currentProgress: number): number | null => {
    const samples = samplesRef.current;
    if (samples.length < 2 || currentProgress <= 2 || currentProgress >= 100) return null;

    // Use oldest and newest sample in the window to get rate
    const oldest = samples[0];
    const newest = samples[samples.length - 1];
    const progressDelta = newest.progress - oldest.progress;
    const timeDelta = (newest.timestamp - oldest.timestamp) / 1000; // seconds

    if (progressDelta <= 0 || timeDelta <= 0) return null;

    const ratePerSecond = progressDelta / timeDelta; // % per second
    const remaining = (100 - currentProgress) / ratePerSecond;

    // Cap at 2 hours — anything beyond is meaningless to show
    return Math.min(Math.ceil(remaining), 7200);
  };

  const reset = () => {
    samplesRef.current = [];
  };

  return { recordProgress, getEta, reset };
}
