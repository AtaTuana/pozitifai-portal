import type { AgentRow, MetricKey, SortKey } from './types';
import { AnimatedValue } from '../dashboard/Instruments';
import { Icon } from '../../components/ui/Icon';
import { AgentAvatar, PerformanceBar, useRowMotion } from './PerformanceVisuals';
import { dateLabel, metricLabels, metricValue, rankAgents, sample } from './presentation';

export function AgentComparison({
  rows,
  allRows,
  sort,
  metric,
  ascending,
  disabled,
  onOpen,
}: {
  rows: AgentRow[];
  allRows: AgentRow[];
  sort: SortKey;
  metric: MetricKey;
  ascending: boolean;
  disabled: boolean;
  onOpen: (agent: AgentRow) => void;
}) {
  const list = useRowMotion(rows.map((row) => row.id).join('|'));
  const maximum = ['reachRate', 'conversionRate', 'averageQualityScore'].includes(metric)
    ? 100
    : Math.max(1, ...allRows.map((row) => row.metrics[metric] ?? 0));
  const ranks = rankAgents(allRows, metric, ascending);
  return (
    <div ref={list} className="performance-list" aria-label="Temsilci karşılaştırması">
      {rows.map((agent) => (
        <button
          key={agent.id}
          data-agent={agent.id}
          type="button"
          className="performance-row"
          disabled={disabled}
          onClick={() => onOpen(agent)}
          aria-label={`${agent.name}. ${metricLabels[metric]}: ${metricValue(agent.metrics[metric], metric)}. ${sample(agent.metrics, metric)}. Performans detayını aç.`}
        >
          <span className="performance-rank" aria-label={sort !== 'name' ? 'Sıra' : undefined}>
            {sort === 'name' ? <Icon name="agent" /> : (ranks.get(agent.id) ?? '—')}
          </span>
          <AgentAvatar name={agent.name} />
          <span className="performance-person">
            <strong>{agent.name}</strong>
            <span>
              {agent.team?.name || 'Takım atanmamış'}
              {!agent.active && ' · Pasif'}
            </span>
            <small>İşe başlama · {dateLabel(agent.startDate)}</small>
          </span>
          <span className="performance-row-chart">
            <PerformanceBar value={agent.metrics[metric]} maximum={maximum} />
            <small>{sample(agent.metrics, metric)}</small>
          </span>
          <span className="performance-row-value">
            <AnimatedValue
              value={agent.metrics[metric]}
              format={(value) => metricValue(value, metric)}
            />
          </span>
          <span className="performance-open">
            <Icon name="chevron" />
          </span>
        </button>
      ))}
    </div>
  );
}
