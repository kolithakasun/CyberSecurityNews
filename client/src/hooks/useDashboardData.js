import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchNews, postRefresh } from '../api.js';

export function useDashboardData({ filters, refreshIntervalMs }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const timerRef = useRef(null);

  const query = useMemo(
    () => ({
      keyword: filters.keyword,
      source: filters.source,
      severity: filters.severity,
      from: filters.from,
      to: filters.to,
    }),
    [filters.keyword, filters.source, filters.severity, filters.from, filters.to],
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
    setLoading(true);
    setError(null);
    try {
      await postRefresh();
      const res = await fetchNews({ ...query, refresh: 'true' });
      setData(res);
    } catch (e) {
      setError(e.message || 'Refresh failed');
    } finally {
      setLoading(false);
    }
  }, [query]);

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
