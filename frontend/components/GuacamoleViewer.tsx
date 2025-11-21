'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
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
  const [showConsole, setShowConsole] = useState(false);
  const [consoleHeight, setConsoleHeight] = useState(300); // Default height in pixels
  const [isConsoleFullscreen, setIsConsoleFullscreen] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [consoleStatus, setConsoleStatus] = useState<'idle' | 'connecting' | 'ready' | 'error'>('idle');
  const [consoleError, setConsoleError] = useState<string | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const terminalContainerRef = useRef<HTMLDivElement | null>(null);
  const resizeStartYRef = useRef<number>(0);
  const resizeStartHeightRef = useRef<number>(0);
  const isRouter = useMemo(() => node?.osType === 'router' || node?.baseImage === 'router', [node]);

  if (!node) return null;
  if (!isRouter && !node.guacUrl) return null;

  // Handle console resize drag
  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    resizeStartYRef.current = e.clientY;
    resizeStartHeightRef.current = consoleHeight;
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = resizeStartYRef.current - e.clientY;
      const newHeight = Math.max(200, Math.min(window.innerHeight - 200, resizeStartHeightRef.current + delta));
      setConsoleHeight(newHeight);
      
      // Fit terminal to new size
      if (fitAddonRef.current && terminalRef.current) {
        setTimeout(() => {
          fitAddonRef.current?.fit();
          terminalRef.current?.scrollToBottom();
        }, 0);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, consoleHeight]);

  const toggleConsoleFullscreen = () => {
    setIsConsoleFullscreen((prev) => !prev);
    setTimeout(() => {
      fitAddonRef.current?.fit();
      terminalRef.current?.scrollToBottom();
    }, 100);
  };

  const takeScreenshot = async () => {
    const terminal = terminalRef.current;
    if (!terminal) {
      alert('Terminal not available for screenshot');
      return;
    }
    
    try {
      // Get terminal content as text
      const buffer = terminal.buffer.active;
      let content = '';
      for (let i = 0; i < buffer.length; i++) {
        const line = buffer.getLine(i);
        if (line) {
          content += line.translateToString(true) + '\n';
        }
      }
      
      // Copy to clipboard
      await navigator.clipboard.writeText(content);
      alert('Terminal content copied to clipboard!');
    } catch (error) {
      console.error('Screenshot failed:', error);
      alert('Failed to capture terminal content');
    }
  };

  const copyToClipboard = async () => {
    const terminal = terminalRef.current;
    if (!terminal) return;
    
    try {
      const selection = terminal.getSelection();
      if (selection) {
        await navigator.clipboard.writeText(selection);
        alert('Copied to clipboard!');
      } else {
        alert('Please select text in the terminal first');
      }
    } catch (error) {
      console.error('Clipboard copy failed:', error);
      alert('Failed to copy to clipboard');
    }
  };

  const pasteFromClipboard = async () => {
    const terminal = terminalRef.current;
    const ws = wsRef.current;
    if (!terminal || !ws || ws.readyState !== WebSocket.OPEN) return;
    
    try {
      const text = await navigator.clipboard.readText();
      ws.send(text);
    } catch (error) {
      console.error('Clipboard paste failed:', error);
      alert('Failed to paste from clipboard');
    }
  };

  const openInNewTab = () => {
    if (!node?.guacUrl) {
      return;
    }
    window.open(node.guacUrl, '_blank');
  };

  const sendCtrlAltDel = () => {
    // This would need Guacamole API integration
    alert('Ctrl+Alt+Del: This feature requires Guacamole keyboard API integration');
  };

  // Added helper to derive console websocket URL
  const consoleUrl = useMemo(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
    const stripped = apiBase.replace(/\/?api\/?$/, '');
    const protocol = stripped.startsWith('https') ? 'wss' : 'ws';
    const host = stripped.replace(/^https?:\/\//, '');
    return `${protocol}://${host}/ws/console?nodeId=${node.id}`;
  }, [node.id]);

  useEffect(() => {
    setConsoleStatus('idle');
    setConsoleError(null);
    setShowConsole(isRouter);
  }, [node?.id, isRouter]);

  useEffect(() => {
    if (!showConsole) {
      return () => {};
    }

    const container = terminalContainerRef.current;
    if (!container) {
      console.error('Terminal container ref not available');
      setConsoleStatus('error');
      setConsoleError('Terminal container not ready');
      return () => {};
    }

    console.log('Initializing serial console...', {consoleUrl});
    setConsoleStatus('connecting');
    setConsoleError(null);

    const term = new Terminal({
      theme: {
        background: '#0a0e1a',
        foreground: '#e4e4e7',
        cursor: '#22d3ee',
        cursorAccent: '#0a0e1a',
        selectionBackground: 'rgba(99, 102, 241, 0.3)',
        black: '#1e293b',
        red: '#ef4444',
        green: '#22c55e',
        yellow: '#eab308',
        blue: '#3b82f6',
        magenta: '#a855f7',
        cyan: '#06b6d4',
        white: '#e2e8f0',
        brightBlack: '#475569',
        brightRed: '#f87171',
        brightGreen: '#4ade80',
        brightYellow: '#fbbf24',
        brightBlue: '#60a5fa',
        brightMagenta: '#c084fc',
        brightCyan: '#22d3ee',
        brightWhite: '#f8fafc',
      },
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize: 15,
      fontFamily: '"Fira Code", "Cascadia Code", "JetBrains Mono", "Consolas", monospace',
      fontWeight: '400',
      fontWeightBold: '700',
      lineHeight: 1.2,
      letterSpacing: 0,
      scrollback: 10000,
      tabStopWidth: 4,
      allowProposedApi: true,
      convertEol: false,
      disableStdin: false,
      rightClickSelectsWord: true,
      smoothScrollDuration: 100,
    });
    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    
    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.open(container);
    fitAddon.fit();
    term.focus();

    terminalRef.current = term;
    fitAddonRef.current = fitAddon;

    console.log('Creating WebSocket connection to:', consoleUrl);
    const socket = new WebSocket(consoleUrl);
    wsRef.current = socket;

    const handleResize = () => {
      try {
        fitAddon.fit();
        // Scroll to bottom after resize
        setTimeout(() => term.scrollToBottom(), 50);
      } catch (error) {
        console.error('Console resize error:', error);
      }
    };

    // Fit terminal multiple times with increasing delays to handle container sizing
    const fitDelays = [50, 150, 300];
    fitDelays.forEach(delay => {
      setTimeout(() => {
        try {
          fitAddon.fit();
          term.scrollToBottom();
        } catch (error) {
          console.error('Delayed fit error:', error);
        }
      }, delay);
    });

    window.addEventListener('resize', handleResize);

    // Add ResizeObserver to handle container size changes with debouncing
    let resizeTimeout: NodeJS.Timeout;
    const resizeObserver = new ResizeObserver(() => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        try {
          fitAddon.fit();
          // Give it a moment for the fit to complete, then scroll
          setTimeout(() => term.scrollToBottom(), 50);
        } catch (error) {
          console.error('ResizeObserver error:', error);
        }
      }, 100);
    });
    resizeObserver.observe(container);

    // Send user input to the server, but DON'T echo locally
    // The server/VM will echo it back, preventing double-typing
    term.onData((data: string) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(data);
      }
    });

    socket.onopen = () => {
      console.log('WebSocket connected!');
      setConsoleStatus('ready');
    };

    socket.onmessage = (event) => {
      console.log('WebSocket message received:', event.data);
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'ready') {
          setConsoleStatus('ready');
          return;
        }
        if (payload.type === 'data') {
          term.write(payload.payload);
          // Auto-scroll to bottom when new data arrives
          term.scrollToBottom();
          return;
        }
        if (payload.type === 'error') {
          setConsoleStatus('error');
          setConsoleError(payload.message || 'Console error');
          return;
        }
        if (payload.type === 'exit') {
          term.writeln(`\r\n[Console closed: code=${payload.code ?? 'null'} signal=${payload.signal ?? 'null'}]`);
          term.scrollToBottom();
          return;
        }
      } catch (error) {
        term.write(event.data);
        term.scrollToBottom();
      }
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      setConsoleStatus('error');
      setConsoleError('Console socket error');
    };

    socket.onclose = (event) => {
      console.log('WebSocket closed:', event.code, event.reason);
      setConsoleStatus((status) => (status === 'error' ? status : 'idle'));
      window.removeEventListener('resize', handleResize);
    };

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close(1000, 'Console closed');
      }
      wsRef.current = null;
      fitAddon.dispose();
      term.dispose();
      terminalRef.current = null;
    };
  }, [consoleUrl, showConsole]);

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
                  {isRouter ? 'Serial Console' : `VNC: ${node.vncPort}`}
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
                if (isRouter && terminalContainerRef.current) {
                  // For serial console, fullscreen the terminal container
                  const container = terminalContainerRef.current.parentElement?.parentElement;
                  if (container) {
                    if (document.fullscreenElement) {
                      document.exitFullscreen();
                    } else {
                      container.requestFullscreen();
                    }
                  }
                } else {
                  // For VNC, fullscreen the iframe
                  const elem = document.querySelector('iframe');
                  if (elem) {
                    if (document.fullscreenElement) {
                      document.exitFullscreen();
                    } else {
                      elem.requestFullscreen();
                    }
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
              onClick={takeScreenshot}
              className="px-3 py-1.5 text-xs text-gray-300 hover:text-white hover:bg-lab-gray rounded transition-colors"
              title="Screenshot (Copy terminal content to clipboard)"
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
              onClick={copyToClipboard}
              className="px-3 py-1.5 text-xs text-gray-300 hover:text-white hover:bg-lab-gray rounded transition-colors"
              title="Copy selected text"
            >
              <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Copy
            </button>
            
            {/* Paste */}
            <button
              onClick={pasteFromClipboard}
              className="px-3 py-1.5 text-xs text-gray-300 hover:text-white hover:bg-lab-gray rounded transition-colors"
              title="Paste from clipboard"
            >
              <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
              Paste
            </button>
          </div>

          {/* Right: Additional controls */}
          <div className="flex items-center gap-2">
            <div className="text-xs text-gray-400 px-3 py-1.5 bg-lab-darker rounded">
              <span className="text-gray-500">RAM:</span> {node.resources.ram}MB
              <span className="mx-2">•</span>
              <span className="text-gray-500">CPU:</span> {node.resources.cpus || node.resources.cpu || 2} cores
            </div>

            {!isRouter && (
              <Button
                variant={showConsole ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setShowConsole((prev) => !prev)}
              >
                {showConsole ? 'Hide Serial Console' : 'Show Serial Console'}
              </Button>
            )}
            
            {!isRouter && (
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
            )}
            
            {!isRouter && node.guacUrl && (
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
            )}
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

      {/* Console viewport */}
      <div className="h-[calc(100vh-73px)] bg-black relative">
        {!isRouter && node.guacUrl && (
          <iframe
            src={node.guacUrl || undefined}
            className="w-full h-full border-0"
            title={`Console for ${node.name}`}
            allow="clipboard-read; clipboard-write"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
          />
        )}

        {isRouter && showConsole && (
          <div className="absolute inset-0 bg-[#0a0e1a] flex flex-col">
            <div className="flex items-center justify-between px-4 py-2.5 bg-[#0f1419] border-b border-lab-gray-light/40 shadow-md flex-shrink-0">
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span className="uppercase tracking-wide text-gray-300 font-semibold">Serial Console</span>
                <span>•</span>
                <span className={
                  consoleStatus === 'ready'
                    ? 'text-green-400 font-medium'
                    : consoleStatus === 'connecting'
                      ? 'text-yellow-400 font-medium'
                      : 'text-red-400 font-medium'
                }>
                  {consoleStatus === 'ready' && '● Connected'}
                  {consoleStatus === 'connecting' && '◌ Connecting...'}
                  {consoleStatus === 'error' && '✕ Error'}
                  {consoleStatus === 'idle' && '○ Idle'}
                </span>
                {consoleError && <span className="text-lab-warning">• {consoleError}</span>}
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={toggleConsoleFullscreen} title="Toggle fullscreen">
                  {isConsoleFullscreen ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                    </svg>
                  )}
                </Button>
                <Button size="sm" variant="ghost" onClick={onClose}>
                  Close
                </Button>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden bg-[#0a0e1a]">
              <div ref={terminalContainerRef} className="w-full h-full px-4 pt-3 pb-6" style={{ overflow: 'hidden' }} />
            </div>
          </div>
        )}
      </div>

      {!isRouter && showConsole && (
        <div
          className={`${
            isConsoleFullscreen
              ? 'fixed inset-0 z-[100]'
              : 'absolute inset-x-0 bottom-0'
          } bg-[#0a0e1a] border-t border-lab-gray-light/60 shadow-xl flex flex-col`}
          style={!isConsoleFullscreen ? { height: `${consoleHeight}px` } : undefined}
        >
          {/* Resize handle (only in non-fullscreen mode) */}
          {!isConsoleFullscreen && (
            <div
              className="absolute top-0 left-0 right-0 h-1.5 cursor-ns-resize hover:bg-lab-primary/50 transition-colors z-10 group"
              onMouseDown={handleResizeStart}
            >
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-1 bg-lab-gray-light/40 rounded-b group-hover:bg-lab-primary/60 transition-colors" />
            </div>
          )}

          <div className="flex items-center justify-between px-4 py-2.5 bg-[#0f1419] border-b border-lab-gray-light/40 shadow-md flex-shrink-0">
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span className="uppercase tracking-wide text-gray-300 font-semibold">Serial Console</span>
              <span>•</span>
              <span className={
                consoleStatus === 'ready'
                  ? 'text-green-400 font-medium'
                  : consoleStatus === 'connecting'
                    ? 'text-yellow-400 font-medium'
                    : 'text-red-400 font-medium'
              }>
                {consoleStatus === 'ready' && '● Connected'}
                {consoleStatus === 'connecting' && '◌ Connecting...'}
                {consoleStatus === 'error' && '✕ Error'}
                {consoleStatus === 'idle' && '○ Idle'}
              </span>
              {consoleError && <span className="text-lab-warning">• {consoleError}</span>}
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={toggleConsoleFullscreen}
                title={isConsoleFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              >
                {isConsoleFullscreen ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                )}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowConsole(false)}>
                Close
              </Button>
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-hidden bg-[#0a0e1a]">
            <div ref={terminalContainerRef} className="w-full h-full px-4 pt-3 pb-6" style={{ overflow: 'hidden' }} />
          </div>
        </div>
      )}

      {/* Connection info overlay (bottom right) */}
      <div className="absolute bottom-4 right-4 bg-lab-gray/90 backdrop-blur-sm border border-lab-gray-light rounded-lg p-3 text-xs">
        <div className="flex items-center gap-2 text-green-400 mb-1">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="font-semibold">Connected</span>
        </div>
        <div className="text-gray-400 space-y-0.5">
          <div>Protocol: <span className="text-white">{isRouter ? 'Serial' : 'VNC'}</span></div>
          <div>Port: <span className="text-white">{isRouter ? 'n/a' : node.vncPort}</span></div>
          <div>Status: <span className={
            isRouter
              ? consoleStatus === 'ready'
                ? 'text-green-400'
                : consoleStatus === 'connecting'
                  ? 'text-yellow-400'
                  : consoleStatus === 'error'
                    ? 'text-red-400'
                    : 'text-gray-300'
              : 'text-green-400'
          }>
            {isRouter
              ? consoleStatus === 'ready'
                ? 'Connected'
                : consoleStatus === 'connecting'
                  ? 'Connecting...'
                  : consoleStatus === 'error'
                    ? 'Error'
                    : 'Idle'
              : 'Active'}
          </span></div>
        </div>
      </div>
    </div>
  );
};
