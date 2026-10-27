import { useMemo, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position as HandlePosition,
  SelectionMode,
} from '@xyflow/react';
import type { Node, NodeProps, ReactFlowInstance, NodeChange, EdgeChange } from '@xyflow/react';
import type { Plan, PlanNode, Position } from '../../api/types';
import { Icon } from '../../components/ui/Icon';
import { canConnect, edgeId, kindLabels } from './planModel';
import '@xyflow/react/dist/style.css';

type FlowNode = Node<PlanNode, 'record'>;
function RecordNode({ data, isConnectable }: NodeProps<FlowNode>) {
  return (
    <div className="record-node">
      {data.kind !== 'team' && (
        <Handle
          type="target"
          position={HandlePosition.Left}
          isConnectable={isConnectable}
          aria-label={`${data.name} giriş bağlantısı`}
        />
      )}
      <div className="node-kind">
        <Icon
          name={data.kind === 'team' ? 'users' : data.kind === 'campaign' ? 'campaign' : 'agent'}
        />
        {kindLabels[data.kind]}
      </div>
      <strong>{data.name || 'Adsız kayıt'}</strong>
      <small>{data.code}</small>
      {data.kind === 'team' && (
        <Handle
          type="source"
          position={HandlePosition.Right}
          isConnectable={isConnectable}
          aria-label={`${data.name} çıkış bağlantısı`}
        />
      )}
    </div>
  );
}
const nodeTypes = { record: RecordNode };

type Props = {
  plan: Plan;
  editable: boolean;
  selected: string[];
  selectedEdges: string[];
  positions: Record<string, Position>;
  onSelect: (ids: string[], edges: string[]) => void;
  onPositions: (positions: Record<string, Position>) => void;
  onConnect: (source: string, target: string) => void;
  onCreate: () => void;
  onCheckpoint: () => void;
};

/** React Flow supplies pointer capture, keyboard movement, selection, pan and zoom. */
export function PlanGraph({
  plan,
  editable,
  selected,
  selectedEdges,
  positions,
  onSelect,
  onPositions,
  onConnect,
  onCreate,
  onCheckpoint,
}: Props) {
  const instance = useRef<ReactFlowInstance<FlowNode>>(null);
  const nodes = useMemo(
    () =>
      plan.nodes.map((node) => ({
        id: node.id,
        type: 'record' as const,
        data: node,
        position: positions[node.id] || { x: 40, y: 40 },
        selected: selected.includes(node.id),
        ariaLabel: `${kindLabels[node.kind]}: ${node.name}`,
      })),
    [plan.nodes, positions, selected],
  );
  const edges = useMemo(
    () =>
      plan.edges.map((edge) => ({
        ...edge,
        id: edgeId(edge),
        selected: selectedEdges.includes(edgeId(edge)),
        ariaLabel: `${plan.nodes.find((node) => node.id === edge.source)?.name} → ${plan.nodes.find((node) => node.id === edge.target)?.name}`,
      })),
    [plan.edges, plan.nodes, selectedEdges],
  );
  const nodeChanges = (changes: NodeChange<FlowNode>[]) => {
    let next = { ...positions };
    let ids = [...selected];
    for (const change of changes) {
      if (change.type === 'position' && change.position) next[change.id] = change.position;
      if (change.type === 'select')
        ids = change.selected
          ? [...new Set([...ids, change.id])]
          : ids.filter((id) => id !== change.id);
    }
    if (changes.some((change) => change.type === 'position')) onPositions(next);
    if (changes.some((change) => change.type === 'select')) onSelect(ids, selectedEdges);
  };
  const edgeChanges = (changes: EdgeChange[]) => {
    let ids = [...selectedEdges];
    for (const change of changes)
      if (change.type === 'select')
        ids = change.selected
          ? [...new Set([...ids, change.id])]
          : ids.filter((id) => id !== change.id);
    onSelect(selected, ids);
  };
  return (
    <section className="canvas-area" aria-label="Bağlantı haritası">
      <div className="canvas-tools">
        <strong>Bağlantı haritası</strong>
        <button
          className="icon-button"
          aria-label="Haritayı ekrana sığdır"
          onClick={() =>
            void instance.current?.fitView({
              padding: 0.25,
              duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 350,
            })
          }
        >
          <Icon name="fit" />
        </button>
      </div>
      <div className="graph-viewport">
        <ReactFlow<FlowNode>
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onInit={(value) => {
            instance.current = value;
          }}
          onNodesChange={nodeChanges}
          onEdgesChange={edgeChanges}
          onNodeDragStart={onCheckpoint}
          nodesDraggable={editable}
          nodesConnectable={editable}
          edgesReconnectable={false}
          onConnect={(connection) => onConnect(connection.source, connection.target)}
          isValidConnection={(connection) => canConnect(plan, connection.source, connection.target)}
          onPaneClick={() => onSelect([], [])}
          onPaneContextMenu={(event) => {
            if (editable) {
              event.preventDefault();
              onCreate();
            }
          }}
          fitView
          fitViewOptions={{ padding: 0.3, maxZoom: 1 }}
          minZoom={0.25}
          maxZoom={1.7}
          selectionOnDrag
          selectionMode={SelectionMode.Partial}
          panOnDrag={[1, 2]}
          panOnScroll
          zoomOnScroll={false}
          zoomActivationKeyCode="Control"
          deleteKeyCode={null}
          multiSelectionKeyCode="Control"
          ariaLabelConfig={{
            'controls.zoomIn.ariaLabel': 'Yakınlaştır',
            'controls.zoomOut.ariaLabel': 'Uzaklaştır',
            'controls.fitView.ariaLabel': 'Ekrana sığdır',
            'node.a11yDescription.default':
              'Seçmek için Enter, taşımak için yön tuşları, seçimi kaldırmak için Escape.',
            'edge.a11yDescription.default': 'Bağlantıyı seçmek için Enter.',
          }}
        >
          <Background color="var(--map-dot)" gap={20} size={0.7} />
          <Controls showInteractive={false} />
        </ReactFlow>
        {!plan.nodes.length && (
          <div className="canvas-empty">
            <Icon name="plan" />
            <p>{editable ? 'İlk kaydı oluştur.' : 'Henüz atanmış kayıt yok.'}</p>
            {editable && (
              <button className="outline-button" onClick={onCreate}>
                Yeni oluştur
              </button>
            )}
          </div>
        )}
      </div>
      <div className="canvas-foot">
        <span>{selected.length} kayıt seçili</span>
        <span>Ctrl + tekerlek: yakınlaştır · Orta tuş: gezin</span>
      </div>
    </section>
  );
}
