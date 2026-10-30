import { useId } from 'react';
import type { Plan, PortalUser } from '../../api/types';
import type { DashboardFilters as Filters } from './types';

export function DashboardFilters({
  plan,
  user,
  value,
  change,
  reset,
  error,
}: {
  plan: Plan;
  user: PortalUser;
  value: Filters;
  change: (next: Filters) => void;
  reset: () => void;
  error: string;
}) {
  const id = useId();
  const teams = plan.nodes.filter((node) => node.kind === 'team');
  const selectedTeam = teams.find((team) => team.code === value.teamId);
  const members = new Set(
    plan.edges.filter((edge) => edge.source === selectedTeam?.id).map((edge) => edge.target),
  );
  const agents = plan.nodes.filter(
    (node) => node.kind === 'agent' && (!value.teamId || members.has(node.id)),
  );
  return (
    <form
      className="dashboard-filters"
      onSubmit={(event) => event.preventDefault()}
      aria-label="Rapor filtreleri"
    >
      <label htmlFor={`${id}-team`}>
        <span>Takım</span>
        <select
          id={`${id}-team`}
          value={value.teamId}
          disabled={!user.capabilities.allTeams}
          onChange={(event) => change({ ...value, teamId: event.target.value, agentId: '' })}
        >
          {user.capabilities.allTeams && <option value="">Tüm takımlar</option>}
          {!user.capabilities.allTeams && !selectedTeam && (
            <option value={value.teamId}>Takımım</option>
          )}
          {teams.map((team) => (
            <option key={team.id} value={team.code}>
              {team.name}
            </option>
          ))}
        </select>
      </label>
      <label htmlFor={`${id}-agent`}>
        <span>Temsilci</span>
        <select
          id={`${id}-agent`}
          value={value.agentId}
          onChange={(event) => change({ ...value, agentId: event.target.value })}
        >
          <option value="">Tüm temsilciler</option>
          {agents.map((agent) => (
            <option key={agent.id} value={agent.code}>
              {agent.name}
            </option>
          ))}
        </select>
      </label>
      <label htmlFor={`${id}-from`}>
        <span>Başlangıç</span>
        <input
          id={`${id}-from`}
          type="date"
          min="1900-01-01"
          max={value.dateTo || '9999-12-30'}
          value={value.dateFrom}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(event) => change({ ...value, dateFrom: event.target.value })}
        />
      </label>
      <label htmlFor={`${id}-to`}>
        <span>Bitiş</span>
        <input
          id={`${id}-to`}
          type="date"
          min={value.dateFrom || '1900-01-01'}
          max="9999-12-30"
          value={value.dateTo}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(event) => change({ ...value, dateTo: event.target.value })}
        />
      </label>
      <button type="button" className="dashboard-reset" onClick={reset}>
        Sıfırla
      </button>
      {error && (
        <p id={`${id}-error`} className="dashboard-filter-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
