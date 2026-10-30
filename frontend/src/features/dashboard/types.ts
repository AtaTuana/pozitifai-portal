/** The dashboard consumes server-calculated metrics; it only formats their presentation. */
export type QualityComponent = {
  averageScore: number | null;
  scoreCount: number;
  scoreSum: string;
};

export type Metrics = {
  totalCalls: number;
  reachedCalls: number;
  unreachableCalls: number;
  salesCalls: number;
  unknownResultCalls: number;
  reachRate: number | null;
  conversionRate: number | null;
  averageTalkSeconds: number | null;
  averageQualityScore: number | null;
  qualityComponents: {
    greeting: QualityComponent;
    needAnalysis: QualityComponent;
    closure: QualityComponent;
  };
  basis: {
    talkDurationCount: number;
    qualityScoreCount: number;
  };
  coverage: {
    undatedCalls: number;
    unknownAgentCalls: number;
    reachedWithoutDurationCalls: number;
    withoutUsableQualityCalls: number;
  };
};

export type KpiReport = {
  generatedAt: string;
  summary: Metrics;
  dateCoverage: { undatedCallsExcluded: number };
  breakdown: {
    excludedCalls: number;
    rows: { dimensions: { hour: number }; metrics: Metrics }[];
  };
};

export type DashboardFilters = {
  teamId: string;
  agentId: string;
  dateFrom: string;
  dateTo: string;
};

export type HourDatum = {
  hour: number;
  total: number;
  reached: number;
  rate: number | null;
};
