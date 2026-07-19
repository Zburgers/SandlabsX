import { Handle, Position } from 'reactflow';

export function InterfaceHandle({ nodeId, interfaceId, connected, offset }: { nodeId: string; interfaceId: string; connected?: boolean; offset: number }) {
  return <div className="relative flex h-7 items-center justify-between px-4 text-[0.68rem]">
    <Handle id={`in:${interfaceId}`} type="target" position={Position.Left} style={{ top: offset, width: 10, height: 10, background: connected ? 'var(--success)' : 'var(--surface-strong)', border: '2px solid var(--accent)' }} aria-label={`Connect to ${nodeId} ${interfaceId}`} />
    <span className="mono text-[var(--ink-soft)]">{interfaceId}</span><span className="text-[var(--muted)]">{connected ? 'linked' : 'free'}</span>
    <Handle id={`out:${interfaceId}`} type="source" position={Position.Right} style={{ top: offset, width: 10, height: 10, background: connected ? 'var(--success)' : 'var(--surface-strong)', border: '2px solid var(--accent)' }} aria-label={`Connect from ${nodeId} ${interfaceId}`} />
  </div>;
}
