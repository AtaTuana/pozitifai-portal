import type { NodeKind, Plan, PlanEdge, PlanNode, Position } from '../../api/types';

export const kindLabels: Record<NodeKind, string> = {
  team: 'Takım',
  campaign: 'Kampanya',
  agent: 'Temsilci',
};
export const kindPlurals: Record<NodeKind, string> = {
  team: 'Takımlar',
  campaign: 'Kampanyalar',
  agent: 'Temsilciler',
};

/** The same relationship rules are enforced again by Django before a draft is saved. */
export function canConnect(plan: Plan, source: string, target: string) {
  const a = plan.nodes.find((node) => node.id === source),
    b = plan.nodes.find((node) => node.id === target);
  return (
    !!a &&
    !!b &&
    a.kind === 'team' &&
    b.kind !== 'team' &&
    !plan.edges.some((edge) => edge.source === source && edge.target === target) &&
    !(b.kind === 'agent' && plan.edges.some((edge) => edge.target === target))
  );
}

export function edgeId(edge: PlanEdge) {
  return `${edge.source}:${edge.target}`;
}

export function initialPositions(nodes: PlanNode[]): Record<string, Position> {
  const counts = { team: 0, campaign: 0, agent: 0 };
  return Object.fromEntries(
    nodes.map((node) => [
      node.id,
      {
        x: node.kind === 'team' ? 40 : node.kind === 'campaign' ? 340 : 640,
        y: 50 + counts[node.kind]++ * 145,
      },
    ]),
  );
}

export function readPositions(userId: string, nodes: PlanNode[]) {
  const defaults = initialPositions(nodes);
  try {
    const cached = JSON.parse(localStorage.getItem(`pozitifai.layout.${userId}`) || '{}');
    for (const node of nodes) {
      const p = cached[node.id];
      if (
        p &&
        Number.isFinite(p.x) &&
        Number.isFinite(p.y) &&
        Math.abs(p.x) < 10000 &&
        Math.abs(p.y) < 10000
      )
        defaults[node.id] = p;
    }
  } catch {
    /* A corrupt preference cannot prevent the editor from opening. */
  }
  return defaults;
}
