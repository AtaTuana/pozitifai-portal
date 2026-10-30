export type Role = 'admin' | 'manager' | 'captain';
export type PortalUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  roleLabel: string;
  teamId: string | null;
  active: boolean;
  createdAt: string;
  createdBy: string | null;
  capabilities: { manage: boolean; upload: boolean; allTeams: boolean };
};
export type Session = { user: PortalUser | null; csrf: string; needsSetup?: boolean };
export type NodeKind = 'team' | 'campaign' | 'agent';
export type PlanNode = { id: string; kind: NodeKind; name: string; code: string };
export type PlanEdge = { source: string; target: string };
export type Plan = { nodes: PlanNode[]; edges: PlanEdge[]; revision: number };
export type Position = { x: number; y: number };
export type View =
  'workspace' | 'planning' | 'agents' | 'users' | 'activity' | 'profile' | 'imports' | 'rejections';
