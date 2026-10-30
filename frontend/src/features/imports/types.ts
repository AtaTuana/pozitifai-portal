export type ImportKind = 'calls' | 'quality' | 'transcript' | 'agents';
export type ImportSummary = {
  total?: number;
  accepted?: number;
  duplicate?: number;
  quarantined?: number;
  unmatched?: number;
  uniqueRecords?: number;
  affectedRecords?: number;
  correctedFields?: number;
  undatedCalls?: number;
  unknownAgents?: number;
  unknownResults?: number;
  missingDurations?: number;
  ruleCounts?: Record<string, number>;
  error?: { code: string; message: string };
};
export type ImportBatch = {
  id: number;
  kind: ImportKind;
  filename: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  summary: ImportSummary;
  rulesetVersion: string;
  options: { profile?: string; period?: string[] | null };
  uploadedAt: string;
  uploadedBy: string;
  repeated?: boolean;
};
export type ImportIssue = {
  id: number;
  row: number;
  reference: string;
  status: string;
  code: string;
  ruleTitle: string;
  version: number;
  field: string;
  operation: string;
  message: string;
  before: unknown;
  after: unknown;
  evidence: Record<string, unknown>;
  effect: string;
  createdAt: string;
  actor: string;
  resolvedAt: string | null;
  resolution: string;
};
export type ImportDetail = {
  batch: ImportBatch;
  issues: ImportIssue[];
  page: number;
  totalIssues: number;
  hasMore: boolean;
};
export const kindLabels: Record<ImportKind, string> = {
  calls: 'Çağrılar',
  quality: 'Kalite değerlendirmeleri',
  transcript: 'Transkriptler',
  agents: 'Temsilci kadrosu',
};
export const statusLabels: Record<string, string> = {
  pending: 'Bekliyor',
  processing: 'İşleniyor',
  completed: 'Tamamlandı',
  failed: 'Başarısız',
  accepted: 'Kabul edildi',
  duplicate: 'Tekrar',
  quarantined: 'İnceleme gerekli',
  unmatched: 'Eşleşme bekliyor',
};
