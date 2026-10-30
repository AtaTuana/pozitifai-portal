import { useEffect, useRef, useState } from 'react';
import type { Plan, PortalUser } from '../../api/types';
import { DashboardMotion } from '../dashboard/motion';
import { AnimatedValue } from '../dashboard/Instruments';
import { Icon } from '../../components/ui/Icon';
import type { AgentIdentity, AgentReport, MetricKey, SortKey } from './types';
import { count, dateLabel, metricLabels, orderAgents } from './presentation';
import { usePerformance } from './usePerformance';
import { AgentComparison } from './AgentComparison';
import { AgentProfile } from './AgentProfile';
import './performance.css';

const PAGE_SIZE = 12;

/** Filters live above both views so opening a profile or going back preserves the selection. */
export function PerformancePage({
  plan,
  user,
  campaignId,
  campaignName,
}: {
  plan: Plan;
  user: PortalUser;
  campaignId: string;
  campaignName: string;
}) {
  const [team, setTeam] = useState(user.capabilities.allTeams ? '' : (user.teamId ?? ''));
  const [period, setPeriod] = useState(false);
  const [from, setFrom] = useState(''),
    [to, setTo] = useState('');
  const [sort, setSort] = useState<SortKey>('name'),
    [ascending, setAscending] = useState(true);
  const [search, setSearch] = useState(''),
    [page, setPage] = useState(0);
  const [selected, setSelected] = useState<AgentIdentity | null>(null);
  const [revision, setRevision] = useState(0);
  const restoreFocus = useRef<string | null>(null);
  const listScroll = useRef(0);
  const listScope = useRef<HTMLDivElement>(null);
  const dateError =
    period && !from && !to
      ? 'Başlangıç veya bitiş tarihi seç.'
      : period && from && to && from > to
        ? 'Başlangıç tarihi bitişten sonra olamaz.'
        : period && (from > '9999-12-30' || to > '9999-12-30')
          ? 'Geçerli bir tarih seç.'
          : '';
  const query = new URLSearchParams();
  if (team) query.set('teamId', team);
  if (campaignId) query.set('campaignId', campaignId);
  if (period && from) query.set('dateFrom', from);
  if (period && to) query.set('dateTo', to);
  const filterKey = query.toString();
  const report = usePerformance<AgentReport>(
    !dateError && !selected ? `/reports/agents?${filterKey}` : null,
    revision + plan.revision,
  );
  const allRows = report.data?.agents ?? [];
  const matching = allRows.filter((agent) =>
    agent.name.toLocaleLowerCase('tr').includes(search.trim().toLocaleLowerCase('tr')),
  );
  const ordered = orderAgents(matching, sort, ascending);
  const pageCount = Math.max(1, Math.ceil(ordered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const visible = ordered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const metric: MetricKey = sort === 'name' ? 'salesCalls' : sort;
  const periodLabel = period
    ? `${from ? dateLabel(from) : 'Başlangıç sınırı yok'} — ${to ? dateLabel(to) : 'Bitiş sınırı yok'}`
    : 'Tüm zamanlar';
  // Restore keyboard focus to the profile's trigger after returning, without moving scroll.
  useEffect(() => {
    if (selected || report.stale || !restoreFocus.current) return;
    const node = Array.from(
      listScope.current?.querySelectorAll<HTMLButtonElement>('[data-agent]') ?? [],
    ).find((button) => button.dataset.agent === restoreFocus.current);
    (node || listScope.current)?.focus({ preventScroll: true });
    restoreFocus.current = null;
  }, [selected, report.stale]);

  return (
    <section className="page-enter performance-page" aria-labelledby="performance-heading">
      <div className="page-heading">
        <div>
          <h1 id="performance-heading">Temsilci performansları</h1>
          <p>{campaignName}</p>
        </div>
        <button
          className="secondary-button performance-refresh"
          onClick={() => setRevision((value) => value + 1)}
        >
          <Icon name="history" /> Yenile
        </button>
      </div>
      <div className="page-body">
        <div className="performance-filters">
          <label>
            Takım
            <select
              value={team}
              disabled={!user.capabilities.allTeams}
              onChange={(event) => {
                setTeam(event.target.value);
                setSelected(null);
                setPage(0);
              }}
            >
              {user.capabilities.allTeams && <option value="">Tüm takımlar</option>}
              {plan.nodes
                .filter((node) => node.kind === 'team')
                .map((node) => (
                  <option key={node.id} value={node.code}>
                    {node.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Dönem
            <select
              value={period ? 'range' : 'all'}
              onChange={(event) => {
                setPeriod(event.target.value === 'range');
                setPage(0);
              }}
            >
              <option value="all">Tüm zamanlar</option>
              <option value="range">Tarih aralığı</option>
            </select>
          </label>
          <label>
            Başlangıç
            <input
              type="date"
              value={from}
              disabled={!period}
              max={to || '9999-12-30'}
              onChange={(event) => {
                setFrom(event.target.value);
                setPage(0);
              }}
            />
          </label>
          <label>
            Bitiş
            <input
              type="date"
              value={to}
              disabled={!period}
              min={from || undefined}
              max="9999-12-30"
              onChange={(event) => {
                setTo(event.target.value);
                setPage(0);
              }}
            />
          </label>
        </div>
        {dateError && (
          <p className="performance-note" role="status">
            {dateError}
          </p>
        )}
        <DashboardMotion>
          {selected ? (
            <AgentProfile
              key={selected.id}
              agent={selected}
              query={filterKey}
              valid={!dateError}
              revision={revision + plan.revision}
              periodLabel={periodLabel}
              campaignName={campaignName}
              onBack={() => {
                restoreFocus.current = selected.id;
                setSelected(null);
                requestAnimationFrame(() =>
                  document.getElementById('main')?.scrollTo({ top: listScroll.current }),
                );
              }}
            />
          ) : (
            <div ref={listScope} tabIndex={-1} className="performance-view performance-overview">
              <p className="performance-status" role="status">
                {report.error ||
                  (report.pending
                    ? 'Performans hesaplanıyor…'
                    : dateError
                      ? 'Filtre tamamlanana kadar önceki görünüm gösteriliyor.'
                      : `${periodLabel} · ${count(allRows.length)} temsilci`)}
              </p>
              {!report.data && report.pending && (
                <div className="performance-skeleton" aria-hidden="true" />
              )}
              {report.data && (
                <div aria-busy={report.pending} data-stale={report.stale}>
                  <div className="performance-summary performance-surface">
                    <div>
                      <span>Temsilci</span>
                      <strong>
                        <AnimatedValue value={allRows.length} />
                      </strong>
                    </div>
                    <div>
                      <span>Çağrı</span>
                      <strong>
                        <AnimatedValue
                          value={allRows.reduce((sum, agent) => sum + agent.metrics.totalCalls, 0)}
                        />
                      </strong>
                    </div>
                    <div>
                      <span>Satış</span>
                      <strong>
                        <AnimatedValue
                          value={allRows.reduce((sum, agent) => sum + agent.metrics.salesCalls, 0)}
                        />
                      </strong>
                    </div>
                    <div className="performance-summary-caption">
                      <Icon name="performance" />
                      <span>
                        Temsilci bazında
                        <br />
                        {periodLabel}
                      </span>
                    </div>
                  </div>
                  <div className="performance-sort-bar">
                    <label>
                      Temsilci ara
                      <input
                        type="search"
                        placeholder="Ad soyad"
                        value={search}
                        onChange={(event) => {
                          setSearch(event.target.value);
                          setPage(0);
                        }}
                      />
                    </label>
                    <label>
                      Sıralama
                      <select
                        value={sort}
                        onChange={(event) => {
                          const next = event.target.value as SortKey;
                          setSort(next);
                          setAscending(next === 'name');
                          setPage(0);
                        }}
                      >
                        <option value="name">Ad soyad</option>
                        {(Object.keys(metricLabels) as MetricKey[]).map((key) => (
                          <option value={key} key={key}>
                            {metricLabels[key]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      className="secondary-button performance-direction"
                      onClick={() => setAscending((value) => !value)}
                      aria-label="Sıralama yönünü değiştir"
                    >
                      <span className={ascending ? 'is-ascending' : ''}>
                        <Icon name="arrow" />
                      </span>
                      {sort === 'name'
                        ? ascending
                          ? 'A → Z'
                          : 'Z → A'
                        : ascending
                          ? 'Artan'
                          : 'Azalan'}
                    </button>
                  </div>
                  <div className="performance-section-heading">
                    <h2>Temsilci karşılaştırması</h2>
                    <span>
                      {metricLabels[metric]}
                      {['reachRate', 'conversionRate', 'averageQualityScore'].includes(metric)
                        ? ' · 0–100'
                        : ''}
                    </span>
                  </div>
                  {visible.length ? (
                    <AgentComparison
                      rows={visible}
                      allRows={allRows}
                      sort={sort}
                      metric={metric}
                      ascending={ascending}
                      disabled={report.stale}
                      onOpen={(agent) => {
                        listScroll.current = document.getElementById('main')?.scrollTop ?? 0;
                        setSelected(agent);
                        document.getElementById('main')?.scrollTo({ top: 0 });
                      }}
                    />
                  ) : (
                    <div className="performance-empty performance-surface">
                      {search ? 'Aramana uyan temsilci yok.' : 'Bu kapsamda temsilci bulunmuyor.'}
                    </div>
                  )}
                  <div className="performance-list-footer">
                    <small>
                      {sort === 'name'
                        ? 'Ad soyada göre sıralı; çubuklar satış sayısını gösterir.'
                        : 'Eşit değerler aynı sırayı paylaşır. Verisi olmayanlar en sonda yer alır.'}
                      {metric === 'averageTalkSeconds' &&
                        ' Uzun konuşma tek başına daha iyi performans anlamına gelmez.'}
                    </small>
                    {pageCount > 1 && (
                      <div className="performance-pagination">
                        <button
                          className="text-button"
                          disabled={currentPage === 0}
                          onClick={() => setPage(currentPage - 1)}
                        >
                          Önceki
                        </button>
                        <span>
                          {currentPage + 1} / {pageCount}
                        </span>
                        <button
                          className="text-button"
                          disabled={currentPage + 1 === pageCount}
                          onClick={() => setPage(currentPage + 1)}
                        >
                          Sonraki
                        </button>
                      </div>
                    )}
                  </div>
                  {report.data.summary.coverage.unknownAgentCalls > 0 && (
                    <p className="performance-note">
                      Temsilcisi bilinmeyen {count(report.data.summary.coverage.unknownAgentCalls)}{' '}
                      çağrı kişi sıralamasına dahil değil; şirket raporunda korunur.
                    </p>
                  )}
                  {report.data.undatedCallsExcluded > 0 && (
                    <p className="performance-note">
                      {count(report.data.undatedCallsExcluded)} tarihsiz çağrı bu tarih aralığına
                      dahil değil. Tüm zamanlarda hesaba katılır.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </DashboardMotion>
      </div>
    </section>
  );
}
