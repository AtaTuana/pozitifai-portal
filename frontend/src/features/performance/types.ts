import type { Metrics } from '../dashboard/types';

export type AgentIdentity = {
  id: string;
  name: string;
  startDate: string | null;
  active: boolean;
  team: { id: string; name: string } | null;
};
export type AgentRow = AgentIdentity & { metrics: Metrics };
type ReportBase = {
  generatedAt: string;
  summary: Metrics;
  undatedCallsExcluded: number;
};
export type AgentReport = ReportBase & { agents: AgentRow[] };
export type AgentDetail = ReportBase & {
  agent: AgentIdentity;
  allTime: Metrics;
  hourly: { hour: number; metrics: Metrics }[];
};
export type MetricKey =
  | 'salesCalls'
  | 'totalCalls'
  | 'reachRate'
  | 'conversionRate'
  | 'averageQualityScore'
  | 'averageTalkSeconds';
export type SortKey = 'name' | MetricKey;
