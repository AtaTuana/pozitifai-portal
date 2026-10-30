import { useEffect, useState } from 'react';
import { api, errorMessage } from '../../api/client';
import type { ImportDetail, ImportSummary } from './types';
import { statusLabels } from './types';

const count = (value?: number) => (value ?? 0).toLocaleString('tr-TR');
const valueText = (value: unknown) =>
  value === null || value === undefined
    ? 'Boş'
    : typeof value === 'string'
      ? value || '""'
      : JSON.stringify(value, null, 2);
const dateText = (value: string) =>
  new Date(value).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });

function Summary({ data }: { data: ImportSummary }) {
  const items: [string, number | undefined][] = [
    ['Kaynak satırı', data.total],
    ['Benzersiz kayıt', data.uniqueRecords],
    ['Kabul edilen', data.accepted],
    ['Tekrar', data.duplicate],
    ['İnceleme gerekli', data.quarantined],
    ['Eşleşme bekliyor', data.unmatched],
    ['Düzeltilen / eşleştirilen alan', data.correctedFields],
    ['İşlem izi olan benzersiz kayıt', data.affectedRecords],
  ];
  return (
    <>
      <dl className="import-summary">
        {items.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{count(value)}</dd>
          </div>
        ))}
      </dl>
      {data.undatedCalls !== undefined && (
        <p className="muted">
          Kabul edilen çağrılarda: {count(data.undatedCalls)} tarihsiz, {count(data.unknownAgents)}{' '}
          temsilcisi eşleşmeyen, {count(data.unknownResults)} sonucu bilinmeyen,{' '}
          {count(data.missingDurations)} süresi boş kayıt. Aynı çağrı birden fazla grupta olabilir.
        </p>
      )}
    </>
  );
}

/** Evidence is fetched in small pages; long upload histories never mount thousands of rows. */
export function BatchDetails({ id }: { id: number }) {
  const [data, setData] = useState<ImportDetail | null>(null);
  const [page, setPage] = useState(1);
  const [rule, setRule] = useState('');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    setBusy(true);
    setError('');
    api<ImportDetail>(`/imports/${id}?page=${page}&rule=${encodeURIComponent(rule)}`)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((reason) => {
        if (active) setError(errorMessage(reason));
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [id, page, rule, reload]);
  return (
    <section className="import-details" aria-label="Yükleme ayrıntısı" aria-busy={busy}>
      <div className="import-section-heading">
        <h2>{data?.batch.filename || `Yükleme #${id}`}</h2>
        <button
          type="button"
          className="text-button"
          disabled={busy}
          onClick={() => setReload((value) => value + 1)}
        >
          Yenile
        </button>
      </div>
      {busy && <p role="status">Yükleme ayrıntıları alınıyor…</p>}
      {error && <p role="alert">{error}</p>}
      {data && (
        <>
          <p className="muted">
            {statusLabels[data.batch.status]} · {data.batch.uploadedBy} ·{' '}
            {dateText(data.batch.uploadedAt)} · Katalog v{data.batch.rulesetVersion}
            {data.batch.options.profile === 'Q1-v1' ? ' · Q1 v1' : ''}
          </p>
          {data.batch.summary.error ? (
            <p role="alert">
              {data.batch.summary.error.code} · {data.batch.summary.error.message}
            </p>
          ) : (
            <Summary data={data.batch.summary} />
          )}
          <label className="import-rule-filter" htmlFor={`rule-${id}`}>
            Kural filtresi
            <select
              id={`rule-${id}`}
              value={rule}
              disabled={busy}
              onChange={(event) => {
                setRule(event.target.value);
                setPage(1);
              }}
            >
              <option value="">Bütün işlem kayıtları</option>
              {Object.entries(data.batch.summary.ruleCounts || {})
                .sort()
                .map(([code, total]) => (
                  <option key={code} value={code}>
                    {code} · {count(total)} işlem
                  </option>
                ))}
            </select>
          </label>
          {!busy && !data.issues.length && !data.batch.summary.error && (
            <p>Bu görünümde düzeltme veya sorun kaydı yok.</p>
          )}
          <ol className="import-issues">
            {data.issues.map((issue) => (
              <li key={issue.id}>
                <div className="import-issue-heading">
                  <h3>
                    {issue.reference || 'Kimlik yok'} · Satır {issue.row}
                  </h3>
                  <span>{statusLabels[issue.status] || issue.status}</span>
                </div>
                <p>
                  <strong title={issue.ruleTitle}>
                    {issue.code} v{issue.version}
                  </strong>
                  {issue.field && ` · ${issue.field}`} — {issue.message}
                </p>
                <div className="import-value-pair">
                  <div>
                    <span className="muted">Önce</span>
                    <pre>{valueText(issue.before)}</pre>
                  </div>
                  <div>
                    <span className="muted">Sonra</span>
                    <pre>{valueText(issue.after)}</pre>
                  </div>
                </div>
                {issue.effect && <p>{issue.effect}</p>}
                {issue.resolvedAt && (
                  <p className="muted">
                    Eşleşme çözüldü · {dateText(issue.resolvedAt)} · {issue.resolution}
                  </p>
                )}
                <details>
                  <summary>Kanıt ve işlem bilgisi</summary>
                  <p>
                    {issue.actor} · {dateText(issue.createdAt)} · {issue.operation}
                  </p>
                  {Object.keys(issue.evidence).length > 0 && (
                    <pre>{JSON.stringify(issue.evidence, null, 2)}</pre>
                  )}
                </details>
              </li>
            ))}
          </ol>
          <div className="import-pagination">
            <button
              className="outline-button"
              disabled={busy || page <= 1}
              onClick={() => setPage((value) => value - 1)}
            >
              Önceki
            </button>
            <span>
              Sayfa {page} · {count(data.totalIssues)} işlem
            </span>
            <button
              className="outline-button"
              disabled={busy || !data.hasMore}
              onClick={() => setPage((value) => value + 1)}
            >
              Sonraki
            </button>
          </div>
        </>
      )}
    </section>
  );
}
