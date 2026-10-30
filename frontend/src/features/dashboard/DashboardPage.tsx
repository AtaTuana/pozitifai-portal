import { useState } from 'react';
import type { Plan, PortalUser } from '../../api/types';
import { DashboardFilters } from './DashboardFilters';
import { DurationWidget, QualityWidget, RatioWidget, TotalWidget } from './Instruments';
import { HourlyWidget } from './HourlyWidget';
import { DashboardMotion } from './motion';
import { useReport } from './useReport';
import { useExcelDownload } from './useExcelDownload';
import { count } from './format';
import type { DashboardFilters as Filters } from './types';
import './dashboard.css';

export function DashboardPage({
  plan,
  user,
  campaignId,
  campaignName,
}: {
  plan: Plan;
  user: PortalUser;
  campaignId: string;
  campaignName: string;
}) {
  const initial: Filters = {
    teamId: user.capabilities.allTeams ? '' : (user.teamId ?? ''),
    agentId: '',
    dateFrom: '',
    dateTo: '',
  };
  const [filters, setFilters] = useState<Filters>(initial);
  const [revision, setRevision] = useState(0);
  const { downloading, downloadError, download } = useExcelDownload();
  const invalidDates = filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo;
  const invalidDateLimit = filters.dateFrom > '9999-12-30' || filters.dateTo > '9999-12-30';
  const filterError = invalidDates
    ? 'Başlangıç tarihi bitiş tarihinden sonra olamaz.'
    : invalidDateLimit
      ? 'Geçerli bir tarih seç.'
      : '';
  const query = new URLSearchParams({ groupBy: 'hour', limit: '24' });
  for (const [name, value] of Object.entries({ ...filters, campaignId })) {
    if (value) query.set(name, value);
  }
  const { data, pending, stale, error } = useReport(
    query.toString(),
    !filterError,
    revision + plan.revision,
  );
  const metrics = data?.summary ?? null;
  const reset = () => setFilters(initial);
  const updatedAt = data
    ? new Intl.DateTimeFormat('tr-TR', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Istanbul',
      }).format(new Date(data.generatedAt))
    : '';
  return (
    <section className="page-enter dashboard-page" aria-labelledby="dashboard-heading">
      <div className="page-heading dashboard-heading">
        <div>
          <h1 id="dashboard-heading">Genel bakış</h1>
          <p>{campaignName}</p>
        </div>
        <div className="dashboard-heading-actions">
          <button
            type="button"
            className="dashboard-refresh"
            disabled={downloading || pending || !!filterError}
            onClick={() => {
              const selection = new URLSearchParams(query);
              selection.delete('groupBy');
              selection.delete('limit');
              void download(selection);
            }}
          >
            <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
              <path
                d="M10 2v10m-4-4 4 4 4-4M3 13v4h14v-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {downloading ? 'Excel hazırlanıyor…' : 'Excel indir'}
          </button>
          <button
            type="button"
            className="dashboard-refresh"
            disabled={pending || !!filterError}
            onClick={() => setRevision((value) => value + 1)}
            aria-label="Rapor verilerini yenile"
          >
            <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
              <path
                d="M16 8a6 6 0 1 0-.7 5M16 3v5h-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Yenile
          </button>
        </div>
      </div>
      <div className="page-body dashboard-body">
        {downloadError && (
          <div className="dashboard-error" role="alert">
            {downloadError}
          </div>
        )}
        <DashboardFilters
          plan={plan}
          user={user}
          value={filters}
          change={setFilters}
          reset={reset}
          error={filterError}
        />
        <div className="dashboard-status" role="status" aria-live="polite">
          {filterError
            ? 'Son başarılı hesap gösteriliyor.'
            : pending
              ? data
                ? 'Güncelleniyor · Önceki hesap gösteriliyor.'
                : 'Rapor hesaplanıyor…'
              : error
                ? ''
                : metrics?.totalCalls === 0
                  ? 'Bu filtrelerle eşleşen çağrı yok.'
                  : updatedAt
                    ? `Son hesaplama ${updatedAt}`
                    : ''}
        </div>
        {error && (
          <div className="dashboard-error" role="alert">
            <span>
              {error}
              {data ? ' Son başarılı hesap gösteriliyor.' : ''}
            </span>
            <button type="button" onClick={() => setRevision((value) => value + 1)}>
              Tekrar dene
            </button>
          </div>
        )}
        <DashboardMotion>
          <div className="dashboard-grid" aria-busy={pending} data-stale={stale && !!data}>
            <TotalWidget metrics={metrics} />
            <RatioWidget
              kind="reach"
              numerator={metrics?.reachedCalls ?? null}
              denominator={metrics?.totalCalls ?? null}
              rate={metrics?.reachRate ?? null}
              unknown={metrics?.unknownResultCalls}
            />
            <RatioWidget
              kind="conversion"
              numerator={metrics?.salesCalls ?? null}
              denominator={metrics?.reachedCalls ?? null}
              rate={metrics?.conversionRate ?? null}
            />
            <DurationWidget metrics={metrics} />
            <QualityWidget metrics={metrics} />
            <HourlyWidget report={data} />
          </div>
        </DashboardMotion>
        {!!data?.dateCoverage.undatedCallsExcluded && (
          <p className="dashboard-coverage">
            Tarihi belirlenemeyen {count(data.dateCoverage.undatedCallsExcluded)} çağrı, tarih
            filtresi nedeniyle bu rapora dahil değil.
          </p>
        )}
      </div>
    </section>
  );
}
