'use client';

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';

interface NetworkNodeData {
    label: string;
    status: 'running' | 'stopped' | 'starting' | 'stopping' | 'error';
    osType: string;
    resources?: {
        cpus?: number;
        cpu?: number;
        ram?: number;
        disk?: number;
    };
}

function NetworkNodeComponent({ data, selected }: NodeProps<NetworkNodeData>) {
    const { label, status, osType, resources } = data;

    // Status colors
    const statusColors = {
        running: 'bg-green-500',
        stopped: 'bg-gray-500',
        starting: 'bg-yellow-500 animate-pulse',
        stopping: 'bg-yellow-500 animate-pulse',
        error: 'bg-red-500',
    };

    // OS type icons
    const osIcons: Record<string, string> = {
        ubuntu: '🐧',
        debian: '🌀',
        alpine: '🏔️',
        fedora: '🎩',
        router: '🌐',
        custom: '📦',
    };

    const cpuCount = resources?.cpus || resources?.cpu || 1;
    const ramMb = resources?.ram || 1024;

    return (
        <div
            className={`px-4 py-3 rounded-xl border-2 transition-all duration-200 min-w-[160px] ${selected
                    ? 'border-lab-primary shadow-lg shadow-lab-primary/30 scale-105'
                    : 'border-lab-gray-light hover:border-lab-gray-light/80'
                } ${status === 'running' ? 'bg-lab-gray' : 'bg-lab-gray/70'}`}
        >
            {/* Input Handle (top) */}
            <Handle
                type="target"
                position={Position.Top}
                className="!w-3 !h-3 !bg-lab-primary !border-2 !border-lab-darker"
            />

            {/* Node Content */}
            <div className="flex items-center gap-3">
                {/* OS Icon */}
                <div className="text-2xl">{osIcons[osType] || '💻'}</div>

                {/* Node Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="font-medium text-white text-sm truncate">{label}</span>
                        <span className={`w-2 h-2 rounded-full ${statusColors[status]}`} />
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                        <span>{osType}</span>
                        <span>•</span>
                        <span>{cpuCount} vCPU</span>
                        <span>•</span>
                        <span>{ramMb >= 1024 ? `${(ramMb / 1024).toFixed(1)}GB` : `${ramMb}MB`}</span>
                    </div>
                </div>
            </div>

            {/* Status Badge */}
            <div className="mt-2 pt-2 border-t border-lab-gray-light/50">
                <span
                    className={`text-xs px-2 py-0.5 rounded-full ${status === 'running'
                            ? 'bg-green-500/20 text-green-400'
                            : status === 'error'
                                ? 'bg-red-500/20 text-red-400'
                                : 'bg-gray-500/20 text-gray-400'
                        }`}
                >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                </span>
            </div>

            {/* Output Handle (bottom) */}
            <Handle
                type="source"
                position={Position.Bottom}
                className="!w-3 !h-3 !bg-lab-secondary !border-2 !border-lab-darker"
            />
        </div>
    );
}

export const NetworkNode = memo(NetworkNodeComponent);
