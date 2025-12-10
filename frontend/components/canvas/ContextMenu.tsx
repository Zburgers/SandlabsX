'use client';

import React, { useEffect, useRef } from 'react';

export interface ContextMenuState {
    x: number;
    y: number;
    type: 'node' | 'canvas';
    nodeId?: string;
}

interface ContextMenuProps {
    state: ContextMenuState;
    onClose: () => void;
    onAddNode: () => void;
    onStartNode: (nodeId: string) => void;
    onStopNode: (nodeId: string) => void;
    onDeleteNode: (nodeId: string) => void;
}

export function ContextMenu({
    state,
    onClose,
    onAddNode,
    onStartNode,
    onStopNode,
    onDeleteNode,
}: ContextMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);

    // Close menu on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        };

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [onClose]);

    // Adjust position to stay in viewport
    const style: React.CSSProperties = {
        position: 'fixed',
        left: state.x,
        top: state.y,
        zIndex: 1000,
    };

    return (
        <div
            ref={menuRef}
            className="bg-lab-gray border border-lab-gray-light rounded-xl shadow-xl overflow-hidden min-w-[160px]"
            style={style}
        >
            {state.type === 'canvas' ? (
                // Canvas context menu
                <div className="py-1">
                    <button
                        onClick={onAddNode}
                        className="w-full px-4 py-2 text-left text-sm text-white hover:bg-lab-gray-light flex items-center gap-2 transition-colors"
                    >
                        <span>➕</span>
                        <span>Add Node</span>
                    </button>
                </div>
            ) : (
                // Node context menu
                <div className="py-1">
                    <button
                        onClick={() => state.nodeId && onStartNode(state.nodeId)}
                        className="w-full px-4 py-2 text-left text-sm text-white hover:bg-lab-gray-light flex items-center gap-2 transition-colors"
                    >
                        <span>▶️</span>
                        <span>Start Node</span>
                    </button>
                    <button
                        onClick={() => state.nodeId && onStopNode(state.nodeId)}
                        className="w-full px-4 py-2 text-left text-sm text-white hover:bg-lab-gray-light flex items-center gap-2 transition-colors"
                    >
                        <span>⏹️</span>
                        <span>Stop Node</span>
                    </button>
                    <div className="border-t border-lab-gray-light my-1" />
                    <button
                        onClick={() => state.nodeId && onDeleteNode(state.nodeId)}
                        className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-red-500/20 flex items-center gap-2 transition-colors"
                    >
                        <span>🗑️</span>
                        <span>Delete Node</span>
                    </button>
                </div>
            )}
        </div>
    );
}
