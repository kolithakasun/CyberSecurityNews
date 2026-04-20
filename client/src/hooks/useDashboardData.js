import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchNews } from '../api.js';

export function useDashboardData({ filters, refreshIntervalMs }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const timerRef = useRef(null);

  const query = useMemo(
    () => ({
      keyword: filters.keyword,
      // Sources are intentionally excluded here — source filtering is done
      // client-side so the full source list stays available in the dropdown
      // regardless of which sources are currently selected.
      severity: filters.severity,
      from: filters.from,
      to: filters.to,
    }),
    [filters.keyword, filters.severity, filters.from, filters.to],
  );

  const load = useCallback(
    async (forceRefresh = false) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchNews({ ...query, refresh: forceRefresh ? 'true' : undefined });
        setData(res);
      } catch (e) {
        setError(e.message || 'Failed to load');
      } finally {
        setLoading(false);
      }
    },
    [query],
  );

  const hardRefresh = useCallback(async () => {
    // Pass refresh=true directly to /news — the server invalidates its cache
    // and re-fetches all feeds in the same request. No separate /refresh route needed.
    await load(true);
  }, [load]);

  useEffect(() => {
    load(false);
  }, [load]);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!refreshIntervalMs || refreshIntervalMs < 5000) return undefined;
    timerRef.current = setInterval(() => {
      load(false);
    }, refreshIntervalMs);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [load, refreshIntervalMs]);

  return { data, loading, error, reload: load, hardRefresh };
}
