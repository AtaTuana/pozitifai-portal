import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Icon } from '../../components/ui/Icon';
import type { DateSelection } from './types';

const weekdays = ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pa'];
function localDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}
function stamp(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

/** ReportGuerilla's range calendar, adapted to the portal's shared glass and theme tokens. */
export function DateRangeCalendar({
  value,
  onChange,
  latest,
}: {
  value: DateSelection;
  onChange: (value: DateSelection) => void;
  latest: string | null;
}) {
  const [month, setMonth] = useState(() => new Date());
  const [choosingEnd, setChoosingEnd] = useState(false);
  const [focusDate, setFocusDate] = useState('');
  const browsed = useRef(false);
  const grid = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (latest && !browsed.current) {
      setMonth(localDate(latest));
      setFocusDate(latest);
    }
  }, [latest]);
  const year = month.getFullYear(),
    index = month.getMonth();
  const days = new Date(year, index + 1, 0).getDate();
  const offset = (new Date(year, index, 1).getDay() + 6) % 7;
  const today = stamp(new Date());
  const moveMonth = (delta: number) => {
    browsed.current = true;
    const next = new Date(year, index + delta, 1, 12);
    if (next.getFullYear() < 100 || next.getFullYear() > 9998) return;
    setMonth(next);
    setFocusDate(stamp(next));
  };
  const select = (date: string) => {
    browsed.current = true;
    setFocusDate(date);
    if (choosingEnd && value.mode === 'range') {
      onChange({
        mode: 'range',
        from: date < value.from ? date : value.from,
        to: date > value.from ? date : value.from,
      });
      setChoosingEnd(false);
    } else {
      onChange({ mode: 'range', from: date, to: date });
      setChoosingEnd(true);
    }
  };
  const keyboard = (event: KeyboardEvent, date: string) => {
    const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key];
    if (delta === undefined) return;
    event.preventDefault();
    const next = localDate(date);
    next.setDate(next.getDate() + delta);
    if (next.getFullYear() < 100 || next.getFullYear() > 9998) return;
    const target = stamp(next);
    browsed.current = true;
    setMonth(next);
    setFocusDate(target);
    requestAnimationFrame(() =>
      grid.current?.querySelector<HTMLButtonElement>(`[data-date="${target}"]`)?.focus(),
    );
  };
  const monthLabel = month.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
  return (
    <div className="rejection-calendar">
      <div className="rejection-period" aria-label="Analiz dönemi">
        <button
          type="button"
          aria-pressed={value.mode === 'all'}
          onClick={() => {
            onChange({ ...value, mode: 'all' });
            setChoosingEnd(false);
          }}
        >
          Tüm zamanlar
        </button>
        <button
          type="button"
          aria-pressed={value.mode === 'range'}
          onClick={() => {
            const initial = value.from || latest || today;
            onChange({ mode: 'range', from: initial, to: value.to || initial });
          }}
        >
          Tarih aralığı
        </button>
      </div>
      <div className="rejection-calendar-heading">
        <button
          type="button"
          className="icon-button is-back"
          aria-label="Önceki ay"
          onClick={() => moveMonth(-1)}
        >
          <Icon name="chevron" />
        </button>
        <strong aria-live="polite">{monthLabel}</strong>
        <button
          type="button"
          className="icon-button"
          aria-label="Sonraki ay"
          onClick={() => moveMonth(1)}
        >
          <Icon name="chevron" />
        </button>
      </div>
      <div className="rejection-weekdays" aria-hidden="true">
        {weekdays.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="rejection-days" ref={grid} role="group" aria-label={`${monthLabel} günleri`}>
        {Array.from({ length: offset }, (_, i) => (
          <span key={`empty-${i}`} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const date = stamp(new Date(year, index, i + 1, 12));
          const inRange = value.mode === 'range' && date >= value.from && date <= value.to;
          const edge = inRange && (date === value.from || date === value.to);
          const roving = focusDate.startsWith(`${year}-${String(index + 1).padStart(2, '0')}`)
            ? focusDate === date
            : i === 0;
          return (
            <button
              key={date}
              type="button"
              data-date={date}
              data-in-range={inRange}
              data-edge={edge}
              aria-pressed={inRange}
              aria-current={date === today ? 'date' : undefined}
              aria-label={localDate(date).toLocaleDateString('tr-TR', { dateStyle: 'full' })}
              tabIndex={roving ? 0 : -1}
              onKeyDown={(event) => keyboard(event, date)}
              onClick={() => select(date)}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
      {value.mode === 'range' && (
        <div className="rejection-date-fields">
          <label>
            Başlangıç
            <input
              type="date"
              value={value.from}
              max="9998-12-31"
              onChange={(event) => {
                setChoosingEnd(false);
                onChange({ ...value, from: event.target.value });
                if (event.target.value) setMonth(localDate(event.target.value));
              }}
            />
          </label>
          <span aria-hidden="true">—</span>
          <label>
            Bitiş
            <input
              type="date"
              value={value.to}
              max="9998-12-31"
              onChange={(event) => {
                setChoosingEnd(false);
                onChange({ ...value, to: event.target.value });
              }}
            />
          </label>
        </div>
      )}
      <p className="rejection-calendar-hint" aria-live="polite">
        {value.mode === 'all'
          ? 'Tarih sınırı olmadan'
          : choosingEnd
            ? 'Bitiş gününü seç · Tek gün için aynı güne dokun'
            : 'Başlangıç ve bitiş günleri dahil'}
      </p>
    </div>
  );
}
