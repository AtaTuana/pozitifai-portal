import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { api, errorMessage } from '../../api/client';
import { Icon } from '../../components/ui/Icon';
import { AnalysisOrb } from './AnalysisOrb';
import { DateRangeCalendar } from './DateRangeCalendar';
import type {
  AnalysisResult,
  DateSelection,
  RejectionOverview,
  RejectionRecord,
  TranscriptDetail,
} from './types';
import './rejections.css';

type Stage = 'calendar' | 'analysis' | 'results' | 'category' | 'chat';
const number = (value: number) => value.toLocaleString('tr-TR');
const callDate = (value: string | null) =>
  value
    ? new Date(value).toLocaleString('tr-TR', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Europe/Istanbul',
      })
    : 'Tarih bilinmiyor';

function Back({ onClick, text = 'Geri dön' }: { onClick: () => void; text?: string }) {
  return (
    <button type="button" className="rejection-back" onClick={onClick}>
      <span className="is-back">
        <Icon name="arrow" />
      </span>
      {text}
    </button>
  );
}

/** Selection only reads data. Paid classification starts exclusively with an explicit click. */
export function RejectionsPage({
  campaignId,
  campaignName,
}: {
  campaignId: string;
  campaignName: string;
}) {
  const [selection, setSelection] = useState<DateSelection>({ mode: 'all', from: '', to: '' });
  const [report, setReport] = useState<RejectionOverview | null>(null);
  const [stage, setStage] = useState<Stage>('calendar');
  const [leaving, setLeaving] = useState(false);
  const [backward, setBackward] = useState(false);
  const [loading, setLoading] = useState(true);
  const [problem, setProblem] = useState('');
  const [retryKey, setRetryKey] = useState(0);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [conversation, setConversation] = useState<TranscriptDetail | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const transition = useRef<ReturnType<typeof setTimeout> | null>(null);
  const operation = useRef<AbortController | null>(null);
  const sequence = useRef(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const mounted = useRef(true);

  const invalidRange =
    selection.mode === 'range' &&
    (!selection.from || !selection.to || selection.from > selection.to);
  const filters = useMemo(
    () => ({
      ...(campaignId ? { campaignId } : {}),
      ...(selection.mode === 'range' ? { dateFrom: selection.from, dateTo: selection.to } : {}),
    }),
    [campaignId, selection],
  );
  const query = useMemo(() => new URLSearchParams(filters).toString(), [filters]);
  const changeStage = useCallback((next: Stage, back = false) => {
    if (transition.current) clearTimeout(transition.current);
    setBackward(back);
    setLeaving(true);
    transition.current = setTimeout(
      () => {
        if (!mounted.current) return;
        setStage(next);
        setLeaving(false);
        transition.current = null;
      },
      matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180,
    );
  }, []);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      sequence.current++;
      operation.current?.abort();
      if (transition.current) clearTimeout(transition.current);
    };
  }, []);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [stage]);
  useEffect(() => {
    if (invalidRange) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setProblem('');
    const timer = setTimeout(() => {
      void api<RejectionOverview>(`/rejections?${query}`, 'GET', undefined, {
        signal: controller.signal,
      })
        .then((data) => {
          if (!controller.signal.aborted) setReport(data);
        })
        .catch((error) => {
          if (!controller.signal.aborted) setProblem(errorMessage(error));
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 180);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, invalidRange, retryKey]);

  const records = report?.records ?? [];
  const analyzed = records.filter((record) => record.analyzed);
  const pending = records.length - analyzed.length;
  const period =
    selection.mode === 'all'
      ? 'Tüm zamanlar'
      : `${selection.from.split('-').reverse().join('.')} — ${selection.to.split('-').reverse().join('.')}`;
  const categories = useMemo(() => {
    const base = (report?.categories ?? []).map((category) => ({
      ...category,
      count: analyzed.filter((record) => record.categoryIds.includes(category.id)).length,
    }));
    const unknown = analyzed.filter((record) => record.categoryIds.length === 0).length;
    if (unknown) base.push({ id: 0, name: 'Belirlenemeyen', count: unknown });
    return base.sort((a, b) => b.count - a.count || a.id - b.id);
  }, [report]); // records are replaced after every completed analysis
  const selectedCategory = categories.find((category) => category.id === categoryId);
  const categoryRecords = analyzed.filter((record) =>
    categoryId === 0 ? !record.categoryIds.length : record.categoryIds.includes(categoryId ?? -1),
  );
  const maxCount = Math.max(1, ...categories.map((category) => category.count));

  async function startAnalysis() {
    if (busy || !report || invalidRange || loading) return;
    setProblem('');
    if (!pending || !report.canAnalyze) {
      changeStage('results');
      return;
    }
    operation.current?.abort();
    const controller = new AbortController();
    operation.current = controller;
    const token = ++sequence.current;
    setBusy(true);
    setReady(false);
    changeStage('analysis');
    let failure = '';
    try {
      // Refresh immediately before reserving work; another session may have completed it.
      const fresh = await api<RejectionOverview>(`/rejections?${query}`, 'GET', undefined, {
        signal: controller.signal,
      });
      if (token !== sequence.current) return;
      setReport(fresh);
      const queue = fresh.records.filter((record) => !record.analyzed);
      let cursor = 0;
      async function worker() {
        while (!failure && !controller.signal.aborted && cursor < queue.length) {
          const record = queue[cursor++];
          try {
            const answer = await api<AnalysisResult>(
              '/rejections/analyze',
              'POST',
              { ...filters, callId: record.callId },
              { signal: controller.signal, timeoutMs: 60_000 },
            );
            if (token !== sequence.current) return;
            setReport((previous) =>
              previous
                ? {
                    ...previous,
                    records: previous.records.map((item) =>
                      item.callId === answer.callId ? { ...item, ...answer } : item,
                    ),
                  }
                : previous,
            );
          } catch (error) {
            if (!controller.signal.aborted) failure ||= errorMessage(error);
          }
        }
      }
      // Three bounded workers keep the page responsive without launching 25 requests at once.
      await Promise.all(Array.from({ length: Math.min(3, queue.length) }, () => worker()));
      if (token !== sequence.current || controller.signal.aborted) return;
      if (failure) {
        setProblem(failure);
        changeStage('results');
      } else setReady(true);
    } catch (error) {
      if (!controller.signal.aborted && token === sequence.current) {
        setProblem(errorMessage(error));
        changeStage('results');
      }
    } finally {
      if (token === sequence.current) setBusy(false);
    }
  }

  async function openConversation(record: RejectionRecord) {
    operation.current?.abort();
    const controller = new AbortController();
    operation.current = controller;
    setOpening(record.callId);
    setProblem('');
    try {
      const detail = await api<TranscriptDetail>(
        `/rejections/${encodeURIComponent(record.callId)}?${query}`,
        'GET',
        undefined,
        { signal: controller.signal },
      );
      if (!controller.signal.aborted) {
        setConversation(detail);
        changeStage('chat');
      }
    } catch (error) {
      if (!controller.signal.aborted) setProblem(errorMessage(error));
    } finally {
      if (!controller.signal.aborted) setOpening(null);
    }
  }

  return (
    <section className="rejections-page" aria-labelledby="rejections-title">
      <header className="rejection-page-heading">
        <h1 id="rejections-title">Reddedilme nedenleri</h1>
        <span className="rejection-campaign">{campaignName}</span>
      </header>
      <div
        className={`rejection-stage ${leaving ? 'is-leaving' : ''} ${backward ? 'is-backward' : ''}`}
        data-stage={stage}
      >
        <div className="rejection-stage-content" key={stage}>
          {stage === 'calendar' && (
            <div className="rejection-select-layout">
              <div className="rejection-calendar-surface">
                <DateRangeCalendar
                  value={selection}
                  onChange={setSelection}
                  latest={report?.dateBounds.last ?? null}
                />
              </div>
              <div className="rejection-selection-summary">
                <span className="rejection-eyebrow">Analiz dönemi</span>
                <h2 ref={heading} tabIndex={-1}>
                  {period}
                </h2>
                <div className="rejection-selection-count" aria-live="polite" aria-busy={loading}>
                  <strong>{loading || invalidRange ? '—' : number(records.length)}</strong>
                  <span>ret konuşması</span>
                </div>
                {!loading && !invalidRange && (
                  <p className="rejection-subtle">
                    {analyzed.length
                      ? `${number(analyzed.length)} analiz hazır · ${number(pending)} bekliyor`
                      : 'Analiz için hazır'}
                  </p>
                )}
                {invalidRange && (
                  <p className="rejection-error" role="alert">
                    Başlangıç ve bitiş için geçerli bir tarih aralığı seç.
                  </p>
                )}
                {problem && (
                  <div className="rejection-error" role="alert">
                    <p>{problem}</p>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => setRetryKey((key) => key + 1)}
                    >
                      Yeniden yükle
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  className="primary-button rejection-start"
                  disabled={
                    loading ||
                    invalidRange ||
                    !report ||
                    !records.length ||
                    (!!pending && report.canAnalyze && !report.providerConfigured) ||
                    !!problem
                  }
                  onClick={() => void startAnalysis()}
                >
                  <Icon name={report?.canAnalyze && pending ? 'rejections' : 'overview'} />
                  {report?.canAnalyze && pending ? 'Analiz Başlat' : 'Sonuçları görüntüle'}
                  <Icon name="arrow" />
                </button>
                {!loading && !!analyzed.length && !!pending && report?.canAnalyze && (
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => changeStage('results')}
                  >
                    Hazır analizleri görüntüle
                  </button>
                )}
                {!loading && report?.canAnalyze && !report.providerConfigured && pending > 0 && (
                  <p className="rejection-subtle">
                    LLM001 · API anahtarı bulunamadı. Yerel ayarları kaydedip portalı yeniden
                    başlat.
                  </p>
                )}
                {!loading && !records.length && !problem && (
                  <p className="rejection-subtle">Bu seçimde yüklenmiş ret konuşması yok.</p>
                )}
                {!loading && !!report?.missingTranscripts && (
                  <p className="rejection-note">
                    {number(report.missingTranscripts)} ret çağrısının transkripti henüz
                    yüklenmemiş.
                  </p>
                )}
                {!loading && !!report?.undatedTranscripts && (
                  <p className="rejection-note">
                    Tarihi bilinmeyen {number(report.undatedTranscripts)} konuşma yalnızca “Tüm
                    zamanlar” seçimine dahil edilir.
                  </p>
                )}
                {!loading && report && !report.canAnalyze && (
                  <p className="rejection-note">
                    Takımının kayıtlı analizlerini görüntüleyebilirsin. Yeni analizleri yönetici
                    başlatır.
                  </p>
                )}
              </div>
            </div>
          )}

          {stage === 'analysis' && (
            <AnalysisOrb
              ready={ready}
              completed={analyzed.length}
              total={records.length}
              onComplete={() => changeStage('results')}
            />
          )}

          {stage === 'results' && (
            <div className="rejection-results">
              <Back text="Tarih seçimine dön" onClick={() => changeStage('calendar', true)} />
              <div className="rejection-result-heading">
                <div>
                  <span className="rejection-eyebrow">{period}</span>
                  <h2 ref={heading} tabIndex={-1}>
                    Ret dağılımı
                  </h2>
                </div>
                <div className="rejection-result-count">
                  <strong>{number(analyzed.length)}</strong>
                  <span>analiz edilen konuşma</span>
                </div>
              </div>
              {problem && (
                <p className="rejection-error" role="alert">
                  {problem}
                </p>
              )}
              {!!pending && (
                <div className="rejection-pending">
                  <span>{number(pending)} konuşmanın analizi henüz tamamlanmadı.</span>
                  {report?.canAnalyze && (
                    <button
                      type="button"
                      className="text-button"
                      disabled={busy || !report.providerConfigured}
                      onClick={() => void startAnalysis()}
                    >
                      Tamamlanmayanları analiz et <Icon name="arrow" />
                    </button>
                  )}
                </div>
              )}
              {!analyzed.length ? (
                <p className="rejection-empty">Bu seçim için kayıtlı analiz yok.</p>
              ) : (
                <>
                  <div
                    className="rejection-bars"
                    aria-label="Ret nedenlerine göre konuşma sayıları"
                  >
                    {categories.map((category, index) => (
                      <button
                        type="button"
                        key={category.id}
                        className="rejection-bar-row"
                        disabled={!category.count}
                        aria-label={`${category.name}: ${category.count} konuşma. Konuşmaları görüntüle.`}
                        style={
                          {
                            '--bar-ratio': category.count / maxCount,
                            '--bar-delay': `${index * 45}ms`,
                          } as CSSProperties
                        }
                        onClick={() => {
                          setCategoryId(category.id);
                          setProblem('');
                          changeStage('category');
                        }}
                      >
                        <span className="rejection-bar-name">{category.name}</span>
                        <span className="rejection-bar-track">
                          <span className="rejection-bar-fill" />
                        </span>
                        <strong>{number(category.count)}</strong>
                        <Icon name="chevron" />
                      </button>
                    ))}
                  </div>
                  <p className="rejection-note">
                    Bir konuşma en fazla iki neden içerebilir; kategori toplamı konuşma sayısını
                    aşabilir.
                  </p>
                </>
              )}
            </div>
          )}

          {stage === 'category' && (
            <div className="rejection-call-list">
              <Back
                onClick={() => {
                  setProblem('');
                  changeStage('results', true);
                }}
              />
              <div className="rejection-result-heading">
                <div>
                  <span className="rejection-eyebrow">{period}</span>
                  <h2 ref={heading} tabIndex={-1}>
                    {selectedCategory?.name}
                  </h2>
                </div>
                <span className="rejection-subtle">{number(categoryRecords.length)} konuşma</span>
              </div>
              {problem && (
                <p className="rejection-error" role="alert">
                  {problem}
                </p>
              )}
              <div className="rejection-conversations">
                {categoryRecords.map((record) => (
                  <button
                    type="button"
                    className="rejection-call"
                    key={record.callId}
                    disabled={opening !== null}
                    onClick={() => void openConversation(record)}
                  >
                    <span className="rejection-avatar">
                      <Icon name="headset" />
                    </span>
                    <span className="rejection-call-person">
                      <strong>{record.agentName}</strong>
                      <span>{record.campaignName}</span>
                    </span>
                    <span className="rejection-call-meta">
                      <strong>{record.callId}</strong>
                      <span>
                        {opening === record.callId
                          ? 'Konuşma açılıyor…'
                          : callDate(record.startedAt)}
                      </span>
                    </span>
                    <Icon name="chevron" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {stage === 'chat' && conversation && (
            <div className="rejection-chat">
              <Back onClick={() => changeStage('category', true)} />
              <header className="rejection-chat-heading">
                <span className="rejection-avatar">
                  <Icon name="headset" />
                </span>
                <div>
                  <h2 ref={heading} tabIndex={-1}>
                    {conversation.agentName}
                  </h2>
                  <p>
                    {conversation.callId} · {callDate(conversation.startedAt)}
                  </p>
                </div>
              </header>
              <div className="rejection-chat-labels">
                {conversation.categoryIds.map((id) => (
                  <span key={id}>
                    {report?.categories.find((category) => category.id === id)?.name}
                  </span>
                ))}
              </div>
              <ol className="rejection-messages" aria-label="Görüşme içeriği">
                {conversation.turns.map((turn, index) => (
                  <li className={`rejection-message is-${turn.speaker}`} key={index}>
                    <span className="rejection-avatar">
                      <Icon
                        name={
                          turn.speaker === 'agent'
                            ? 'headset'
                            : turn.speaker === 'customer'
                              ? 'agent'
                              : 'rejections'
                        }
                      />
                    </span>
                    <div className="rejection-bubble">
                      <span className="rejection-speaker">
                        {turn.speaker === 'agent'
                          ? conversation.agentName
                          : turn.speaker === 'customer'
                            ? 'Müşteri'
                            : 'Konuşmacı belirtilmemiş'}
                      </span>
                      <p>{turn.content}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
