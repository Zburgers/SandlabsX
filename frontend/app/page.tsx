'use client';

import React, { useState, useEffect } from 'react';
import type { Node, CreateNodeRequest } from '../lib/types';
import { Button } from '../components/Button';
import { NodeCard } from '../components/NodeCard';
import { CreateNodeModal } from '../components/CreateNodeModal';
import { GuacamoleViewer } from '../components/GuacamoleViewer';
import { apiClient } from '../lib/api';

export default function Home() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load nodes on component mount
  useEffect(() => {
    loadNodes();
  }, []);

  const loadNodes = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.listNodes();
      if (response.success && response.data) {
        setNodes(response.data.nodes);
      } else {
        setError(response.error || 'Failed to load nodes');
        setNodes([]); // Empty state if API fails
      }
    } catch (err) {
      setError('Failed to connect to backend API. Is the backend running?');
      console.error('Load nodes error:', err);
      setNodes([]); // Empty state on error
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNode = async (data: CreateNodeRequest) => {
    try {
      const response = await apiClient.createNode(data);
      if (response.success && response.data) {
        await loadNodes(); // Reload list
      } else {
        throw new Error(response.error || 'Failed to create node');
      }
    } catch (err) {
      console.error('Create node error:', err);
      alert('Failed to create node: ' + (err instanceof Error ? err.message : 'Unknown error'));
      throw err;
    }
  };

  const handleStartNode = async (id: string) => {
    try {
      const response = await apiClient.startNode(id);
      if (response.success) {
        await loadNodes();
      } else {
        throw new Error(response.error || 'Failed to start node');
      }
    } catch (err) {
      console.error('Start node error:', err);
      alert('Failed to start node: ' + (err instanceof Error ? err.message : 'Unknown error'));
      throw err;
    }
  };

  const handleStopNode = async (id: string) => {
    try {
      const response = await apiClient.stopNode(id);
      if (response.success) {
        await loadNodes();
      } else {
        throw new Error(response.error || 'Failed to stop node');
      }
    } catch (err) {
      console.error('Stop node error:', err);
      alert('Failed to stop node: ' + (err instanceof Error ? err.message : 'Unknown error'));
      throw err;
    }
  };

  const handleWipeNode = async (id: string) => {
    try {
      const response = await apiClient.wipeNode(id);
      if (response.success) {
        await loadNodes();
      } else {
        throw new Error(response.error || 'Failed to wipe node');
      }
    } catch (err) {
      console.error('Wipe node error:', err);
      alert('Failed to wipe node: ' + (err instanceof Error ? err.message : 'Unknown error'));
      throw err;
    }
  };

  const handleDeleteNode = async (id: string) => {
    try {
      const response = await apiClient.deleteNode(id);
      if (response.success) {
        await loadNodes(); // Reload the list - deleted node will be gone
      } else {
        throw new Error(response.error || 'Failed to delete node');
      }
    } catch (err) {
      console.error('Delete node error:', err);
      alert('Failed to delete node: ' + (err instanceof Error ? err.message : 'Unknown error'));
      throw err;
    }
  };

  const handleConnectNode = (node: Node) => {
    if (node.guacUrl) {
      setSelectedNode(node);
    }
  };

  return (
    <>
      {/* Guacamole Viewer */}
      {selectedNode && (
        <GuacamoleViewer
          node={selectedNode}
          onClose={() => setSelectedNode(null)}
        />
      )}

      {/* Main Content */}
      <div className="min-h-screen bg-lab-darker grid-pattern">
        {/* Header */}
        <header className="bg-lab-gray/50 backdrop-blur-md border-b border-lab-gray-light sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-gradient-to-br from-lab-primary to-lab-secondary rounded-lg flex items-center justify-center">
                  <span className="text-2xl">⚡</span>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">SandLabX</h1>
                  <p className="text-sm text-gray-400">Network Lab Environment</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="hidden sm:flex items-center gap-2 text-sm">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-lab-accent/20 text-lab-accent rounded-full">
                    <span className="animate-pulse-glow">●</span>
                    <span>{nodes.filter(n => n.status === 'running').length} Running</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-lab-gray text-gray-300 rounded-full">
                    <span>○</span>
                    <span>{nodes.filter(n => n.status === 'stopped').length} Stopped</span>
                  </div>
                </div>
                <Button
                  variant="primary"
                  onClick={() => setIsCreateModalOpen(true)}
                  icon={<span>+</span>}
                >
                  Add Node
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-lab-gray rounded-xl p-6 border border-lab-gray-light">
              <p className="text-gray-400 text-sm mb-1">Total Nodes</p>
              <p className="text-3xl font-bold text-white">{nodes.length}</p>
            </div>
            <div className="bg-lab-gray rounded-xl p-6 border border-lab-gray-light">
              <p className="text-gray-400 text-sm mb-1">Running</p>
              <p className="text-3xl font-bold text-lab-accent">
                {nodes.filter(n => n.status === 'running').length}
              </p>
            </div>
            <div className="bg-lab-gray rounded-xl p-6 border border-lab-gray-light">
              <p className="text-gray-400 text-sm mb-1">Stopped</p>
              <p className="text-3xl font-bold text-gray-300">
                {nodes.filter(n => n.status === 'stopped').length}
              </p>
            </div>
            <div className="bg-lab-gray rounded-xl p-6 border border-lab-gray-light">
              <p className="text-gray-400 text-sm mb-1">Total vCPUs</p>
              <p className="text-3xl font-bold text-white">
                {nodes.reduce((sum, n) => sum + (n.resources.cpus || n.resources.cpu || 0), 0)}
              </p>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-lab-danger/20 border border-lab-danger rounded-xl p-4 mb-6">
              <p className="text-lab-danger">⚠️ {error}</p>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lab-primary mx-auto mb-4"></div>
                <p className="text-gray-400">Loading nodes...</p>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!loading && nodes.length === 0 && (
            <div className="bg-lab-gray rounded-xl border border-lab-gray-light p-12 text-center">
              <div className="max-w-md mx-auto">
                <div className="text-6xl mb-4">🚀</div>
                <h3 className="text-xl font-semibold text-white mb-2">
                  No nodes yet
                </h3>
                <p className="text-gray-400 mb-6">
                  Create your first virtual node to get started with your network lab.
                </p>
                <Button
                  variant="primary"
                  onClick={() => setIsCreateModalOpen(true)}
                  icon={<span>+</span>}
                >
                  Create First Node
                </Button>
              </div>
            </div>
          )}

          {/* Nodes Grid */}
          {!loading && nodes.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {nodes.map((node) => (
                <NodeCard
                  key={node.id}
                  node={node}
                  onStart={handleStartNode}
                  onStop={handleStopNode}
                  onWipe={handleWipeNode}
                  onDelete={handleDeleteNode}
                  onConnect={handleConnectNode}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Create Node Modal */}
      <CreateNodeModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={handleCreateNode}
      />
    </>
  );
}
