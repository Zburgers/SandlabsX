'use client';

import React, { useState } from 'react';
import type { Edge } from 'reactflow';
import type { Node as SandlabNode } from '../../lib/types';
import { apiClient } from '../../lib/api';

interface PropertiesPanelProps {
    selectedNode: SandlabNode | null | undefined;
    selectedEdge: Edge | null | undefined;
    onRefresh: () => void;
    onDeleteEdge: () => void;
}

export function PropertiesPanel({
    selectedNode,
    selectedEdge,
    onRefresh,
    onDeleteEdge,
}: PropertiesPanelProps) {
    const [isLoading, setIsLoading] = useState(false);

    const handleStartNode = async () => {
        if (!selectedNode) return;
        setIsLoading(true);
        try {
            await apiClient.startNode(selectedNode.id);
            await onRefresh();
        } catch (error) {
            console.error('Failed to start node:', error);
        }
        setIsLoading(false);
    };

    const handleStopNode = async () => {
        if (!selectedNode) return;
        setIsLoading(true);
        try {
            await apiClient.stopNode(selectedNode.id);
            await onRefresh();
        } catch (error) {
            console.error('Failed to stop node:', error);
        }
        setIsLoading(false);
    };

    const handleWipeNode = async () => {
        if (!selectedNode) return;
        if (!confirm('Are you sure you want to wipe this node? All data will be lost.')) return;
        setIsLoading(true);
        try {
            await apiClient.wipeNode(selectedNode.id);
            await onRefresh();
        } catch (error) {
            console.error('Failed to wipe node:', error);
        }
        setIsLoading(false);
    };

    const handleDeleteNode = async () => {
        if (!selectedNode) return;
        if (!confirm('Are you sure you want to delete this node?')) return;
        setIsLoading(true);
        try {
            await apiClient.deleteNode(selectedNode.id);
            await onRefresh();
        } catch (error) {
            console.error('Failed to delete node:', error);
        }
        setIsLoading(false);
    };

    // Status colors
    const statusColors = {
        running: 'bg-green-500/20 text-green-400 border-green-500/30',
        stopped: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
        starting: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
        stopping: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
        error: 'bg-red-500/20 text-red-400 border-red-500/30',
    };

    return (
        <div className="w-72 bg-lab-gray/80 backdrop-blur-sm border-l border-lab-gray-light flex flex-col">
            <div className="p-4 border-b border-lab-gray-light">
                <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
                    Properties
                </h2>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
                {selectedNode ? (
                    <div className="space-y-4">
                        {/* Node Name */}
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">Name</label>
                            <div className="text-white font-medium">{selectedNode.name}</div>
                        </div>

                        {/* OS Type */}
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">OS Type</label>
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-lab-gray-light rounded-lg">
                                <span className="text-lg">
                                    {selectedNode.osType === 'ubuntu' && '🐧'}
                                    {selectedNode.osType === 'debian' && '🌀'}
                                    {selectedNode.osType === 'alpine' && '🏔️'}
                                    {selectedNode.osType === 'router' && '🌐'}
                                    {selectedNode.osType === 'custom' && '📦'}
                                </span>
                                <span className="text-white capitalize">{selectedNode.osType}</span>
                            </div>
                        </div>

                        {/* Status */}
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">Status</label>
                            <span
                                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${statusColors[selectedNode.status] || statusColors.stopped
                                    }`}
                            >
                                <span
                                    className={`w-2 h-2 rounded-full ${selectedNode.status === 'running'
                                            ? 'bg-green-400'
                                            : selectedNode.status === 'error'
                                                ? 'bg-red-400'
                                                : 'bg-gray-400'
                                        }`}
                                />
                                <span className="capitalize">{selectedNode.status}</span>
                            </span>
                        </div>

                        {/* Resources */}
                        <div>
                            <label className="block text-xs text-gray-400 mb-2">Resources</label>
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-400">vCPU</span>
                                    <span className="text-white">
                                        {selectedNode.resources?.cpus || selectedNode.resources?.cpu || 1} cores
                                    </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-400">RAM</span>
                                    <span className="text-white">
                                        {selectedNode.resources?.ram
                                            ? selectedNode.resources.ram >= 1024
                                                ? `${(selectedNode.resources.ram / 1024).toFixed(1)} GB`
                                                : `${selectedNode.resources.ram} MB`
                                            : '1 GB'}
                                    </span>
                                </div>
                                {selectedNode.resources?.disk && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-400">Disk</span>
                                        <span className="text-white">{selectedNode.resources.disk} GB</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="pt-4 border-t border-lab-gray-light">
                            <label className="block text-xs text-gray-400 mb-2">Actions</label>
                            <div className="grid grid-cols-2 gap-2">
                                {selectedNode.status === 'stopped' ? (
                                    <button
                                        onClick={handleStartNode}
                                        disabled={isLoading}
                                        className="px-3 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                                    >
                                        ▶ Start
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleStopNode}
                                        disabled={isLoading || selectedNode.status !== 'running'}
                                        className="px-3 py-2 bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                                    >
                                        ⏹ Stop
                                    </button>
                                )}
                                <button
                                    onClick={handleWipeNode}
                                    disabled={isLoading || selectedNode.status === 'running'}
                                    className="px-3 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                                >
                                    🔄 Wipe
                                </button>
                                <button
                                    onClick={handleDeleteNode}
                                    disabled={isLoading}
                                    className="col-span-2 px-3 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                                >
                                    🗑️ Delete Node
                                </button>
                            </div>
                        </div>

                        {/* VNC/Console Info */}
                        {selectedNode.status === 'running' && selectedNode.guacUrl && (
                            <div className="pt-4 border-t border-lab-gray-light">
                                <label className="block text-xs text-gray-400 mb-2">Console</label>
                                <div className="text-xs text-gray-500 space-y-1">
                                    <div>VNC Port: {selectedNode.vncPort || 'N/A'}</div>
                                    <div className="truncate">Connection ID: {selectedNode.guacConnectionId}</div>
                                </div>
                            </div>
                        )}
                    </div>
                ) : selectedEdge ? (
                    <div className="space-y-4">
                        {/* Edge Info */}
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">Connection</label>
                            <div className="text-white font-medium">
                                {selectedEdge.source} → {selectedEdge.target}
                            </div>
                        </div>

                        {/* Edge Label */}
                        {selectedEdge.label && (
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">Interface</label>
                                <div className="text-gray-300">{String(selectedEdge.label)}</div>
                            </div>
                        )}

                        {/* Delete Edge */}
                        <div className="pt-4">
                            <button
                                onClick={onDeleteEdge}
                                className="w-full px-3 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition-colors"
                            >
                                🗑️ Delete Connection
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-8">
                        <div className="text-4xl mb-3">👆</div>
                        <p className="text-gray-400 text-sm">
                            Select a node or connection to view its properties
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
