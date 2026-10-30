import { useEffect, useState } from 'react';
import { api, errorMessage } from '../../api/client';
import { visualConfig } from '../../config/visual.config';

/** Cancel superseded filters. An old frame remains visibly stale until its replacement arrives. */
export function usePerformance<T>(path: string | null, revision: number) {
  const key = `${path}|${revision}`;
  const [result, setResult] = useState<{
    key: string;
    data: T | null;
    pending: boolean;
    error: string;
  }>({
    key: '',
    data: null,
    pending: true,
    error: '',
  });
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setResult((old) => ({ ...old, key, pending: true, error: '' }));
      void api<T>(path, 'GET', undefined, { signal: controller.signal })
        .then((data) => {
          if (!controller.signal.aborted) setResult({ key, data, pending: false, error: '' });
        })
        .catch((error: unknown) => {
          if (!controller.signal.aborted)
            setResult((old) => ({ ...old, key, pending: false, error: errorMessage(error) }));
        });
    }, visualConfig.dashboard.filterDebounceMs);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [path, key]);
  return {
    data: result.data,
    pending: !!path && (result.key !== key || result.pending),
    error: result.key === key ? result.error : '',
    stale: !path || result.key !== key || result.pending || !!result.error,
  };
}
