import { useRef, useState } from 'react';
import { count, hourLabel, percentage } from './format';
import { AnimatedValue, Widget } from './Instruments';
import { useInstrument } from './motion';
import type { HourDatum, KpiReport } from './types';

/** Include the expected 09–18 range plus observed outside hours; no dated calls disappear. */
function hoursFor(report: KpiReport | null): HourDatum[] {
  const rows = report?.breakdown.rows ?? [];
  const first = Math.min(9, ...rows.map((row) => row.dimensions.hour));
  const last = Math.max(18, ...rows.map((row) => row.dimensions.hour));
  const byHour = new Map(rows.map((row) => [row.dimensions.hour, row.metrics]));
  return Array.from({ length: last - first + 1 }, (_, index) => {
    const hour = first + index;
    const data = byHour.get(hour);
    return {
      hour,
      total: data?.totalCalls ?? 0,
      reached: data?.reachedCalls ?? 0,
      rate: data?.reachRate ?? null,
    };
  });
}

function HourSpoke({
  datum,
  angle,
  maximum,
  active,
}: {
  datum: HourDatum;
  angle: number;
  maximum: number;
  active: boolean;
}) {
  const total = useRef<SVGLineElement>(null);
  const reached = useRef<SVGLineElement>(null);
  useInstrument(
    [maximum ? datum.total / maximum : 0, maximum ? datum.reached / maximum : 0],
    ([a, b]) => {
      total.current?.setAttribute('y2', String(114 - Math.max(0, a) * 61));
      reached.current?.setAttribute('y2', String(114 - Math.max(0, b) * 61));
    },
  );
  return (
    <g
      transform={`rotate(${angle} 180 180)`}
      className={active ? 'hour-spoke is-selected' : 'hour-spoke'}
    >
      <line x1="176" y1="114" x2="176" y2="53" className="hour-spoke-guide" />
      <line x1="184" y1="114" x2="184" y2="53" className="hour-spoke-guide" />
      <line ref={total} x1="176" y1="114" x2="176" y2="114" className="hour-spoke-total" />
      <line ref={reached} x1="184" y1="114" x2="184" y2="114" className="hour-spoke-reached" />
    </g>
  );
}

function HourRow({
  datum,
  maximum,
  selected,
  select,
}: {
  datum: HourDatum;
  maximum: number;
  selected: boolean;
  select: () => void;
}) {
  const total = useRef<HTMLSpanElement>(null);
  const reached = useRef<HTMLSpanElement>(null);
  useInstrument(
    [maximum ? datum.total / maximum : 0, maximum ? datum.reached / maximum : 0],
    ([a, b]) => {
      if (total.current) total.current.style.transform = `scaleX(${Math.max(0, a)})`;
      if (reached.current) reached.current.style.transform = `scaleX(${Math.max(0, b)})`;
    },
  );
  return (
    <button
      type="button"
      className={`hour-row${selected ? ' is-selected' : ''}`}
      onClick={select}
      onMouseEnter={select}
      onFocus={select}
      aria-pressed={selected}
      aria-label={`${hourLabel(datum.hour)}:00, ${count(datum.total)} çağrı, ${count(datum.reached)} ulaşılan, ulaşma oranı ${percentage(datum.rate)}`}
    >
      <span>{hourLabel(datum.hour)}</span>
      <span className="hour-row-bars" aria-hidden="true">
        <span ref={total} />
        <span ref={reached} />
      </span>
      <span>{count(datum.total)}</span>
      <span>{percentage(datum.rate)}</span>
    </button>
  );
}

export function HourlyWidget({ report }: { report: KpiReport | null }) {
  const hours = hoursFor(report);
  const maximum = Math.max(0, ...hours.map((hour) => hour.total));
  const [selection, setSelection] = useState<number | null>(null);
  const peak = hours.reduce((a, b) => (b.total > a.total ? b : a), hours[0]);
  const active = hours.find((item) => item.hour === selection) ?? peak;
  return (
    <Widget
      title="Saatlik yoğunluk"
      className="kpi-hourly"
      aside={
        <span className="instrument-caption">
          {hourLabel(hours[0].hour)}–{hourLabel(hours[hours.length - 1].hour)}
        </span>
      }
    >
      <div className="hourly-body">
        <div className="hourly-visual">
          <svg viewBox="0 0 360 360" aria-hidden="true">
            <circle cx="180" cy="180" r="59" className="hour-core" />
            <circle cx="180" cy="180" r="65" className="hour-core-dashed" />
            {Array.from({ length: 80 }, (_, index) => (
              <line
                key={index}
                x1="180"
                x2="180"
                y1="42"
                y2={index % 5 === 0 ? '47' : '44'}
                transform={`rotate(${index * 4.5} 180 180)`}
                className="instrument-tick"
              />
            ))}
            {hours.map((datum, index) => {
              const angle = (index * 360) / hours.length;
              const radians = (angle * Math.PI) / 180;
              return (
                <g key={datum.hour}>
                  <HourSpoke
                    datum={datum}
                    maximum={maximum}
                    angle={angle}
                    active={active.hour === datum.hour}
                  />
                  <text
                    x={180 + 154 * Math.sin(radians)}
                    y={180 - 154 * Math.cos(radians)}
                    dy="0.35em"
                    textAnchor="middle"
                    className={`hour-label${active.hour === datum.hour ? ' is-selected' : ''}`}
                  >
                    {hourLabel(datum.hour)}
                  </text>
                </g>
              );
            })}
          </svg>
          <div className="hourly-readout">
            <span className="instrument-caption">{hourLabel(active.hour)}:00</span>
            <strong>
              <AnimatedValue value={report ? active.total : null} />
            </strong>
            <span className="instrument-caption">çağrı</span>
          </div>
          <div className="hourly-selected">
            <span>
              {hourLabel(active.hour)}:00 – {hourLabel(active.hour + 1)}:00
            </span>
            <strong>{report ? percentage(active.rate) : '—'} ulaşma</strong>
          </div>
          <div className="hourly-legend">
            <span className="legend-label">
              <i className="legend-swatch is-secondary" />
              Toplam
            </span>
            <span className="legend-label">
              <i className="legend-swatch" />
              Ulaşılan
            </span>
          </div>
        </div>
        <div className="hourly-list">
          <div className="hour-list-heading">
            <span>Saat</span>
            <span>Çağrı</span>
            <span>Adet</span>
            <span>Ulaşma</span>
          </div>
          {hours.map((datum) => (
            <HourRow
              key={datum.hour}
              datum={datum}
              maximum={maximum}
              selected={active.hour === datum.hour}
              select={() => setSelection(datum.hour)}
            />
          ))}
        </div>
      </div>
      {!!report?.breakdown.excludedCalls && (
        <p className="kpi-note">
          Başlangıç saati bilinmeyen {count(report.breakdown.excludedCalls)} çağrı bu grafiğe dahil
          değil.
        </p>
      )}
    </Widget>
  );
}
