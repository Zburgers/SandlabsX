import type { NodeProps } from 'reactflow';
import type { CapsuleNode as CapsuleNodeDocument } from '../../lib/capsule-types';
import { InterfaceHandle } from './InterfaceHandle';

export interface CapsuleNodeData { nodeId: string; node: CapsuleNodeDocument; connected: Set<string> }

export function CapsuleNode({ data, selected }: NodeProps<CapsuleNodeData>) {
  const resources = data.node.resources || { vcpus: 1, memoryMiB: 1024, diskGiB: 16 };
  return <article aria-label={`${data.node.displayName || data.nodeId} node`} className={`w-56 overflow-hidden rounded-[var(--radius-md)] border bg-[var(--surface)] shadow-xl transition ${selected ? 'border-accent shadow-[0_0_0_2px_rgba(101,214,200,.16)]' : 'border-[var(--border-strong)]'}`}>
    <header className="border-b border-border px-4 py-3"><div className="flex items-center justify-between gap-3"><strong className="truncate text-sm">{data.node.displayName || data.nodeId}</strong><span className="h-1.5 w-1.5 rotate-45 bg-accent" aria-hidden /></div><p className="mt-1 truncate text-[0.65rem] text-[var(--muted)] mono">{data.node.workloadProfile}</p></header>
    <div className="grid grid-cols-3 gap-px bg-border text-center"><div className="bg-[var(--canvas-soft)] px-2 py-2"><strong className="block text-xs tabular">{resources.vcpus}</strong><span className="text-[0.6rem] text-[var(--muted)]">vCPU</span></div><div className="bg-[var(--canvas-soft)] px-2 py-2"><strong className="block text-xs tabular">{(resources.memoryMiB / 1024).toFixed(1)}</strong><span className="text-[0.6rem] text-[var(--muted)]">GiB RAM</span></div><div className="bg-[var(--canvas-soft)] px-2 py-2"><strong className="block text-xs tabular">{resources.diskGiB}</strong><span className="text-[0.6rem] text-[var(--muted)]">GiB disk</span></div></div>
    <div className="py-2">{data.node.interfaces.map((item, index) => <InterfaceHandle key={item.id} nodeId={data.nodeId} interfaceId={item.id} connected={data.connected.has(`${data.nodeId}:${item.id}`)} offset={18 + index * 28} />)}</div>
  </article>;
}
