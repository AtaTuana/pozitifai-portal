export type Category = { id: number; name: string };
export type RejectionRecord = {
  callId: string;
  agentName: string;
  campaignName: string;
  startedAt: string | null;
  analyzed: boolean;
  categoryIds: number[];
};
export type RejectionOverview = {
  records: RejectionRecord[];
  categories: Category[];
  dateBounds: { first: string | null; last: string | null };
  missingTranscripts: number;
  undatedTranscripts: number;
  canAnalyze: boolean;
  providerConfigured: boolean;
  model: string;
};
export type TranscriptDetail = RejectionRecord & {
  turns: { speaker: 'agent' | 'customer' | 'unknown'; content: string }[];
};
export type DateSelection = { mode: 'all' | 'range'; from: string; to: string };
export type AnalysisResult = Pick<RejectionRecord, 'callId' | 'analyzed' | 'categoryIds'> & {
  cached: boolean;
};
