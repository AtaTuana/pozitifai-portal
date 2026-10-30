import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { api, errorMessage } from '../../api/client';
import type { ImportBatch, ImportKind } from './types';
import { kindLabels } from './types';
import './imports.css';

/** A shared multipart form keeps roster and report uploads on the same validated path. */
export function UploadForm({
  kind,
  onComplete,
  onBusy,
}: {
  kind: ImportKind;
  onComplete: (batches: ImportBatch[]) => void;
  onBusy?: (busy: boolean) => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [profile, setProfile] = useState('Q1-v1');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const form = useRef<HTMLFormElement>(null);
  const choose = (list: FileList | null) => {
    setFiles(Array.from(list || []));
    setError('');
    setStatus('');
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setError('');
    setStatus('');
    const maximum = kind === 'transcript' ? 50 : 1;
    if (!files.length || files.length > maximum) {
      setError(`IMP002 · 1–${maximum} dosya seç.`);
      return;
    }
    if (
      files.some((file) => file.size > 5 * 1024 * 1024) ||
      files.reduce((sum, file) => sum + file.size, 0) > 10 * 1024 * 1024
    ) {
      setError('IMP003 · Tek dosya 5 MB, toplam yükleme 10 MB sınırını aşmamalı.');
      return;
    }
    if (
      kind === 'calls' &&
      (!!periodStart !== !!periodEnd || (periodStart && periodStart > periodEnd))
    ) {
      setError('IMP005 · Kaynak döneminin başlangıç ve bitişini birlikte, doğru sırayla belirt.');
      return;
    }
    const body = new FormData();
    body.append('kind', kind);
    files.forEach((file) => body.append('files', file, file.name));
    if (kind === 'quality') body.append('profile', profile);
    if (kind === 'calls' && periodStart) {
      body.append('periodStart', periodStart);
      body.append('periodEnd', periodEnd);
    }
    setBusy(true);
    onBusy?.(true);
    try {
      const result = await api<{ batches: ImportBatch[] }>('/imports', 'POST', body);
      const failed = result.batches.filter((batch) => batch.status === 'failed');
      const repeated = result.batches.filter((batch) => batch.repeated).length;
      setStatus(
        `${result.batches.length - failed.length} dosya tamamlandı${repeated ? `; ${repeated} dosya daha önce işlenmişti` : ''}.`,
      );
      if (failed.length)
        setError(
          failed
            .map(
              (batch) =>
                `${batch.filename}: ${batch.summary.error?.code} · ${batch.summary.error?.message}`,
            )
            .join('\n'),
        );
      else {
        form.current?.querySelectorAll<HTMLInputElement>('input[type="file"]').forEach((input) => {
          input.value = '';
        });
        setFiles([]);
      }
      onComplete(result.batches);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
      onBusy?.(false);
    }
  };
  return (
    <form
      ref={form}
      className="upload-section"
      onSubmit={(event) => void submit(event)}
      aria-busy={busy}
    >
      <h2>{kindLabels[kind]}</h2>
      <fieldset disabled={busy}>
        <div className="upload-file-controls">
          {kind === 'transcript' && (
            <label htmlFor="transcript-folder">
              Transkript klasörü
              <input
                id="transcript-folder"
                type="file"
                multiple
                accept=".txt"
                ref={(node) => {
                  if (node) node.setAttribute('webkitdirectory', '');
                }}
                onChange={(event) => choose(event.target.files)}
              />
            </label>
          )}
          <label htmlFor={`${kind}-file`}>
            {kind === 'transcript'
              ? 'Veya TXT dosyalarını seç'
              : { calls: 'calls.csv', quality: 'quality_scores.csv', agents: 'agents.csv' }[kind]}
            <input
              id={`${kind}-file`}
              type="file"
              accept={kind === 'transcript' ? '.txt' : '.csv'}
              multiple={kind === 'transcript'}
              onChange={(event) => choose(event.target.files)}
              aria-describedby={`${kind}-feedback`}
            />
          </label>
        </div>
        {kind === 'quality' && (
          <label htmlFor="quality-profile">
            Puanlama profili
            <select
              id="quality-profile"
              value={profile}
              onChange={(event) => setProfile(event.target.value)}
            >
              <option value="Q1-v1">Case Q1 — %25 selamlama / %40 ihtiyaç / %35 kapanış</option>
              <option value="none">Profil yok — yalnızca alan ve sınır kontrolleri</option>
            </select>
          </label>
        )}
        {kind === 'calls' && (
          <details className="upload-period">
            <summary>Kaynak dönemi (isteğe bağlı)</summary>
            <p className="muted">
              Yalnızca kaynağın dönemini biliyorsan belirt. Belirsiz tarihleri yorumlamak için kanıt
              olarak kullanılır; bir rapor filtresi değildir.
            </p>
            <div className="upload-date-fields">
              <label htmlFor="source-start">
                Başlangıç
                <input
                  id="source-start"
                  type="date"
                  value={periodStart}
                  onChange={(event) => setPeriodStart(event.target.value)}
                />
              </label>
              <label htmlFor="source-end">
                Bitiş
                <input
                  id="source-end"
                  type="date"
                  value={periodEnd}
                  onChange={(event) => setPeriodEnd(event.target.value)}
                />
              </label>
            </div>
          </details>
        )}
        {kind === 'transcript' && (
          <p className="muted">
            Dosya adı çağrı kimliği olmalı: C100318.txt. Bu adım metni saklar; LLM sınıflandırması
            henüz bağlı değil.
          </p>
        )}
        {files.length > 0 && (
          <p className="upload-selection">
            {files.length} dosya seçildi ·{' '}
            {files
              .slice(0, 3)
              .map((file) => file.name)
              .join(', ')}
            {files.length > 3 ? '…' : ''}
          </p>
        )}
        <button className="primary-button" type="submit" disabled={!files.length || busy}>
          {busy ? 'İşleniyor…' : 'Yükle ve işle'}
        </button>
      </fieldset>
      <div id={`${kind}-feedback`}>
        {error && (
          <p className="upload-error" role="alert">
            {error}
          </p>
        )}
        {(busy || status) && (
          <p role="status">
            {busy ? 'Dosya okunuyor, kurallar uygulanıyor ve sonuç kaydediliyor…' : status}
          </p>
        )}
      </div>
    </form>
  );
}
