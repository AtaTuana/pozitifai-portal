import type { AgentRow, MetricKey, SortKey } from './types';
import type { Metrics } from '../dashboard/types';

export const metricLabels: Record<MetricKey, string> = {
  salesCalls: 'Satış',
  totalCalls: 'Toplam çağrı',
  reachRate: 'Ulaşma oranı',
  conversionRate: 'Dönüşüm oranı',
  averageQualityScore: 'Ortalama kalite',
  averageTalkSeconds: 'Ortalama konuşma',
};
const integer = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 });
const names = new Intl.Collator('tr', { sensitivity: 'base', numeric: true });
export const count = (value: number) => integer.format(value);
export function metricValue(value: number | null, key: MetricKey) {
  if (value === null) return '—';
  if (key === 'reachRate' || key === 'conversionRate') return `%${decimal.format(value)}`;
  if (key === 'averageQualityScore') return `${decimal.format(value)} / 100`;
  if (key === 'averageTalkSeconds') return `${decimal.format(value)} sn`;
  return count(value);
}
export function sample(metrics: Metrics, key: MetricKey) {
  if (key === 'averageQualityScore')
    return `${count(metrics.basis.qualityScoreCount)} değerlendirme`;
  if (key === 'averageTalkSeconds') return `${count(metrics.basis.talkDurationCount)} geçerli süre`;
  if (key === 'conversionRate')
    return `${count(metrics.salesCalls)} satış / ${count(metrics.reachedCalls)} ulaşılan`;
  if (key === 'reachRate')
    return `${count(metrics.reachedCalls)} ulaşılan / ${count(metrics.totalCalls)} çağrı`;
  return `${count(metrics.reachedCalls)} ulaşılan çağrı`;
}
export function dateLabel(value: string | null) {
  if (!value) return 'Tarih belirtilmemiş';
  const [year, month, day] = value.split('-');
  return `${day}.${month}.${year}`;
}
export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return [parts[0]?.[0], parts.length > 1 ? parts.at(-1)?.[0] : '']
    .join('')
    .toLocaleUpperCase('tr');
}

/** Missing metrics stay last in both directions; equal values use stable Turkish name order. */
export function orderAgents(rows: AgentRow[], sort: SortKey, ascending: boolean) {
  return [...rows].sort((a, b) => {
    const fallback = names.compare(a.name, b.name) || a.id.localeCompare(b.id);
    if (sort === 'name') return ascending ? fallback : -fallback;
    const left = a.metrics[sort],
      right = b.metrics[sort];
    if (left === null || right === null) return left === right ? fallback : left === null ? 1 : -1;
    return (left - right) * (ascending ? 1 : -1) || fallback;
  });
}

/** Competition ranking gives equal results the same position (1, 1, 3). */
export function rankAgents(rows: AgentRow[], metric: MetricKey, ascending: boolean) {
  const ordered = orderAgents(rows, metric, ascending);
  const ranks = new Map<string, number | null>();
  let rank = 0;
  ordered.forEach((row, index) => {
    const value = row.metrics[metric];
    if (index === 0 || value !== ordered[index - 1].metrics[metric]) rank = index + 1;
    ranks.set(row.id, value === null ? null : rank);
  });
  return ranks;
}
