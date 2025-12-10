'use client';

import React, { useCallback, useRef, useState, useEffect } from 'react';
import ReactFlow, {
    Node,
    Edge,
    Controls,
    Background,
    MiniMap,
    useNodesState,
    useEdgesState,
    addEdge,
    Connection,
    NodeTypes,
    EdgeTypes,
    ReactFlowProvider,
    useReactFlow,
    Panel,
    BackgroundVariant,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { NetworkNode } from './NetworkNode';
import { CanvasToolbar } from './CanvasToolbar';
import { PropertiesPanel } from './PropertiesPanel';
import { ContextMenu, ContextMenuState } from './ContextMenu';
import { AddNodeModal } from './AddNodeModal';
import { apiClient } from '../../lib/api';
import type { Node as SandlabNode, CreateNodeRequest } from '../../lib/types';
import { applyDagreLayout, exportTopology, getStorageKey, TopologyExport } from '../../lib/topologyUtils';

// Custom node types
const nodeTypes: NodeTypes = {
    networkNode: NetworkNode,
};

interface CanvasEditorProps {
    labId?: string;
}

// Inner component that uses ReactFlow hooks
function CanvasFlow({ labId }: CanvasEditorProps) {
    const reactFlowWrapper = useRef<HTMLDivElement>(null);
    const { fitView, zoomIn, zoomOut, getNodes, getEdges } = useReactFlow();

    // ReactFlow state
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);

    // UI state
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
    const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
    const [isAddNodeModalOpen, setIsAddNodeModalOpen] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [loading, setLoading] = useState(true);

    // Backend nodes (for properties panel)
    const [backendNodes, setBackendNodes] = useState<Map<string, SandlabNode>>(new Map());

    // Load nodes from API
    const loadNodes = useCallback(async () => {
        try {
            const response = await apiClient.listNodes();
            if (response.success && response.data) {
                const apiNodes = response.data.nodes;

                // Store backend nodes for properties panel
                const nodeMap = new Map<string, SandlabNode>();
                apiNodes.forEach(n => nodeMap.set(n.id, n));
                setBackendNodes(nodeMap);

                // Try to load positions from localStorage
                const storageKey = getStorageKey(labId);
                const stored = localStorage.getItem(storageKey);
                let storedPositions: Record<string, { x: number; y: number }> = {};

                if (stored) {
                    try {
                        const parsed = JSON.parse(stored);
                        storedPositions = parsed.positions || {};
                    } catch (e) {
                        console.warn('Failed to parse stored positions:', e);
                    }
                }

                // Convert API nodes to ReactFlow nodes
                const rfNodes: Node[] = apiNodes.map((node, index) => ({
                    id: node.id,
                    type: 'networkNode',
                    position: storedPositions[node.id] || {
                        x: 100 + (index % 5) * 200,
                        y: 100 + Math.floor(index / 5) * 150
                    },
                    data: {
                        label: node.name,
                        status: node.status,
                        osType: node.osType,
                        resources: node.resources,
                    },
                }));

                setNodes(rfNodes);

                // Load edges from localStorage (connections are stored locally for now)
                if (stored) {
                    try {
                        const parsed = JSON.parse(stored);
                        if (parsed.edges) {
                            setEdges(parsed.edges);
                        }
                    } catch (e) {
                        console.warn('Failed to parse stored edges:', e);
                    }
                }
            }
        } catch (error) {
            console.error('Failed to load nodes:', error);
        } finally {
            setLoading(false);
        }
    }, [labId, setNodes, setEdges]);

    // Initial load
    useEffect(() => {
        loadNodes();
    }, [loadNodes]);

    // Auto-save to localStorage (debounced)
    useEffect(() => {
        if (loading) return;

        const saveTimer = setTimeout(() => {
            const storageKey = getStorageKey(labId);
            const positions: Record<string, { x: number; y: number }> = {};
            nodes.forEach(node => {
                positions[node.id] = node.position;
            });

            localStorage.setItem(storageKey, JSON.stringify({
                positions,
                edges,
                savedAt: new Date().toISOString(),
            }));

            setHasUnsavedChanges(false);
        }, 2000);

        return () => clearTimeout(saveTimer);
    }, [nodes, edges, labId, loading]);

    // Track changes
    const handleNodesChange = useCallback((changes: any) => {
        onNodesChange(changes);
        setHasUnsavedChanges(true);
    }, [onNodesChange]);

    const handleEdgesChange = useCallback((changes: any) => {
        onEdgesChange(changes);
        setHasUnsavedChanges(true);
    }, [onEdgesChange]);

    // Handle new connections
    const onConnect = useCallback((params: Connection) => {
        if (params.source === params.target) {
            // Prevent self-connections
            return;
        }

        const newEdge: Edge = {
            id: `edge-${params.source}-${params.target}`,
            source: params.source!,
            target: params.target!,
            sourceHandle: params.sourceHandle,
            targetHandle: params.targetHandle,
            label: 'eth0 ↔ eth0',
            style: { stroke: '#3b82f6', strokeWidth: 2 },
            animated: false,
        };

        setEdges((eds) => addEdge(newEdge, eds));
        setHasUnsavedChanges(true);
    }, [setEdges]);

    // Handle node selection
    const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
        setSelectedNodeId(node.id);
        setSelectedEdgeId(null);
        setContextMenu(null);
    }, []);

    // Handle edge selection
    const onEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => {
        setSelectedEdgeId(edge.id);
        setSelectedNodeId(null);
        setContextMenu(null);
    }, []);

    // Handle canvas click (deselect)
    const onPaneClick = useCallback(() => {
        setSelectedNodeId(null);
        setSelectedEdgeId(null);
        setContextMenu(null);
    }, []);

    // Handle right-click context menu
    const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
        event.preventDefault();
        setContextMenu({
            x: event.clientX,
            y: event.clientY,
            type: 'node',
            nodeId: node.id,
        });
        setSelectedNodeId(node.id);
    }, []);

    const onPaneContextMenu = useCallback((event: React.MouseEvent) => {
        event.preventDefault();
        setContextMenu({
            x: event.clientX,
            y: event.clientY,
            type: 'canvas',
        });
    }, []);

    // Toolbar actions
    const handleAutoLayout = useCallback(() => {
        const layoutedNodes = applyDagreLayout(nodes, edges);
        setNodes(layoutedNodes);
        setHasUnsavedChanges(true);
        setTimeout(() => fitView({ padding: 0.2 }), 50);
    }, [nodes, edges, setNodes, fitView]);

    const handleExport = useCallback(() => {
        const topology = exportTopology(nodes, edges, backendNodes);
        const blob = new Blob([JSON.stringify(topology, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `topology-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }, [nodes, edges, backendNodes]);

    const handleDeleteSelected = useCallback(() => {
        if (selectedNodeId) {
            setNodes((nds) => nds.filter((n) => n.id !== selectedNodeId));
            setEdges((eds) => eds.filter((e) => e.source !== selectedNodeId && e.target !== selectedNodeId));
            setSelectedNodeId(null);
        } else if (selectedEdgeId) {
            setEdges((eds) => eds.filter((e) => e.id !== selectedEdgeId));
            setSelectedEdgeId(null);
        }
        setHasUnsavedChanges(true);
    }, [selectedNodeId, selectedEdgeId, setNodes, setEdges]);

    // Context menu actions
    const handleStartNode = useCallback(async (nodeId: string) => {
        try {
            await apiClient.startNode(nodeId);
            await loadNodes();
        } catch (error) {
            console.error('Failed to start node:', error);
        }
        setContextMenu(null);
    }, [loadNodes]);

    const handleStopNode = useCallback(async (nodeId: string) => {
        try {
            await apiClient.stopNode(nodeId);
            await loadNodes();
        } catch (error) {
            console.error('Failed to stop node:', error);
        }
        setContextMenu(null);
    }, [loadNodes]);

    const handleDeleteNode = useCallback(async (nodeId: string) => {
        try {
            await apiClient.deleteNode(nodeId);
            setNodes((nds) => nds.filter((n) => n.id !== nodeId));
            setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
            await loadNodes();
        } catch (error) {
            console.error('Failed to delete node:', error);
        }
        setContextMenu(null);
    }, [loadNodes, setNodes, setEdges]);

    // Create new node
    const handleCreateNode = useCallback(async (data: CreateNodeRequest) => {
        try {
            const response = await apiClient.createNode(data);
            if (response.success) {
                await loadNodes();
                setIsAddNodeModalOpen(false);
            }
        } catch (error) {
            console.error('Failed to create node:', error);
            throw error;
        }
    }, [loadNodes]);

    // Get selected node/edge data for properties panel
    const selectedNode = selectedNodeId ? backendNodes.get(selectedNodeId) : null;
    const selectedEdge = selectedEdgeId ? edges.find(e => e.id === selectedEdgeId) : null;

    if (loading) {
        return (
            <div className="h-full w-full flex items-center justify-center bg-lab-darker">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lab-primary mx-auto mb-4"></div>
                    <p className="text-gray-400">Loading canvas...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full w-full flex" ref={reactFlowWrapper}>
            {/* Main Canvas */}
            <div className="flex-1 relative">
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={handleNodesChange}
                    onEdgesChange={handleEdgesChange}
                    onConnect={onConnect}
                    onNodeClick={onNodeClick}
                    onEdgeClick={onEdgeClick}
                    onPaneClick={onPaneClick}
                    onNodeContextMenu={onNodeContextMenu}
                    onPaneContextMenu={onPaneContextMenu}
                    nodeTypes={nodeTypes}
                    fitView
                    className="bg-lab-darker"
                    defaultEdgeOptions={{
                        style: { stroke: '#3b82f6', strokeWidth: 2 },
                        animated: false,
                    }}
                >
                    <Background
                        variant={BackgroundVariant.Dots}
                        gap={20}
                        size={1}
                        color="#374151"
                    />
                    <Controls className="!bg-lab-gray !border-lab-gray-light" />
                    <MiniMap
                        className="!bg-lab-gray !border-lab-gray-light"
                        nodeColor={(node) => {
                            const status = node.data?.status;
                            if (status === 'running') return '#10b981';
                            if (status === 'error') return '#ef4444';
                            return '#6b7280';
                        }}
                    />

                    {/* Toolbar */}
                    <Panel position="top-left">
                        <CanvasToolbar
                            onAddNode={() => setIsAddNodeModalOpen(true)}
                            onZoomIn={() => zoomIn()}
                            onZoomOut={() => zoomOut()}
                            onFitView={() => fitView({ padding: 0.2 })}
                            onAutoLayout={handleAutoLayout}
                            onExport={handleExport}
                            onDeleteSelected={handleDeleteSelected}
                            hasSelection={!!(selectedNodeId || selectedEdgeId)}
                            hasUnsavedChanges={hasUnsavedChanges}
                        />
                    </Panel>
                </ReactFlow>

                {/* Context Menu */}
                {contextMenu && (
                    <ContextMenu
                        state={contextMenu}
                        onClose={() => setContextMenu(null)}
                        onAddNode={() => {
                            setIsAddNodeModalOpen(true);
                            setContextMenu(null);
                        }}
                        onStartNode={handleStartNode}
                        onStopNode={handleStopNode}
                        onDeleteNode={handleDeleteNode}
                    />
                )}
            </div>

            {/* Properties Panel */}
            <PropertiesPanel
                selectedNode={selectedNode}
                selectedEdge={selectedEdge}
                onRefresh={loadNodes}
                onDeleteEdge={() => {
                    if (selectedEdgeId) {
                        setEdges((eds) => eds.filter((e) => e.id !== selectedEdgeId));
                        setSelectedEdgeId(null);
                        setHasUnsavedChanges(true);
                    }
                }}
            />

            {/* Add Node Modal */}
            <AddNodeModal
                isOpen={isAddNodeModalOpen}
                onClose={() => setIsAddNodeModalOpen(false)}
                onCreate={handleCreateNode}
            />
        </div>
    );
}

// Main component with provider
export function CanvasEditor({ labId }: CanvasEditorProps) {
    return (
        <ReactFlowProvider>
            <CanvasFlow labId={labId} />
        </ReactFlowProvider>
    );
}
