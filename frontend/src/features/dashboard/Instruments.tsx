import { useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { count, decimal, score, stopwatch } from './format';
import { useInstrument } from './motion';
import type { Metrics } from './types';

type NumberFormat = (value: number) => string;

export function AnimatedValue({
  value,
  format = count,
  className = '',
}: {
  value: number | null;
  format?: NumberFormat;
  className?: string;
}) {
  const element = useRef<HTMLSpanElement>(null);
  useInstrument([value ?? 0], ([current]) => {
    if (element.current) element.current.textContent = value === null ? '—' : format(current);
  });
  return (
    <>
      <span ref={element} className={className} aria-hidden="true" />
      <span className="sr-only">{value === null ? 'Veri yok' : format(value)}</span>
    </>
  );
}

export function Widget({
  title,
  className,
  children,
  aside,
}: {
  title: string;
  className: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  const id = useId();
  return (
    <section className={`kpi-widget ${className}`} aria-labelledby={id}>
      <header className="kpi-widget-heading">
        <h2 id={id}>{title}</h2>
        {aside}
      </header>
      {children}
    </section>
  );
}

/** The full track is the stated denominator. Only the measured fraction advances. */
export function RatioWidget({
  kind,
  numerator,
  denominator,
  rate,
  unknown = 0,
}: {
  kind: 'reach' | 'conversion';
  numerator: number | null;
  denominator: number | null;
  rate: number | null;
  unknown?: number;
}) {
  const arc = useRef<SVGCircleElement>(null);
  const pointer = useRef<SVGGElement>(null);
  const reach = kind === 'reach';
  useInstrument([rate ?? 0], ([value]) => {
    const fraction = Math.max(0, Math.min(100, value));
    arc.current?.setAttribute('stroke-dasharray', `${fraction * 0.82} 100`);
    pointer.current?.setAttribute('transform', `rotate(${122.4 + fraction * 2.952} 120 120)`);
  });
  return (
    <Widget title={reach ? 'Ulaşma oranı' : 'Dönüşüm oranı'} className={`kpi-${kind}`}>
      <div className="ratio-instrument">
        <svg viewBox="0 0 240 240" aria-hidden="true">
          {Array.from({ length: 49 }, (_, index) => (
            <line
              key={index}
              x1="212"
              x2={index % 4 === 0 ? '220' : '216'}
              y1="120"
              y2="120"
              transform={`rotate(${122.4 + index * 6.15} 120 120)`}
              className="instrument-tick"
            />
          ))}
          <circle
            cx="120"
            cy="120"
            r="78"
            pathLength="100"
            strokeDasharray="82 100"
            transform="rotate(122.4 120 120)"
            className="ratio-track"
          />
          <circle
            ref={arc}
            cx="120"
            cy="120"
            r="78"
            pathLength="100"
            strokeDasharray="0 100"
            transform="rotate(122.4 120 120)"
            className="ratio-arc"
          />
          <circle
            cx="120"
            cy="120"
            r="66"
            pathLength="100"
            strokeDasharray="82 100"
            transform="rotate(122.4 120 120)"
            className="ratio-inner"
          />
          <g ref={pointer}>
            <circle cx="198" cy="120" r="4" className="ratio-tip" opacity={rate === null ? 0 : 1} />
          </g>
        </svg>
        <div className="ratio-readout">
          <div>
            <AnimatedValue value={rate} format={decimal} />
            {rate !== null && <span className="ratio-unit">%</span>}
          </div>
          <span className="instrument-caption">{reach ? 'ulaşma' : 'dönüşüm'}</span>
        </div>
      </div>
      <div className="ratio-legend">
        <div>
          <span className="legend-label">
            <i className="legend-swatch" />
            {reach ? 'Ulaşılan çağrı' : 'Satış'}
          </span>
          <strong>
            <AnimatedValue value={numerator} />
          </strong>
        </div>
        <div>
          <span className="legend-label">
            <i className="legend-swatch is-secondary" />
            {reach ? 'Toplam çağrı' : 'Ulaşılan çağrı'}
          </span>
          <strong>
            <AnimatedValue value={denominator} />
          </strong>
        </div>
      </div>
      {unknown > 0 && <p className="kpi-note">{count(unknown)} çağrının sonucu belirsiz.</p>}
    </Widget>
  );
}

export function TotalWidget({ metrics }: { metrics: Metrics | null }) {
  const reached = useRef<HTMLSpanElement>(null);
  const unreachable = useRef<HTMLSpanElement>(null);
  const unknown = useRef<HTMLSpanElement>(null);
  const total = metrics?.totalCalls ?? 0;
  useInstrument(
    [
      total ? (metrics!.reachedCalls / total) * 100 : 0,
      total ? (metrics!.unreachableCalls / total) * 100 : 0,
      total ? (metrics!.unknownResultCalls / total) * 100 : 0,
    ],
    ([a, b, c]) => {
      reached.current?.setAttribute('style', `transform:scaleX(${Math.max(0, a) / 100})`);
      unreachable.current?.setAttribute(
        'style',
        `left:${a}%;transform:scaleX(${Math.max(0, b) / 100})`,
      );
      unknown.current?.setAttribute(
        'style',
        `left:${a + b}%;transform:scaleX(${Math.max(0, c) / 100})`,
      );
    },
  );
  return (
    <Widget title="Toplam çağrı" className="kpi-total">
      <div className="total-readout">
        <AnimatedValue value={metrics?.totalCalls ?? null} />
      </div>
      <span className="instrument-caption">benzersiz çağrı</span>
      <div className="total-distribution" aria-hidden="true">
        <span ref={reached} />
        <span ref={unreachable} />
        <span ref={unknown} />
      </div>
      <dl className="total-breakdown">
        <div>
          <dt>Ulaşılan</dt>
          <dd>
            <AnimatedValue value={metrics?.reachedCalls ?? null} />
          </dd>
        </div>
        <div>
          <dt>Ulaşılamayan</dt>
          <dd>
            <AnimatedValue value={metrics?.unreachableCalls ?? null} />
          </dd>
        </div>
        {!!metrics?.unknownResultCalls && (
          <div>
            <dt>Sonucu belirsiz</dt>
            <dd>
              <AnimatedValue value={metrics.unknownResultCalls} />
            </dd>
          </div>
        )}
      </dl>
    </Widget>
  );
}

export function DurationWidget({ metrics }: { metrics: Metrics | null }) {
  const seconds = metrics?.averageTalkSeconds ?? null;
  const hand = useRef<SVGGElement>(null);
  useInstrument([seconds ?? 0], ([value]) => {
    hand.current?.setAttribute('transform', `rotate(${value * 6} 30 37)`);
  });
  return (
    <Widget title="Ortalama konuşma süresi" className="kpi-duration">
      <div className="duration-readout">
        <svg viewBox="0 0 60 68" className="stopwatch-icon" aria-hidden="true">
          <path d="M24 5h12M30 5v8M46 17l5-5" className="stopwatch-line" />
          <circle cx="30" cy="37" r="23" className="stopwatch-line" />
          <g ref={hand}>
            <path d="M30 37V21" className="stopwatch-hand" />
          </g>
          <circle cx="30" cy="37" r="2" className="stopwatch-dot" />
        </svg>
        <div className="duration-time">
          <AnimatedValue value={seconds} format={stopwatch} />
          <span className="instrument-caption">saat : dakika : saniye</span>
        </div>
      </div>
      <div className="duration-footer">
        <span>
          <AnimatedValue value={seconds} format={decimal} /> sn
        </span>
        <span>{metrics ? `${count(metrics.basis.talkDurationCount)} geçerli süre` : '—'}</span>
      </div>
      {!!metrics?.coverage.reachedWithoutDurationCalls && (
        <p className="kpi-note">
          {count(metrics.coverage.reachedWithoutDurationCalls)} ulaşılan çağrının süresi hesap
          dışında.
        </p>
      )}
    </Widget>
  );
}

function QualityPart({
  label,
  value,
  samples,
}: {
  label: string;
  value: number | null;
  samples: number;
}) {
  const bar = useRef<HTMLSpanElement>(null);
  useInstrument([value ?? 0], ([current]) => {
    if (bar.current)
      bar.current.style.transform = `scaleX(${Math.max(0, Math.min(100, current)) / 100})`;
  });
  return (
    <div className="quality-part" title={`${count(samples)} geçerli değerlendirme`}>
      <div>
        <span className="quality-part-value">
          <AnimatedValue value={value} format={score} />
          <small>/10</small>
        </span>
        <span>{label}</span>
      </div>
      <span className="quality-meter" aria-hidden="true">
        <span ref={bar} />
      </span>
    </div>
  );
}

export function QualityWidget({ metrics }: { metrics: Metrics | null }) {
  const parts = metrics?.qualityComponents;
  return (
    <Widget title="Ortalama kalite puanı" className="kpi-quality">
      <div className="quality-body">
        <div className="quality-main">
          <div>
            <AnimatedValue value={metrics?.averageQualityScore ?? null} format={score} />
            <span>/10</span>
          </div>
          <span className="instrument-caption">
            {metrics ? `${count(metrics.basis.qualityScoreCount)} değerlendirme` : '—'}
          </span>
        </div>
        <div className="quality-parts">
          <QualityPart
            label="Selamlama"
            value={parts?.greeting.averageScore ?? null}
            samples={parts?.greeting.scoreCount ?? 0}
          />
          <QualityPart
            label="İhtiyaç analizi"
            value={parts?.needAnalysis.averageScore ?? null}
            samples={parts?.needAnalysis.scoreCount ?? 0}
          />
          <QualityPart
            label="Kapanış"
            value={parts?.closure.averageScore ?? null}
            samples={parts?.closure.scoreCount ?? 0}
          />
        </div>
      </div>
    </Widget>
  );
}
