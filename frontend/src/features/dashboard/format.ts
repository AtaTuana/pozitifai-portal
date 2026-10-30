const integerFormat = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 });
const decimalFormat = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 });

export const count = (value: number) => integerFormat.format(Math.max(0, value));
export const decimal = (value: number) => decimalFormat.format(Math.max(0, value));
export const percentage = (value: number | null) => (value === null ? '—' : `%${decimal(value)}`);
export const score = (value: number | null) => (value === null ? '—' : decimal(value / 10));
export const hourLabel = (hour: number) => String(hour).padStart(2, '0');

/** Rounded elapsed time, never a ticking clock or a time-of-day conversion. */
export function stopwatch(seconds: number | null) {
  if (seconds === null) return '—:—:—';
  const whole = Math.max(0, Math.round(seconds));
  return [Math.floor(whole / 3600), Math.floor(whole / 60) % 60, whole % 60]
    .map((part) => String(part).padStart(2, '0'))
    .join(':');
}
