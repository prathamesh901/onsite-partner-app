import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

export function usePolling<T>(
  fetcher: () => Promise<T>,
  interval = 5000,
): { data: T | null; loading: boolean; error: string | null; refresh: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appState = useRef(AppState.currentState);

  const fetch = useCallback(async () => {
    try {
      const result = await fetcher();
      setData(result);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [fetcher]);

  const schedule = useCallback(() => {
    timerRef.current = setTimeout(async () => {
      await fetch();
      schedule();
    }, interval);
  }, [fetch, interval]);

  useEffect(() => {
    fetch().then(schedule);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [fetch, schedule]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        fetch();
      }
      if (next.match(/inactive|background/)) {
        if (timerRef.current) clearTimeout(timerRef.current);
      } else if (appState.current.match(/inactive|background/) && next === 'active') {
        schedule();
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, [fetch, schedule]);

  return { data, loading, error, refresh: fetch };
}
