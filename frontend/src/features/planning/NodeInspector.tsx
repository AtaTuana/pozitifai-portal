import type { Plan, PlanNode } from '../../api/types';
import { kindLabels } from './planModel';

export function NodeInspector({
  node,
  plan,
  editable,
  onChange,
  onEdges,
  onRemove,
}: {
  node?: PlanNode;
  plan: Plan;
  editable: boolean;
  onChange: (node: PlanNode) => void;
  onEdges: (sources: string[]) => void;
  onRemove: () => void;
}) {
  if (!node)
    return (
      <aside className="node-inspector">
        <h2>Özellikler</h2>
        <p className="muted">Düzenlemek veya bağlantılarını görmek için bir kayıt seç.</p>
        <div className="inspector-divider" />
        <p className="relationship-guide">
          Takım → Kampanya
          <br />
          Takım → Temsilci
        </p>
      </aside>
    );
  const sources = plan.edges.filter((edge) => edge.target === node.id).map((edge) => edge.source);
  const teams = plan.nodes.filter((item) => item.kind === 'team');
  return (
    <aside className="node-inspector" aria-label="Kayıt özellikleri">
      <p className="eyebrow">{kindLabels[node.kind]}</p>
      <h2>{node.name || 'Adsız kayıt'}</h2>
      <label htmlFor="record-name">Görünen ad</label>
      <input
        id="record-name"
        value={node.name}
        maxLength={100}
        disabled={!editable}
        onChange={(event) => onChange({ ...node, name: event.target.value })}
      />
      <label htmlFor="record-code">Kayıt kodu</label>
      <input
        id="record-code"
        value={node.code}
        maxLength={40}
        disabled={!editable}
        onChange={(event) => onChange({ ...node, code: event.target.value.toUpperCase() })}
      />
      <div className="inspector-divider" />
      {node.kind === 'agent' && (
        <>
          <label htmlFor="record-team">Bağlı takım</label>
          <select
            id="record-team"
            value={sources[0] || ''}
            disabled={!editable}
            onChange={(event) => onEdges(event.target.value ? [event.target.value] : [])}
          >
            <option value="">Atanmamış</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
          <p className="hint">Temsilci için giriş hesabı oluşturulmaz.</p>
        </>
      )}
      {node.kind === 'campaign' && (
        <fieldset className="scope-options">
          <legend>Bağlı takımlar</legend>
          {teams.length ? (
            teams.map((team) => (
              <label key={team.id} className="check-row">
                <input
                  type="checkbox"
                  checked={sources.includes(team.id)}
                  disabled={!editable}
                  onChange={(event) =>
                    onEdges(
                      event.target.checked
                        ? [...sources, team.id]
                        : sources.filter((id) => id !== team.id),
                    )
                  }
                />
                <span>{team.name}</span>
              </label>
            ))
          ) : (
            <p className="muted">Önce bir takım oluştur.</p>
          )}
        </fieldset>
      )}
      {node.kind === 'team' && (
        <div className="linked-list">
          <h3>Bağlı kayıtlar</h3>
          {plan.edges
            .filter((edge) => edge.source === node.id)
            .map((edge) => {
              const target = plan.nodes.find((item) => item.id === edge.target)!;
              return (
                <div key={target.id}>
                  <span>{target.name}</span>
                  <small>{kindLabels[target.kind]}</small>
                </div>
              );
            })}
          {!plan.edges.some((edge) => edge.source === node.id) && (
            <p className="muted">Henüz bağlantı yok.</p>
          )}
        </div>
      )}
      {editable && (
        <button className="outline-button inspector-remove" onClick={onRemove}>
          Kaydı kaldır
        </button>
      )}
    </aside>
  );
}
