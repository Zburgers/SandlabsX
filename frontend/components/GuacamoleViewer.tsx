'use client';

import React, { useState } from 'react';
import type { Node } from '../lib/types';
import { Button } from './Button';

interface GuacamoleViewerProps {
  node: Node | null;
  onClose: () => void;
}

export const GuacamoleViewer: React.FC<GuacamoleViewerProps> = ({
  node,
  onClose,
}) => {
  const [showControls, setShowControls] = useState(true);
  const [showTooltip, setShowTooltip] = useState(false);

  if (!node || !node.guacUrl) return null;

  const openInNewTab = () => {
    window.open(node.guacUrl!, '_blank');
  };

  const sendCtrlAltDel = () => {
    // This would need Guacamole API integration
    alert('Ctrl+Alt+Del: This feature requires Guacamole keyboard API integration');
  };

  return (
    <div className="fixed inset-0 z-50 bg-lab-darker">
      {/* Header with VM Controls */}
      <div className="bg-lab-gray border-b border-lab-gray-light p-3">
        <div className="flex items-center justify-between">
          {/* Left: Back button and Node info */}
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={onClose}>
              <svg
                className="w-5 h-5"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
              </svg>
              Back to Dashboard
            </Button>
            <div className="border-l border-lab-gray-light pl-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <h2 className="text-base font-semibold text-white">{node.name}</h2>
                <span className="text-xs text-gray-400 px-2 py-0.5 bg-lab-darker rounded">
                  VNC: {node.vncPort}
                </span>
              </div>
            </div>
          </div>

          {/* Center: VM Controls Toolbar */}
          <div className="flex items-center gap-1 bg-lab-darker rounded-lg p-1">
            {/* Ctrl+Alt+Del */}
            <button
              onClick={sendCtrlAltDel}
              className="px-3 py-1.5 text-xs text-gray-300 hover:text-white hover:bg-lab-gray rounded transition-colors"
              title="Send Ctrl+Alt+Del"
            >
              <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
              Ctrl+Alt+Del
            </button>

            <div className="w-px h-6 bg-lab-gray-light"></div>

            {/* Fullscreen Toggle */}
            <button
              onClick={() => {
                const elem = document.querySelector('iframe');
                if (elem) {
                  if (document.fullscreenElement) {
                    document.exitFullscreen();
                  } else {
                    elem.requestFullscreen();
                  }
                }
              }}
              className="px-3 py-1.5 text-xs text-gray-300 hover:text-white hover:bg-lab-gray rounded transition-colors"
              title="Fullscreen"
            >
              <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
              Fullscreen
            </button>

            <div className="w-px h-6 bg-lab-gray-light"></div>

            {/* Screenshot */}
            <button
              className="px-3 py-1.5 text-xs text-gray-300 hover:text-white hover:bg-lab-gray rounded transition-colors"
              title="Screenshot"
            >
              <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Screenshot
            </button>

            <div className="w-px h-6 bg-lab-gray-light"></div>

            {/* Clipboard */}
            <button
              className="px-3 py-1.5 text-xs text-gray-300 hover:text-white hover:bg-lab-gray rounded transition-colors"
              title="Clipboard"
            >
              <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Clipboard
            </button>
          </div>

          {/* Right: Additional controls */}
          <div className="flex items-center gap-2">
            <div className="text-xs text-gray-400 px-3 py-1.5 bg-lab-darker rounded">
              <span className="text-gray-500">RAM:</span> {node.resources.ram}MB
              <span className="mx-2">•</span>
              <span className="text-gray-500">CPU:</span> {node.resources.cpus || node.resources.cpu || 2} cores
            </div>
            
            {/* Info tooltip */}
            <div className="relative">
              <button
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                className="p-2 text-blue-400 hover:text-blue-300 hover:bg-lab-darker rounded transition-colors"
                title="Console interaction info"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
              
              {/* Tooltip */}
              {showTooltip && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-lab-gray border border-lab-gray-light rounded-lg shadow-2xl z-50 p-4">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <h4 className="text-sm font-semibold text-white mb-2">Console Interaction</h4>
                      <p className="text-xs text-gray-300 leading-relaxed">
                        If you're unable to interact with the VM console in this embedded view, 
                        click the <span className="text-blue-400 font-medium">"New Tab"</span> button 
                        to open it in a separate window for full keyboard and mouse control.
                      </p>
                    </div>
                  </div>
                  {/* Arrow */}
                  <div className="absolute -top-2 right-4 w-4 h-4 bg-lab-gray border-t border-l border-lab-gray-light rotate-45"></div>
                </div>
              )}
            </div>
            
            <Button variant="secondary" size="sm" onClick={openInNewTab}>
              <svg
                className="w-4 h-4 mr-1.5"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
              </svg>
              New Tab
            </Button>
          </div>
        </div>

        {/* Secondary toolbar - Optional keyboard shortcuts */}
        {showControls && (
          <div className="mt-2 flex items-center gap-3 text-xs text-gray-500 px-2">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-lab-darker rounded border border-lab-gray-light">Ctrl</kbd>
              <kbd className="px-1.5 py-0.5 bg-lab-darker rounded border border-lab-gray-light">Alt</kbd>
              <span>+ click for right-click</span>
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-lab-darker rounded border border-lab-gray-light">Ctrl</kbd>
              <kbd className="px-1.5 py-0.5 bg-lab-darker rounded border border-lab-gray-light">Alt</kbd>
              <kbd className="px-1.5 py-0.5 bg-lab-darker rounded border border-lab-gray-light">Shift</kbd>
              <span>for clipboard</span>
            </span>
            <button 
              onClick={() => setShowControls(false)}
              className="ml-auto text-gray-600 hover:text-gray-400"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Console iframe */}
      <div className="h-[calc(100vh-73px)] bg-black">
        <iframe
          src={node.guacUrl}
          className="w-full h-full border-0"
          title={`Console for ${node.name}`}
          allow="clipboard-read; clipboard-write"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
        />
      </div>

      {/* Connection info overlay (bottom right) */}
      <div className="absolute bottom-4 right-4 bg-lab-gray/90 backdrop-blur-sm border border-lab-gray-light rounded-lg p-3 text-xs">
        <div className="flex items-center gap-2 text-green-400 mb-1">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="font-semibold">Connected</span>
        </div>
        <div className="text-gray-400 space-y-0.5">
          <div>Protocol: <span className="text-white">VNC</span></div>
          <div>Port: <span className="text-white">{node.vncPort}</span></div>
          <div>Status: <span className="text-green-400">Active</span></div>
        </div>
      </div>
    </div>
  );
};
