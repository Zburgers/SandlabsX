'use client';

import React from 'react';

interface CanvasToolbarProps {
    onAddNode: () => void;
    onZoomIn: () => void;
    onZoomOut: () => void;
    onFitView: () => void;
    onAutoLayout: () => void;
    onExport: () => void;
    onDeleteSelected: () => void;
    hasSelection: boolean;
    hasUnsavedChanges: boolean;
}

export function CanvasToolbar({
    onAddNode,
    onZoomIn,
    onZoomOut,
    onFitView,
    onAutoLayout,
    onExport,
    onDeleteSelected,
    hasSelection,
    hasUnsavedChanges,
}: CanvasToolbarProps) {
    return (
        <div className="flex items-center gap-2 bg-lab-gray/90 backdrop-blur-sm rounded-xl p-2 border border-lab-gray-light shadow-lg">
            {/* Add Node */}
            <button
                onClick={onAddNode}
                className="flex items-center gap-2 px-3 py-2 bg-lab-primary hover:bg-lab-primary/80 text-white rounded-lg transition-colors text-sm font-medium"
                title="Add Node"
            >
                <span>➕</span>
                <span>Add Node</span>
            </button>

            <div className="w-px h-6 bg-lab-gray-light" />

            {/* Zoom Controls */}
            <button
                onClick={onZoomIn}
                className="p-2 hover:bg-lab-gray-light rounded-lg transition-colors text-gray-300 hover:text-white"
                title="Zoom In"
            >
                🔍+
            </button>
            <button
                onClick={onZoomOut}
                className="p-2 hover:bg-lab-gray-light rounded-lg transition-colors text-gray-300 hover:text-white"
                title="Zoom Out"
            >
                🔍-
            </button>
            <button
                onClick={onFitView}
                className="p-2 hover:bg-lab-gray-light rounded-lg transition-colors text-gray-300 hover:text-white"
                title="Fit View"
            >
                📐
            </button>

            <div className="w-px h-6 bg-lab-gray-light" />

            {/* Layout */}
            <button
                onClick={onAutoLayout}
                className="p-2 hover:bg-lab-gray-light rounded-lg transition-colors text-gray-300 hover:text-white"
                title="Auto Layout"
            >
                📊
            </button>

            {/* Export */}
            <button
                onClick={onExport}
                className="p-2 hover:bg-lab-gray-light rounded-lg transition-colors text-gray-300 hover:text-white"
                title="Export Topology"
            >
                📤
            </button>

            <div className="w-px h-6 bg-lab-gray-light" />

            {/* Delete Selected */}
            <button
                onClick={onDeleteSelected}
                disabled={!hasSelection}
                className={`p-2 rounded-lg transition-colors ${hasSelection
                        ? 'hover:bg-red-500/20 text-red-400 hover:text-red-300'
                        : 'text-gray-600 cursor-not-allowed'
                    }`}
                title="Delete Selected"
            >
                🗑️
            </button>

            {/* Unsaved Changes Indicator */}
            {hasUnsavedChanges && (
                <>
                    <div className="w-px h-6 bg-lab-gray-light" />
                    <div className="flex items-center gap-1.5 text-xs text-yellow-400 px-2">
                        <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                        <span>Unsaved</span>
                    </div>
                </>
            )}
        </div>
    );
}
