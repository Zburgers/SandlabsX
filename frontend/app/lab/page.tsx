'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';

// Dynamic import to avoid SSR issues with ReactFlow
const CanvasEditor = dynamic(
    () => import('../../components/canvas/CanvasEditor').then((mod) => mod.CanvasEditor),
    {
        ssr: false,
        loading: () => (
            <div className="h-screen w-screen flex items-center justify-center bg-lab-darker">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lab-primary mx-auto mb-4"></div>
                    <p className="text-gray-400">Loading Canvas Editor...</p>
                </div>
            </div>
        ),
    }
);

export default function LabPage() {
    return (
        <div className="h-screen w-screen flex flex-col bg-lab-darker">
            {/* Header */}
            <header className="bg-lab-gray/80 backdrop-blur-sm border-b border-lab-gray-light px-4 py-3 flex items-center justify-between z-50">
                <div className="flex items-center gap-4">
                    <Link
                        href="/"
                        className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
                    >
                        <span>←</span>
                        <span className="text-sm">Back to Dashboard</span>
                    </Link>
                    <div className="w-px h-6 bg-lab-gray-light" />
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gradient-to-br from-lab-primary to-lab-secondary rounded-lg flex items-center justify-center">
                            <span className="text-lg">⚡</span>
                        </div>
                        <div>
                            <h1 className="text-lg font-semibold text-white">Canvas Editor</h1>
                            <p className="text-xs text-gray-400">Network Topology Designer</p>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500">Drag nodes to arrange • Right-click for options</span>
                </div>
            </header>

            {/* Canvas */}
            <main className="flex-1 overflow-hidden">
                <CanvasEditor />
            </main>
        </div>
    );
}
