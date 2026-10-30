import { useCallback, useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { api, errorMessage } from '../../api/client';
import { Icon } from '../../components/ui/Icon';
import { visualConfig } from '../../config/visual.config';
import { BatchDetails } from './BatchDetails';
import { ImportChoices } from './ImportChoice';
import { UploadForm } from './UploadForm';
import { useImportTransition } from './useImportTransition';
import type { ImportBatch } from './types';
import { kindLabels, statusLabels } from './types';
import './imports.css';

type History = { batches: ImportBatch[]; next: number | null };
type RuleCatalog = { version: string; rules: { code: string; version: number; title: string }[] };

export function ImportsPage({ onImported }: { onImported: () => Promise<void> }) {
  const transition = useImportTransition();
  const [uploadBusy, setUploadBusy] = useState(false);
  const [latestUpload, setLatestUpload] = useState<number | null>(null);
  const [history, setHistory] = useState<History>({ batches: [], next: null });
  const [selected, setSelected] = useState<number | null>(null);
  const [detailVersion, setDetailVersion] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [catalog, setCatalog] = useState<RuleCatalog | null>(null);
  const refresh = useCallback(async (before?: number) => {
    setLoading(true);
    setError('');
    try {
      const result = await api<History>(`/imports${before ? `?before=${before}` : ''}`);
      setHistory((old) =>
        before ? { batches: [...old.batches, ...result.batches], next: result.next } : result,
      );
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const completed = (batches: ImportBatch[]) => {
    setSelected(batches[0]?.id ?? null);
    setLatestUpload(batches[0]?.id ?? null);
    setDetailVersion((value) => value + 1);
    void refresh();
    void onImported().catch((reason) =>
      setError(`Yükleme sonucu kaydedildi; plan görünümü yenilenemedi. ${errorMessage(reason)}`),
    );
  };
  return (
    <section
      ref={transition.stage}
      className="page-enter imports-stage"
      data-phase={transition.phase}
      tabIndex={-1}
      style={
        {
          '--import-radius': `${visualConfig.imports.cardRadiusPx}px`,
          '--import-gap': `${visualConfig.imports.gapPx}px`,
          '--import-edge-duration': `${visualConfig.imports.borderTravelMs}ms`,
          '--import-glass-blur': `${visualConfig.glass.control.blurPx}px`,
        } as CSSProperties
      }
      onKeyDown={(event) => {
        if (event.key === 'Escape' && transition.phase === 'upload' && !uploadBusy) {
          event.preventDefault();
          void transition.close();
        }
      }}
    >
      <div
        ref={transition.overview}
        className="import-overview"
        inert={transition.phase !== 'overview'}
        aria-hidden={transition.phase !== 'overview'}
      >
        <div className="page-heading">
          <h1>Veri yükleme</h1>
        </div>
        <div className="page-body imports-page">
          <ImportChoices
            onChoose={(kind, button) => {
              setLatestUpload(null);
              setError('');
              void transition.open(kind, button);
            }}
          />
          <section aria-label="Yükleme geçmişi">
            <div className="import-section-heading">
              <h2>Yükleme geçmişi</h2>
              <button className="text-button" disabled={loading} onClick={() => void refresh()}>
                Yenile
              </button>
            </div>
            {error && <p role="alert">{error}</p>}
            {loading && <p role="status">Yükleme geçmişi alınıyor…</p>}
            <div className="table-sheet">
              <table>
                <thead>
                  <tr>
                    <th>Dosya</th>
                    <th>Tür</th>
                    <th>Durum</th>
                    <th>Kabul / tekrar / inceleme / bekleyen</th>
                    <th>İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {history.batches.map((batch) => (
                    <tr key={batch.id} aria-selected={selected === batch.id}>
                      <td>{batch.filename}</td>
                      <td>{kindLabels[batch.kind]}</td>
                      <td>{statusLabels[batch.status]}</td>
                      <td>
                        {batch.status === 'completed'
                          ? [
                              batch.summary.accepted,
                              batch.summary.duplicate,
                              batch.summary.quarantined,
                              batch.summary.unmatched,
                            ]
                              .map((value) => (value ?? 0).toLocaleString('tr-TR'))
                              .join(' / ')
                          : '—'}
                      </td>
                      <td>
                        <button
                          className="text-button"
                          aria-label={`${batch.filename} yükleme ${batch.id} ayrıntıları`}
                          onClick={() => setSelected(batch.id)}
                        >
                          İncele
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!loading && !history.batches.length && (
                    <tr>
                      <td colSpan={5} className="empty-cell">
                        Henüz dosya yüklenmedi.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {history.next && (
              <button
                className="outline-button"
                disabled={loading}
                onClick={() => void refresh(history.next!)}
              >
                Önceki yüklemeler
              </button>
            )}
          </section>
          {selected !== null && <BatchDetails key={`${selected}:${detailVersion}`} id={selected} />}
          <details
            className="import-catalog"
            onToggle={(event) => {
              if (event.currentTarget.open && !catalog)
                void api<RuleCatalog>('/imports/rules')
                  .then(setCatalog)
                  .catch((reason) => setError(errorMessage(reason)));
            }}
          >
            <summary>Kural kataloğu{catalog && ` v${catalog.version}`}</summary>
            {catalog && (
              <ol>
                {catalog.rules.map((rule) => (
                  <li key={rule.code}>
                    <strong>
                      {rule.code} v{rule.version}
                    </strong>{' '}
                    · {rule.title}
                  </li>
                ))}
              </ol>
            )}
          </details>
        </div>
      </div>
      <div ref={transition.surface} className="import-morph-surface" aria-hidden="true">
        <svg className="import-morph-outline">
          <path ref={transition.outline} />
        </svg>
      </div>
      <div
        ref={transition.upload}
        className="import-upload-view"
        inert={transition.phase !== 'upload'}
        aria-hidden={transition.phase !== 'upload'}
        role="region"
        aria-labelledby="import-upload-title"
      >
        <div className="page-heading import-upload-heading">
          <button
            ref={transition.back}
            type="button"
            className="text-button import-back"
            disabled={uploadBusy || transition.phase !== 'upload'}
            onClick={() => void transition.close()}
          >
            <Icon name="arrow" />
            <span>Geri dön</span>
          </button>
          <h1 id="import-upload-title">{transition.kind ? kindLabels[transition.kind] : ''}</h1>
        </div>
        <div className="page-body import-upload-body">
          {transition.kind && (
            <UploadForm
              key={transition.kind}
              kind={transition.kind}
              onComplete={completed}
              onBusy={setUploadBusy}
            />
          )}
          {latestUpload !== null && transition.kind && (
            <BatchDetails key={`${latestUpload}:${detailVersion}`} id={latestUpload} />
          )}
        </div>
      </div>
    </section>
  );
}
