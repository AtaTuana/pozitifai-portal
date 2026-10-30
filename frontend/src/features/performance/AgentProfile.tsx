import { useEffect, useRef } from 'react';
import { Icon } from '../../components/ui/Icon';
import { AnimatedValue } from '../dashboard/Instruments';
import { useInstrument } from '../dashboard/motion';
import type { AgentDetail, AgentIdentity, MetricKey } from './types';
import { AgentAvatar, PerformanceBar } from './PerformanceVisuals';
import { usePerformance } from './usePerformance';
import { count, dateLabel, metricLabels, metricValue, sample } from './presentation';

function HourBar({
  hour,
  total,
  reached,
  maximum,
}: {
  hour: number;
  total: number;
  reached: number;
  maximum: number;
}) {
  const whole = useRef<HTMLSpanElement>(null),
    part = useRef<HTMLSpanElement>(null);
  useInstrument([total / maximum, reached / maximum], ([a, b]) => {
    if (whole.current) whole.current.style.transform = `scaleY(${a})`;
    if (part.current) part.current.style.transform = `scaleY(${b})`;
  });
  const label = `${String(hour).padStart(2, '0')}:00 · ${count(total)} çağrı · ${count(reached)} ulaşılan`;
  return (
    <div className="performance-hour" title={label}>
      <span className="sr-only">{label}</span>
      <span className="performance-hour-column" aria-hidden="true">
        <span ref={whole} />
        <span ref={part} />
      </span>
      <small aria-hidden="true">{String(hour).padStart(2, '0')}</small>
    </div>
  );
}

/** Period and all-time comparisons retain the same campaign; missing data never becomes a grade. */
export function AgentProfile({
  agent,
  query,
  valid,
  revision,
  periodLabel,
  campaignName,
  onBack,
}: {
  agent: AgentIdentity;
  query: string;
  valid: boolean;
  revision: number;
  periodLabel: string;
  campaignName: string;
  onBack: () => void;
}) {
  const report = usePerformance<AgentDetail>(
    valid ? `/reports/agents/${encodeURIComponent(agent.id)}?${query}` : null,
    revision,
  );
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, []);
  const data = report.data;
  const person = data?.agent || agent;
  const hours = new Map(data?.hourly.map((row) => [row.hour, row.metrics]) ?? []);
  const maxHour = Math.max(1, ...[...hours.values()].map((row) => row.totalCalls));
  return (
    <div className="performance-detail performance-view">
      <button className="text-button performance-back" onClick={onBack}>
        <span>
          <Icon name="arrow" />
        </span>{' '}
        Temsilcilere dön
      </button>
      <div className="performance-profile performance-surface">
        <AgentAvatar name={person.name} large />
        <div className="performance-profile-name">
          <span className="performance-eyebrow">Temsilci profili</span>
          <h2 ref={heading} tabIndex={-1}>
            {person.name}
          </h2>
          <p>
            {person.team?.name || 'Takım atanmamış'}
            {!person.active && ' · Pasif'}
          </p>
        </div>
        <div className="performance-start">
          <span>İşe başlama</span>
          <strong>{dateLabel(person.startDate)}</strong>
        </div>
      </div>
      <div className="performance-section-heading">
        <h2>Dönem karşılaştırması</h2>
        <span>
          {periodLabel} · {campaignName}
        </span>
      </div>
      <p className="performance-status" role="status">
        {report.error ||
          (report.pending
            ? 'Performans hesaplanıyor…'
            : report.stale
              ? 'Filtreyi tamamla.'
              : 'Tüm zamanlar değerleri de seçili kampanyayı kapsar.')}
      </p>
      {!data && report.pending && <div className="performance-skeleton" aria-hidden="true" />}
      {data && (
        <div
          className="performance-detail-content"
          aria-busy={report.pending}
          data-stale={report.stale}
        >
          <div className="performance-metrics">
            {(Object.keys(metricLabels) as MetricKey[]).map((key) => {
              const current = data.summary[key],
                all = data.allTime[key];
              const maximum = ['reachRate', 'conversionRate', 'averageQualityScore'].includes(key)
                ? 100
                : Math.max(1, current ?? 0, all ?? 0);
              return (
                <section className="performance-metric performance-surface" key={key}>
                  <h3>{metricLabels[key]}</h3>
                  <span className="performance-metric-value">
                    <AnimatedValue value={current} format={(value) => metricValue(value, key)} />
                  </span>
                  <small>Seçili dönem · {sample(data.summary, key)}</small>
                  <PerformanceBar value={current} maximum={maximum} />
                  <div className="performance-all-time">
                    <span>Tüm zamanlar</span>
                    <AnimatedValue value={all} format={(value) => metricValue(value, key)} />
                  </div>
                  <PerformanceBar value={all} maximum={maximum} secondary />
                  <small>{sample(data.allTime, key)}</small>
                </section>
              );
            })}
          </div>
          <div className="performance-detail-bottom">
            <section className="performance-surface performance-hours">
              <div className="performance-section-heading">
                <h3>Saatlik dağılım</h3>
                <span>Seçili dönem</span>
              </div>
              <div className="performance-hour-legend">
                <span>Toplam çağrı</span>
                <span>Ulaşılan çağrı</span>
              </div>
              <div className="performance-hour-chart">
                {Array.from({ length: 24 }, (_, hour) => (
                  <HourBar
                    key={hour}
                    hour={hour}
                    total={hours.get(hour)?.totalCalls ?? 0}
                    reached={hours.get(hour)?.reachedCalls ?? 0}
                    maximum={maxHour}
                  />
                ))}
              </div>
              <small>
                {count(data.summary.coverage.undatedCalls)} tarihsiz çağrı saatlik grafiğe katılmaz.
              </small>
            </section>
            <section className="performance-surface performance-quality">
              <div className="performance-section-heading">
                <h3>Kalite bileşenleri</h3>
                <span>Seçili dönem</span>
              </div>
              {(
                [
                  ['greeting', 'Selamlama'],
                  ['needAnalysis', 'İhtiyaç analizi'],
                  ['closure', 'Kapanış'],
                ] as const
              ).map(([key, name]) => {
                const component = data.summary.qualityComponents[key];
                return (
                  <div className="performance-quality-row" key={key}>
                    <div>
                      <span>{name}</span>
                      <strong>
                        <AnimatedValue
                          value={component.averageScore}
                          format={(value) => metricValue(value, 'averageQualityScore')}
                        />
                      </strong>
                    </div>
                    <PerformanceBar value={component.averageScore} maximum={100} />
                    <small>{count(component.scoreCount)} değerlendirme</small>
                  </div>
                );
              })}
            </section>
          </div>
          {data.summary.totalCalls === 0 && (
            <p className="performance-note">
              Seçili dönemde çağrı yok. Tüm zamanlar sütunu aynı temsilcinin tarih sınırı olmayan
              kayıtlarını gösterir.
            </p>
          )}
          <p className="performance-note">
            {count(data.summary.unknownResultCalls)} sonucu belirsiz çağrı ·{' '}
            {count(data.summary.coverage.reachedWithoutDurationCalls)} ulaşılan çağrıda geçerli süre
            yok · {count(data.summary.coverage.withoutUsableQualityCalls)} çağrıda toplam kalite
            puanı yok
            {data.undatedCallsExcluded > 0 &&
              ` · ${count(data.undatedCallsExcluded)} tarihsiz çağrı dönem filtresi dışında`}
            .
          </p>
        </div>
      )}
    </div>
  );
}
