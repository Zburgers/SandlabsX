'use client';

import { useCallback, useMemo, useState } from 'react';
import ReactFlow, { Background, BackgroundVariant, Connection, Controls, Edge, MiniMap, Node as FlowNode, NodeTypes } from 'reactflow';
import 'reactflow/dist/style.css';
import type { CapsuleDocument, CapsuleDraft, CapsuleProfile } from '../../lib/capsule-types';
import { PlusIcon } from '../icons';
import { ActionButton } from '../ui/ActionButton';
import { CapsuleNode, CapsuleNodeData } from './CapsuleNode';
import { NodeBuilderDrawer, BuiltCapsuleNode } from './NodeBuilderDrawer';
import { NodeInspector } from './NodeInspector';
import { NodePalette } from './NodePalette';
import { ValidationPanel } from './ValidationPanel';

const nodeTypes: NodeTypes = { capsuleNode: CapsuleNode };
const clone = <T,>(value: T): T => structuredClone(value);
const endpointFromHandle = (nodeId?: string | null, handle?: string | null) => nodeId && handle ? `${nodeId}:${handle.replace(/^(in|out):/, '')}` : undefined;

export function connectInterfaces(document: CapsuleDocument, source: string, target: string): { document: CapsuleDocument; error?: string } {
  if (source === target || source.split(':')[0] === target.split(':')[0]) return { document, error: 'Choose interfaces on two different nodes.' };
  const endpoints = new Set(Object.entries(document.nodes).flatMap(([nodeId, node]) => node.interfaces.map(item => `${nodeId}:${item.id}`)));
  if (!endpoints.has(source) || !endpoints.has(target)) return { document, error: 'One of the selected interfaces no longer exists.' };
  const used = new Set(document.links.flatMap(link => link.endpoints));
  if (used.has(source) || used.has(target)) return { document, error: 'Each interface can be connected only once; one endpoint is already connected.' };
  const base = `${source}-${target}`.replace(/:/g, '-').replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
  let id = base; let suffix = 2; while (document.links.some(link => link.id === id)) id = `${base}-${suffix++}`;
  return { document: { ...document, links: [...document.links, { id, type: 'pointToPoint', endpoints: [source, target] }] } };
}

export function moveCapsuleNode(document: CapsuleDocument, nodeId: string, position: { x: number; y: number }): CapsuleDocument {
  const node = document.nodes[nodeId]; if (!node) return document;
  return { ...document, nodes: { ...document.nodes, [nodeId]: { ...node, presentation: { ...node.presentation, position } } } };
}

export function removeCapsuleNode(document: CapsuleDocument, nodeId: string): CapsuleDocument {
  const next = clone(document); const removed = next.nodes[nodeId]; if (!removed) return document;
  delete next.nodes[nodeId]; next.links = next.links.filter(link => !link.endpoints.some(endpoint => endpoint.startsWith(`${nodeId}:`)));
  if (!Object.values(next.nodes).some(node => node.image === removed.image)) delete next.images[removed.image];
  if (!Object.values(next.nodes).some(node => node.workloadProfile === removed.workloadProfile)) delete next.workloadProfiles[removed.workloadProfile];
  return next;
}

function placeBuiltNode(document: CapsuleDocument, built: BuiltCapsuleNode): CapsuleDocument {
  const index = Object.keys(document.nodes).length;
  return { ...document, images: { ...document.images, [built.profile.image.name]: { version: built.profile.image.version, digest: built.profile.image.digest } }, workloadProfiles: { ...document.workloadProfiles, [built.profile.id]: { version: built.profile.version } }, nodes: { ...document.nodes, [built.id]: { ...built.node, presentation: { position: { x: 100 + (index % 3) * 270, y: 90 + Math.floor(index / 3) * 220 } } } } };
}

export function CapsuleEditor({ draft, profiles, onSave, readOnly = false, issues = [] }: { draft: CapsuleDraft; profiles: CapsuleProfile[]; onSave: (document: CapsuleDocument) => void; readOnly?: boolean; issues?: Array<{ path: string; message: string }> }) {
  const [history, setHistory] = useState<CapsuleDocument[]>([clone(draft.document)]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [selectedNodeId, setSelectedNodeId] = useState<string>();
  const [builderOpen, setBuilderOpen] = useState(false);
  const [builderProfileId, setBuilderProfileId] = useState<string>();
  const [localIssue, setLocalIssue] = useState<string>();
  const document = history[historyIndex];

  const commit = useCallback((next: CapsuleDocument) => {
    setHistory(current => [...current.slice(0, historyIndex + 1), clone(next)]); setHistoryIndex(historyIndex + 1); onSave(next);
  }, [historyIndex, onSave]);
  const travel = (index: number) => { const next = history[index]; if (!next) return; setHistoryIndex(index); setSelectedNodeId(undefined); onSave(clone(next)); };
  const connected = useMemo(() => new Set(document.links.flatMap(link => link.endpoints)), [document.links]);
  const flowNodes = useMemo<FlowNode<CapsuleNodeData>[]>(() => Object.entries(document.nodes).map(([nodeId, node], index) => ({ id: nodeId, type: 'capsuleNode', position: node.presentation?.position || { x: 90 + (index % 3) * 270, y: 80 + Math.floor(index / 3) * 220 }, data: { nodeId, node, connected } })), [connected, document.nodes]);
  const flowEdges = useMemo<Edge[]>(() => document.links.filter(link => link.endpoints.length === 2).map(link => { const [source, target] = link.endpoints.map(value => value.split(':')); return { id: link.id, source: source[0], sourceHandle: `out:${source.slice(1).join(':')}`, target: target[0], targetHandle: `in:${target.slice(1).join(':')}`, animated: false, style: { stroke: 'var(--accent)', strokeWidth: 2 } }; }), [document.links]);
  const add = (built: BuiltCapsuleNode) => { commit(placeBuiltNode(document, built)); setSelectedNodeId(built.id); setBuilderOpen(false); setLocalIssue(undefined); };
  const connect = (connection: Connection) => { if (readOnly) return; const source = endpointFromHandle(connection.source, connection.sourceHandle); const target = endpointFromHandle(connection.target, connection.targetHandle); if (!source || !target) return; const result = connectInterfaces(document, source, target); if (result.error) setLocalIssue(result.error); else { setLocalIssue(undefined); commit(result.document); } };
  const selected = selectedNodeId ? document.nodes[selectedNodeId] : undefined;
  const selectedProfile = selected ? profiles.find(profile => profile.id === selected.workloadProfile) : undefined;
  const combinedIssues = localIssue ? [{ path: 'links', message: localIssue }, ...issues] : issues;

  return <section aria-label="Capsule visual editor" className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-[var(--canvas)]">
    <header className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-border bg-[var(--canvas-soft)] px-3 py-2"><div className="flex items-center gap-2"><ActionButton disabled={readOnly || !profiles.length} onClick={() => { setBuilderProfileId(undefined); setBuilderOpen(true); }} icon={<PlusIcon />} className="min-h-9 py-1">Add node</ActionButton><span className="hidden text-xs text-[var(--muted)] sm:inline">revision {draft.revision}</span></div><div className="flex items-center gap-1"><button type="button" aria-label="Undo" disabled={readOnly || historyIndex === 0} onClick={() => travel(historyIndex - 1)} className="min-h-9 rounded px-3 text-sm text-[var(--ink-soft)] hover:bg-[var(--surface-raised)] disabled:opacity-35">Undo</button><button type="button" aria-label="Redo" disabled={readOnly || historyIndex === history.length - 1} onClick={() => travel(historyIndex + 1)} className="min-h-9 rounded px-3 text-sm text-[var(--ink-soft)] hover:bg-[var(--surface-raised)] disabled:opacity-35">Redo</button><span className="ml-2 text-xs text-[var(--muted)] tabular">{Object.keys(document.nodes).length} nodes · {document.links.length} links</span></div></header>
    <div className="grid min-h-[38rem] grid-cols-1 lg:grid-cols-[14rem_minmax(0,1fr)] xl:grid-cols-[14rem_minmax(0,1fr)_18rem]">
      <div className="hidden border-r border-border lg:block"><NodePalette profiles={profiles} disabled={readOnly} onSelect={profile => { setBuilderProfileId(profile.id); setBuilderOpen(true); }} /></div>
      <div className="relative min-h-[32rem] workstation-grid"><ReactFlow nodes={flowNodes} edges={flowEdges} nodeTypes={nodeTypes} onConnect={connect} onNodeClick={(_event, node) => setSelectedNodeId(node.id)} onPaneClick={() => setSelectedNodeId(undefined)} onNodeDragStop={(_event, node) => !readOnly && commit(moveCapsuleNode(document, node.id, node.position))} nodesDraggable={!readOnly} nodesConnectable={!readOnly} fitView minZoom={0.35} maxZoom={1.8} proOptions={{ hideAttribution: true }}><Background variant={BackgroundVariant.Dots} color="rgba(132,160,169,.18)" gap={24} /><MiniMap pannable zoomable nodeColor="var(--accent)" maskColor="rgba(8,13,18,.76)" className="!border !border-border !bg-[var(--canvas-soft)]" /><Controls showInteractive={false} className="!overflow-hidden !rounded-md !border !border-border !bg-[var(--surface)] !shadow-none" /></ReactFlow>{flowNodes.length === 0 && <div className="pointer-events-none absolute inset-0 grid place-items-center p-8"><div className="max-w-sm text-center"><div className="mx-auto h-2 w-2 rotate-45 bg-accent" /><h2 className="mt-5 text-xl font-semibold">Blank canvas</h2><p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">Choose an installed workload profile, allocate resources, then drag interface handles to wire the topology.</p><button type="button" className="pointer-events-auto mt-5 min-h-11 rounded-md border border-[var(--border-strong)] px-4 text-sm font-semibold hover:border-accent" disabled={readOnly || !profiles.length} onClick={() => setBuilderOpen(true)}>Add your first node</button></div></div>}</div>
      <div className="hidden border-l border-border xl:block"><NodeInspector nodeId={selectedNodeId} node={selected} profile={selectedProfile} readOnly={readOnly} onChange={node => selectedNodeId && commit({ ...document, nodes: { ...document.nodes, [selectedNodeId]: node } })} onDelete={() => { if (selectedNodeId) { commit(removeCapsuleNode(document, selectedNodeId)); setSelectedNodeId(undefined); } }} /></div>
    </div>
    <div className="border-t border-border"><ValidationPanel issues={combinedIssues} onFocusPath={path => { const match = /^nodes\.([^.]+)/.exec(path); if (match) setSelectedNodeId(match[1]); }} /></div>
    <NodeBuilderDrawer open={builderOpen} profiles={profiles} existingNodeIds={Object.keys(document.nodes)} initialProfileId={builderProfileId} onAdd={add} onClose={() => setBuilderOpen(false)} />
  </section>;
}
