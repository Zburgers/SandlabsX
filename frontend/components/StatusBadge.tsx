import React from 'react';
import type { NodeStatus } from '../lib/types';

interface StatusBadgeProps {
  status: NodeStatus;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const statusConfig = {
    running: {
      label: 'Running',
      color: 'bg-lab-accent text-white',
      icon: '●',
      pulse: true,
    },
    stopped: {
      label: 'Stopped',
      color: 'bg-lab-gray-light text-gray-300',
      icon: '○',
      pulse: false,
    },
    starting: {
      label: 'Starting',
      color: 'bg-lab-warning text-white',
      icon: '◐',
      pulse: true,
    },
    stopping: {
      label: 'Stopping',
      color: 'bg-lab-warning text-white',
      icon: '◑',
      pulse: true,
    },
    error: {
      label: 'Error',
      color: 'bg-lab-danger text-white',
      icon: '✕',
      pulse: false,
    },
  };

  const config = statusConfig[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${config.color}`}
    >
      <span className={config.pulse ? 'animate-pulse-glow' : ''}>
        {config.icon}
      </span>
      {config.label}
    </span>
  );
};
