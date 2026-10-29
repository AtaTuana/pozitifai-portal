import { useEffect, useRef, useState } from 'react';
import { createId } from './createId';
import type { NodeKind, Plan, Position } from '../../api/types';
import { api, errorMessage } from '../../api/client';
import { Dialog } from '../../components/ui/Dialog';
import { Icon } from '../../components/ui/Icon';
import { PlanGraph } from './PlanGraph';
import { NodeInspector } from './NodeInspector';
import { canConnect, edgeId, kindLabels, kindPlurals, readPositions } from './planModel';

type Snapshot = { plan: Plan; positions: Record<string, Position> };
type Props = {
  initial: Plan;
  editable: boolean;
  userId: string;
  onSaved: (plan: Plan) => void;
  onDirty: (dirty: boolean) => void;
};

/** Server-authoritative save with a local undoable draft; layout is a separate browser preference. */
export function PlanningPage({ initial, editable, userId, onSaved, onDirty }: Props) {
  const [plan, setPlan] = useState(initial);
  const [positions, setPositions] = useState(() => readPositions(userId, initial.nodes));
  const [category, setCategory] = useState<NodeKind>('team');
  const [selected, setSelected] = useState<string[]>([]);
  const [selectedEdges, setSelectedEdges] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [removeConfirm, setRemoveConfirm] = useState(false);
  const [reloadConfirm, setReloadConfirm] = useState(false);
  const [newKind, setNewKind] = useState<NodeKind>('team');
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState('');
  const history = useRef<{ undo: Snapshot[]; redo: Snapshot[] }>({ undo: [], redo: [] });
  const [, refreshHistory] = useState(0);
  const dirty = JSON.stringify(plan) !== JSON.stringify(initial);
  const chosen =
    selected.length === 1 ? plan.nodes.find((node) => node.id === selected[0]) : undefined;

  useEffect(() => {
    onDirty(dirty);
    return () => onDirty(false);
  }, [dirty, onDirty]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(`pozitifai.layout.${userId}`, JSON.stringify(positions));
      } catch {
        /* Layout storage is optional. */
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [positions, userId]);

  const checkpoint = () => {
    history.current.undo.push({ plan, positions });
    if (history.current.undo.length > 50) history.current.undo.shift();
    history.current.redo = [];
    refreshHistory((value) => value + 1);
  };
  const update = (next: Plan) => {
    if (!editable) return;
    checkpoint();
    setPlan(next);
    setNotice('');
  };
  const travel = (direction: 'undo' | 'redo') => {
    const snapshot = history.current[direction].pop();
    if (!snapshot) return;
    history.current[direction === 'undo' ? 'redo' : 'undo'].push({ plan, positions });
    setPlan(snapshot.plan);
    setPositions(snapshot.positions);
    setSelected([]);
    setSelectedEdges([]);
    refreshHistory((value) => value + 1);
  };
  const remove = () => {
    update({
      ...plan,
      nodes: plan.nodes.filter((node) => !selected.includes(node.id)),
      edges: plan.edges.filter(
        (edge) =>
          !selected.includes(edge.source) &&
          !selected.includes(edge.target) &&
          !selectedEdges.includes(edgeId(edge)),
      ),
    });
    setSelected([]);
    setSelectedEdges([]);
    setRemoveConfirm(false);
  };
  const copy = () => {
    const originals = plan.nodes.filter((node) => selected.includes(node.id));
    if (!originals.length) return;
    const copied = originals.map((node) => ({
      ...node,
      id: '',
      name: `${node.name.slice(0, 142)} kopyası`,
      code: `${node.code.slice(0, 5)}_${createId().slice(0, 6)}`,
    }));
    copied.forEach((node) => {
      node.id = `${node.kind}:${node.code}`;
    });
    update({ ...plan, nodes: [...plan.nodes, ...copied] });
    setPositions((current) => ({
      ...current,
      ...Object.fromEntries(
        copied.map((node, index) => [
          node.id,
          {
            x: (current[originals[index].id]?.x || 40) + 40,
            y: (current[originals[index].id]?.y || 40) + 60,
          },
        ]),
      ),
    }));
    setSelected(copied.map((node) => node.id));
  };

  const reloadPlan = async () => {
    setReloadConfirm(false);
    setPending(true);
    try {
      const saved = await api<Plan>('/planning');
      setPlan(saved);
      setPositions(readPositions(userId, saved.nodes));
      setSelected([]);
      setSelectedEdges([]);
      history.current = { undo: [], redo: [] };
      setNotice('');
      onSaved(saved);
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setPending(false);
    }
  };

  return (
    <section
      className="planning-page page-enter"
      onKeyDown={(event) => {
        if (
          !editable ||
          pending ||
          (event.target as HTMLElement).closest('input,textarea,select,dialog')
        )
          return;
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
          event.preventDefault();
          travel(event.shiftKey ? 'redo' : 'undo');
        }
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') {
          event.preventDefault();
          copy();
        }
        if (event.key === 'Delete' && (selected.length || selectedEdges.length)) {
          event.preventDefault();
          setRemoveConfirm(true);
        }
      }}
    >
      <div className="page-heading">
        <h1>Takım planlama</h1>
        <div className="heading-actions">
          <button
            className="outline-button"
            disabled={pending}
            onClick={() => (dirty ? setReloadConfirm(true) : void reloadPlan())}
          >
            Yeniden yükle
          </button>
          {editable && (
            <>
              <button
                className="primary-button"
                disabled={pending || !dirty}
                onClick={async () => {
                  setPending(true);
                  setNotice('');
                  try {
                    const saved = await api<Plan>('/planning', 'PUT', plan);
                    setPlan(saved);
                    onSaved(saved);
                  } catch (error) {
                    setNotice(errorMessage(error));
                  } finally {
                    setPending(false);
                  }
                }}
              >
                {pending ? 'Kaydediliyor…' : 'Kaydet'}
              </button>
              <button
                className="outline-button"
                onClick={() => {
                  setNewKind(category);
                  setCreating(true);
                }}
                disabled={pending}
              >
                <Icon name="plus" />
                Yeni oluştur
              </button>
            </>
          )}
        </div>
      </div>
      <div className="planning-studio" inert={pending}>
        <section className="record-library" aria-label="Kayıt kütüphanesi">
          <div className="panel-title">
            <strong>Kütüphane</strong>
            <span>{plan.nodes.length}</span>
          </div>
          <div className="record-categories">
            {(Object.keys(kindLabels) as NodeKind[]).map((kind) => (
              <button key={kind} aria-pressed={category === kind} onClick={() => setCategory(kind)}>
                <span>{kindPlurals[kind]}</span>
                <small>
                  {plan.nodes
                    .filter((node) => node.kind === kind)
                    .length.toString()
                    .padStart(2, '0')}
                </small>
              </button>
            ))}
          </div>
          <div className="record-assets">
            {plan.nodes
              .filter((node) => node.kind === category)
              .map((node) => (
                <button
                  key={node.id}
                  className="record-asset"
                  aria-pressed={selected.includes(node.id)}
                  onClick={() => {
                    setSelected([node.id]);
                    setSelectedEdges([]);
                  }}
                >
                  <strong>{node.name || 'Adsız kayıt'}</strong>
                  <small>{node.code}</small>
                </button>
              ))}
          </div>
        </section>
        <div className="graph-column">
          {editable && (
            <div className="editor-actions">
              <button
                className="icon-button"
                aria-label="Geri al"
                disabled={!history.current.undo.length}
                onClick={() => travel('undo')}
              >
                <Icon name="undo" />
              </button>
              <button
                className="icon-button"
                aria-label="Yinele"
                disabled={!history.current.redo.length}
                onClick={() => travel('redo')}
              >
                <Icon name="redo" />
              </button>
              <button className="text-button" disabled={!selected.length} onClick={copy}>
                Kopyala
              </button>
              <button
                className="icon-button"
                aria-label="Seçileni kaldır"
                disabled={!selected.length && !selectedEdges.length}
                onClick={() => setRemoveConfirm(true)}
              >
                <Icon name="trash" />
              </button>
            </div>
          )}
          <PlanGraph
            plan={plan}
            editable={editable}
            positions={positions}
            selected={selected}
            selectedEdges={selectedEdges}
            onSelect={(ids, edges) => {
              setSelected(ids);
              setSelectedEdges(edges);
            }}
            onPositions={setPositions}
            onCheckpoint={checkpoint}
            onConnect={(source, target) => {
              if (canConnect(plan, source, target))
                update({ ...plan, edges: [...plan.edges, { source, target }] });
            }}
            onCreate={() => setCreating(true)}
          />
        </div>
        <NodeInspector
          node={chosen}
          plan={plan}
          editable={editable}
          onChange={(node) =>
            update({
              ...plan,
              nodes: plan.nodes.map((current) => (current.id === node.id ? node : current)),
            })
          }
          onEdges={(sources) => {
            if (chosen)
              update({
                ...plan,
                edges: [
                  ...plan.edges.filter((edge) => edge.target !== chosen.id),
                  ...sources.map((source) => ({ source, target: chosen.id })),
                ],
              });
          }}
          onRemove={() => setRemoveConfirm(true)}
        />
      </div>
      <div className="planning-status" role="status">
        <span>
          {notice || (dirty ? 'Kaydedilmemiş değişiklikler var.' : 'Tüm değişiklikler kaydedildi.')}
        </span>
        <span>
          {editable ? 'Admin' : 'Salt okunur'} · Sürüm {initial.revision}
        </span>
      </div>
      {creating && (
        <Dialog title="Yeni kayıt oluştur" onClose={() => setCreating(false)}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              const name = String(data.get('name')).trim(),
                code = String(data.get('code')).trim().toUpperCase();
              if (!name || !code) return;
              if (
                plan.nodes.some((node) => node.kind === newKind && node.code.toUpperCase() === code)
              ) {
                setNotice('Bu kayıt kodu zaten kullanılıyor.');
                return;
              }
              const id = `${newKind}:${code}`;
              update({ ...plan, nodes: [...plan.nodes, { id, kind: newKind, name, code }] });
              setPositions((current) => ({
                ...current,
                [id]: {
                  x: newKind === 'team' ? 40 : 340,
                  y: 50 + plan.nodes.filter((node) => node.kind === newKind).length * 145,
                },
              }));
              setSelected([id]);
              setSelectedEdges([]);
              setCategory(newKind);
              setCreating(false);
            }}
          >
            <label htmlFor="new-kind">Kayıt türü</label>
            <select
              id="new-kind"
              value={newKind}
              onChange={(event) => setNewKind(event.target.value as NodeKind)}
            >
              {(Object.keys(kindLabels) as NodeKind[]).map((kind) => (
                <option key={kind} value={kind}>
                  {kindLabels[kind]}
                </option>
              ))}
            </select>
            <label htmlFor="new-name">Ad</label>
            <input id="new-name" name="name" required maxLength={150} autoFocus />
            <label htmlFor="new-code">Kayıt kimliği</label>
            <input
              id="new-code"
              name="code"
              required
              pattern="[a-zA-Z0-9_\-]+"
              maxLength={12}
              placeholder="TAKIM_01"
            />
            <p className="hint">
              Bağlantılarını haritadan veya özellikler panelinden kurabilirsin.
            </p>
            <p role="status" className="form-status">
              {notice}
            </p>
            <div className="form-actions">
              <button type="button" className="text-button" onClick={() => setCreating(false)}>
                Vazgeç
              </button>
              <button className="primary-button" type="submit">
                Oluştur
              </button>
            </div>
          </form>
        </Dialog>
      )}
      {reloadConfirm && (
        <Dialog title="Güncel planı yükle" onClose={() => setReloadConfirm(false)}>
          <p>Kaydedilmemiş taslak bırakılacak ve sunucudaki güncel plan açılacak.</p>
          <div className="form-actions">
            <button className="text-button" onClick={() => setReloadConfirm(false)}>
              Vazgeç
            </button>
            <button className="primary-button" onClick={() => void reloadPlan()}>
              Taslağı bırak ve yükle
            </button>
          </div>
        </Dialog>
      )}
      {removeConfirm && (
        <Dialog title="Seçimi kaldır" onClose={() => setRemoveConfirm(false)}>
          <p>
            {selected.length
              ? 'Seçili kayıtlar ve bağlantıları plandan kaldırılacak. Kaydettiğinde kayıtlar arşivlenir.'
              : 'Seçili bağlantılar kaldırılacak; kayıtlar korunacak.'}
          </p>
          <div className="form-actions">
            <button className="text-button" onClick={() => setRemoveConfirm(false)}>
              Vazgeç
            </button>
            <button className="primary-button" onClick={remove}>
              Kaldır
            </button>
          </div>
        </Dialog>
      )}
    </section>
  );
}
