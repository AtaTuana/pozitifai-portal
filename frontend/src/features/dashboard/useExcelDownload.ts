import { useEffect, useRef, useState } from 'react';
import { ApiError, errorMessage } from '../../api/client';

/** Download a server-scoped workbook; no client-side dataset is trusted for authorization. */
export function useExcelDownload() {
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);

  const download = async (query: URLSearchParams) => {
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setDownloading(true);
    setDownloadError('');
    try {
      const response = await fetch(`/api/reports/excel?${query}`, {
        credentials: 'same-origin',
        cache: 'no-store',
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(60_000)]),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        if (response.status === 401) window.dispatchEvent(new Event('portal:session-expired'));
        throw new ApiError(
          body?.error?.code || 'XLS003',
          body?.error?.message || 'Excel raporu indirilemedi.',
          response.status,
        );
      }
      if (
        !response.headers
          .get('Content-Type')
          ?.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      ) {
        throw new ApiError('XLS003', 'Sunucudan geçerli Excel dosyası alınamadı.', response.status);
      }
      const blob = await response.blob();
      if (controller.signal.aborted) return;
      const filename =
        response.headers
          .get('Content-Disposition')
          ?.match(/filename="([a-zA-Z0-9._-]+\.xlsx)"/)?.[1] || 'pozitifai-rapor.xlsx';
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (reason) {
      if (!controller.signal.aborted) {
        setDownloadError(
          reason instanceof ApiError
            ? errorMessage(reason)
            : 'XLS003 · Rapor indirilemedi. Bağlantıyı kontrol edip yeniden dene.',
        );
      }
    } finally {
      if (!controller.signal.aborted) setDownloading(false);
      active.current = null;
    }
  };
  return { downloading, downloadError, download };
}
