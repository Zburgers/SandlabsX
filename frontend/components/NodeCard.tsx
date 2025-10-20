'use client';

import React, { useState } from 'react';
import type { Node } from '../lib/types';
import { Button } from './Button';
import { StatusBadge } from './StatusBadge';

interface NodeCardProps {
  node: Node;
  onStart: (id: string) => Promise<void>;
  onStop: (id: string) => Promise<void>;
  onWipe: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onConnect: (node: Node) => void;
}

export const NodeCard: React.FC<NodeCardProps> = ({
  node,
  onStart,
  onStop,
  onWipe,
  onDelete,
  onConnect,
}) => {
  const [loading, setLoading] = useState<string | null>(null);
  const [showWipeConfirm, setShowWipeConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleAction = async (action: () => Promise<void>, actionName: string) => {
    setLoading(actionName);
    try {
      await action();
    } finally {
      setLoading(null);
    }
  };

  const handleWipeClick = () => {
    if (!showWipeConfirm) {
      setShowWipeConfirm(true);
      setTimeout(() => setShowWipeConfirm(false), 5000); // Auto-hide after 5s
      return;
    }
    handleAction(() => onWipe(node.id), 'wipe');
    setShowWipeConfirm(false);
  };

  const handleDeleteClick = () => {
    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true);
      setTimeout(() => setShowDeleteConfirm(false), 5000); // Auto-hide after 5s
      return;
    }
    handleAction(() => onDelete(node.id), 'delete');
    setShowDeleteConfirm(false);
  };

  const getImageIcon = (type: string) => {
    const icons: Record<string, string> = {
      ubuntu: '🐧',
      alpine: '🏔️',
      debian: '🌀',
      fedora: '🎩',
      arch: '🔧',
    };
    return icons[type] || '💻';
  };

  const getImageName = (type: string) => {
    const names: Record<string, string> = {
      ubuntu: 'Ubuntu 24 LTS',
      alpine: 'Alpine Linux',
      debian: 'Debian 13',
      fedora: 'Fedora',
      arch: 'Arch Linux',
    };
    return names[type] || 'Unknown OS';
  };

  const osType = node.osType || node.baseImage || 'ubuntu';

  return (
    <div className="group bg-gradient-to-br from-lab-gray to-lab-gray/50 rounded-2xl border border-lab-gray-light hover:border-lab-primary/60 transition-all duration-500 overflow-hidden shadow-lg hover:shadow-lab-primary/20 hover:scale-[1.02]">
      {/* Header with gradient */}
      <div className="relative p-5 border-b border-lab-gray-light bg-gradient-to-r from-lab-primary/5 to-lab-secondary/5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="text-4xl filter drop-shadow-lg group-hover:scale-110 transition-transform duration-300">
              {getImageIcon(osType)}
            </div>
            <div>
              <h3 className="text-xl font-bold text-white mb-1 tracking-tight">{node.name}</h3>
              <p className="text-xs text-gray-400 font-mono bg-lab-darker/50 px-2 py-1 rounded inline-block">
                {node.id.substring(0, 13)}...
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <StatusBadge status={node.status} />
          </div>
        </div>
      </div>

      {/* Details with better spacing */}
      <div className="p-5 space-y-4">
        {/* Base Image Display */}
        <div className="bg-gradient-to-r from-lab-primary/10 to-lab-secondary/10 rounded-xl p-3 border border-lab-primary/20">
          <p className="text-xs text-gray-400 mb-1">Base Image</p>
          <p className="text-sm font-semibold text-white capitalize flex items-center gap-2">
            <span>{getImageIcon(osType)}</span>
            {getImageName(osType)}
          </p>
        </div>

        {/* Resource Grid */}
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="bg-lab-darker/70 rounded-xl p-3 border border-lab-gray-light/30 hover:border-lab-primary/40 transition-colors">
            <p className="text-gray-400 text-xs mb-1.5 uppercase tracking-wide">CPU</p>
            <p className="text-white font-bold text-lg">{node.resources.cpus || node.resources.cpu || 2}</p>
            <p className="text-xs text-gray-500">cores</p>
          </div>
          <div className="bg-lab-darker/70 rounded-xl p-3 border border-lab-gray-light/30 hover:border-lab-primary/40 transition-colors">
            <p className="text-gray-400 text-xs mb-1.5 uppercase tracking-wide">RAM</p>
            <p className="text-white font-bold text-lg">{node.resources.ram}</p>
            <p className="text-xs text-gray-500">MB</p>
          </div>
          <div className="bg-lab-darker/70 rounded-xl p-3 border border-lab-gray-light/30 hover:border-lab-primary/40 transition-colors">
            <p className="text-gray-400 text-xs mb-1.5 uppercase tracking-wide">Disk</p>
            <p className="text-white font-bold text-lg">{node.resources.disk || 10}</p>
            <p className="text-xs text-gray-500">GB</p>
          </div>
        </div>

        {node.vncPort && (
          <div className="bg-lab-accent/10 border border-lab-accent/30 rounded-xl p-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-gray-400 uppercase tracking-wide">VNC Port</span>
              <span className="text-lab-accent font-mono font-bold text-sm">{node.vncPort}</span>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-5 bg-lab-darker/50 border-t border-lab-gray-light space-y-3">
        {node.status === 'running' && (
          <>
            <Button
              variant="primary"
              className="w-full"
              onClick={() => onConnect(node)}
              icon={<span>🖥️</span>}
            >
              Connect Console
            </Button>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                className="flex-1"
                onClick={() => handleAction(() => onStop(node.id), 'stop')}
                loading={loading === 'stop'}
              >
                Stop
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleWipeClick}
                loading={loading === 'wipe'}
                title="Reset VM - Wipes all data, keeps VM in list"
              >
                {showWipeConfirm ? 'Confirm Wipe?' : 'Wipe'}
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleDeleteClick}
                loading={loading === 'delete'}
                title="Delete VM - Removes completely from system"
              >
                {showDeleteConfirm ? 'Confirm?' : '🗑️'}
              </Button>
            </div>
          </>
        )}

        {node.status === 'stopped' && (
          <>
            <div className="flex gap-2 mb-2">
              <Button
                variant="primary"
                className="flex-1"
                onClick={() => handleAction(() => onStart(node.id), 'start')}
                loading={loading === 'start'}
                icon={<span>▶️</span>}
              >
                Start
              </Button>
            </div>
            <div className="flex gap-2">
              <Button
                variant="danger"
                size="sm"
                className="flex-1"
                onClick={handleWipeClick}
                loading={loading === 'wipe'}
                title="Reset VM - Wipes all data, keeps VM in list"
              >
                {showWipeConfirm ? 'Confirm?' : 'Wipe Disk'}
              </Button>
              <Button
                variant="danger"
                size="sm"
                className="flex-1"
                onClick={handleDeleteClick}
                loading={loading === 'delete'}
                title="Delete VM - Removes completely from system"
              >
                {showDeleteConfirm ? 'Confirm?' : 'Delete VM'}
              </Button>
            </div>
          </>
        )}

        {(node.status === 'starting' || node.status === 'stopping') && (
          <Button variant="ghost" className="w-full" disabled>
            Processing...
          </Button>
        )}

        {node.status === 'error' && (
          <div className="text-center">
            <p className="text-lab-danger text-sm mb-2">⚠️ Error state</p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleAction(() => onWipe(node.id), 'wipe')}
              loading={loading === 'wipe'}
            >
              Reset Node
            </Button>
          </div>
        )}
      </div>

      {showWipeConfirm && (
        <div className="px-4 py-2 bg-lab-danger/20 border-t border-lab-danger/50 text-xs text-center text-lab-danger">
          ⚠️ This will delete all data. Click again to confirm.
        </div>
      )}
    </div>
  );
};
