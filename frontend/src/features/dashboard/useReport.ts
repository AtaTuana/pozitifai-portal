import { useEffect, useState } from 'react';
import { api, errorMessage } from '../../api/client';
import { visualConfig } from '../../config/visual.config';
import type { KpiReport } from './types';

type Result = { key: string; data: KpiReport | null; pending: boolean; error: string };

/** Keep the last frame while fetching, but explicitly mark it stale until the new scope arrives. */
export function useReport(query: string, valid: boolean, revision: number) {
  const key = `${query}|${revision}`;
  const [result, setResult] = useState<Result>({ key: '', data: null, pending: true, error: '' });
  useEffect(() => {
    if (!valid) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setResult((previous) => ({ ...previous, key, pending: true, error: '' }));
      void api<KpiReport>(`/reports/kpis?${query}`, 'GET', undefined, { signal: controller.signal })
        .then((data) => {
          if (!controller.signal.aborted) setResult({ key, data, pending: false, error: '' });
        })
        .catch((error: unknown) => {
          if (!controller.signal.aborted) {
            setResult((previous) => ({
              ...previous,
              key,
              pending: false,
              error: errorMessage(error),
            }));
          }
        });
    }, visualConfig.dashboard.filterDebounceMs);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, valid, key]);
  return {
    data: result.data,
    pending: valid && (result.key !== key || result.pending),
    error: result.key === key ? result.error : '',
    stale: !valid || result.key !== key || result.pending || !!result.error,
  };
}
