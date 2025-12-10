import type { Node as ReactFlowNode, Edge } from 'reactflow';
import dagre from '@dagrejs/dagre';
import type { Node as SandlabNode } from './types';

const STORAGE_KEY_PREFIX = 'sandlabx-canvas';

/**
 * Get localStorage key for canvas state
 */
export function getStorageKey(labId?: string): string {
    return labId ? `${STORAGE_KEY_PREFIX}-${labId}` : `${STORAGE_KEY_PREFIX}-default`;
}

/**
 * Apply Dagre auto-layout to nodes
 */
export function applyDagreLayout(
    nodes: ReactFlowNode[],
    edges: Edge[],
    direction: 'TB' | 'LR' = 'TB'
): ReactFlowNode[] {
    if (nodes.length === 0) return nodes;

    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));

    const nodeWidth = 180;
    const nodeHeight = 100;

    dagreGraph.setGraph({
        rankdir: direction,
        nodesep: 80,
        ranksep: 100,
        marginx: 50,
        marginy: 50,
    });

    // Add nodes to dagre
    nodes.forEach((node) => {
        dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
    });

    // Add edges to dagre
    edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target);
    });

    // Run layout
    dagre.layout(dagreGraph);

    // Apply positions
    return nodes.map((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);
        return {
            ...node,
            position: {
                x: nodeWithPosition.x - nodeWidth / 2,
                y: nodeWithPosition.y - nodeHeight / 2,
            },
        };
    });
}

/**
 * Topology export format matching PRD specification
 */
export interface TopologyExport {
    name: string;
    exportedAt: string;
    nodes: {
        id: string;
        name: string;
        osType: string;
        position: { x: number; y: number };
        data: {
            vcpus: number;
            memoryMb: number;
            diskGb?: number;
        };
    }[];
    edges: {
        id: string;
        source: string;
        target: string;
        sourceInterface: string;
        targetInterface: string;
        type: string;
    }[];
}

/**
 * Export topology to PRD-compliant JSON format
 */
export function exportTopology(
    nodes: ReactFlowNode[],
    edges: Edge[],
    backendNodes: Map<string, SandlabNode>
): TopologyExport {
    return {
        name: 'Untitled Lab',
        exportedAt: new Date().toISOString(),
        nodes: nodes.map((node) => {
            const backendNode = backendNodes.get(node.id);
            return {
                id: node.id,
                name: node.data?.label || backendNode?.name || 'Unknown',
                osType: node.data?.osType || backendNode?.osType || 'ubuntu',
                position: node.position,
                data: {
                    vcpus: node.data?.resources?.cpus || backendNode?.resources?.cpus || 1,
                    memoryMb: node.data?.resources?.ram || backendNode?.resources?.ram || 1024,
                    diskGb: node.data?.resources?.disk || backendNode?.resources?.disk,
                },
            };
        }),
        edges: edges.map((edge) => {
            const label = String(edge.label || 'eth0 ↔ eth0');
            const [sourceInterface, targetInterface] = label.split(' ↔ ');
            return {
                id: edge.id,
                source: edge.source,
                target: edge.target,
                sourceInterface: sourceInterface?.trim() || 'eth0',
                targetInterface: targetInterface?.trim() || 'eth0',
                type: 'tap',
            };
        }),
    };
}

/**
 * Validate topology for common issues
 */
export function validateTopology(
    nodes: ReactFlowNode[],
    edges: Edge[]
): { valid: boolean; warnings: string[] } {
    const warnings: string[] = [];
    const nodeIds = new Set(nodes.map((n) => n.id));

    // Check for orphan edges (pointing to non-existent nodes)
    edges.forEach((edge) => {
        if (!nodeIds.has(edge.source)) {
            warnings.push(`Edge ${edge.id} has invalid source: ${edge.source}`);
        }
        if (!nodeIds.has(edge.target)) {
            warnings.push(`Edge ${edge.id} has invalid target: ${edge.target}`);
        }
    });

    // Check for self-connections
    edges.forEach((edge) => {
        if (edge.source === edge.target) {
            warnings.push(`Self-connection detected on node ${edge.source}`);
        }
    });

    // Check for isolated nodes (no connections)
    const connectedNodes = new Set<string>();
    edges.forEach((edge) => {
        connectedNodes.add(edge.source);
        connectedNodes.add(edge.target);
    });
    nodes.forEach((node) => {
        if (!connectedNodes.has(node.id)) {
            warnings.push(`Node ${node.data?.label || node.id} has no connections`);
        }
    });

    return {
        valid: warnings.length === 0,
        warnings,
    };
}
