const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs').promises;

// Load environment variables
dotenv.config();

// Import modules
const { NodeManager } = require('./modules/nodeManager');
const { GuacamoleClient } = require('./modules/guacamoleClient');
const { QemuManager } = require('./modules/qemuManager');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Initialize managers
const nodeManager = new NodeManager();
const guacamoleClient = new GuacamoleClient();
const qemuManager = new QemuManager();

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    services: {
      backend: 'running',
      guacamole: guacamoleClient.isConnected() ? 'connected' : 'disconnected',
    }
  });
});

// =======================
// NODE ENDPOINTS
// =======================

/**
 * GET /api/nodes
 * List all nodes with their current status
 */
app.get('/api/nodes', async (req, res) => {
  try {
    const nodes = await nodeManager.listNodes();
    res.json({
      success: true,
      nodes: nodes,
      count: nodes.length
    });
  } catch (error) {
    console.error('Error listing nodes:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to list nodes'
    });
  }
});

/**
 * GET /api/nodes/:id
 * Get details of a specific node
 */
app.get('/api/nodes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const node = await nodeManager.getNode(id);
    
    if (!node) {
      return res.status(404).json({
        success: false,
        error: 'Node not found'
      });
    }
    
    res.json({
      success: true,
      ...node
    });
  } catch (error) {
    console.error('Error getting node:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get node'
    });
  }
});

/**
 * POST /api/nodes
 * Create a new node (creates QCOW2 overlay)
 */
app.post('/api/nodes', async (req, res) => {
  try {
    const { name, osType, resources } = req.body;
    
    console.log(`Creating new node: ${name || 'auto-generated'} (${osType || 'ubuntu'})`);
    
    // Create node with overlay
    const node = await nodeManager.createNode(name, osType, resources);
    
    res.status(201).json({
      success: true,
      ...node
    });
  } catch (error) {
    console.error('Error creating node:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create node'
    });
  }
});

/**
 * POST /api/nodes/:id/run
 * Start a node (boot QEMU VM with overlay)
 */
app.post('/api/nodes/:id/run', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`Starting node: ${id}`);
    
    // Get node info
    const node = await nodeManager.getNode(id);
    if (!node) {
      return res.status(404).json({
        success: false,
        error: 'Node not found'
      });
    }
    
    if (node.status === 'running') {
      return res.status(400).json({
        success: false,
        error: 'Node is already running'
      });
    }
    
    // Start QEMU VM
    const vncPort = await qemuManager.startVM(node);
    
    // Register with Guacamole
    const guacConnection = await guacamoleClient.registerConnection(node, vncPort);
    
    // Update node state
    const updatedNode = await nodeManager.updateNode(id, {
      status: 'running',
      vncPort: vncPort,
      guacConnectionId: guacConnection.id,
      guacUrl: guacConnection.url,
      pid: guacConnection.pid,
      startedAt: new Date().toISOString()
    });
    
    res.json({
      success: true,
      ...updatedNode
    });
  } catch (error) {
    console.error('Error starting node:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to start node'
    });
  }
});

/**
 * POST /api/nodes/:id/stop
 * Stop a node (shutdown QEMU VM)
 */
app.post('/api/nodes/:id/stop', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`Stopping node: ${id}`);
    
    const node = await nodeManager.getNode(id);
    if (!node) {
      return res.status(404).json({
        success: false,
        error: 'Node not found'
      });
    }
    
    if (node.status !== 'running') {
      return res.status(400).json({
        success: false,
        error: 'Node is not running'
      });
    }
    
    // Stop QEMU VM
    await qemuManager.stopVM(node);
    
    // Unregister from Guacamole (optional, can keep for history)
    // await guacamoleClient.unregisterConnection(node.guacConnectionId);
    
    // Update node state
    const updatedNode = await nodeManager.updateNode(id, {
      status: 'stopped',
      vncPort: null,
      guacConnectionId: null,
      guacUrl: null,
      pid: null,
      stoppedAt: new Date().toISOString()
    });
    
    res.json({
      success: true,
      ...updatedNode
    });
  } catch (error) {
    console.error('Error stopping node:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to stop node'
    });
  }
});

/**
 * POST /api/nodes/:id/wipe
 * Wipe a node (delete overlay and recreate from base)
 */
app.post('/api/nodes/:id/wipe', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`Wiping node: ${id}`);
    
    const node = await nodeManager.getNode(id);
    if (!node) {
      return res.status(404).json({
        success: false,
        error: 'Node not found'
      });
    }
    
    // Stop VM if running
    if (node.status === 'running') {
      await qemuManager.stopVM(node);
    }
    
    // Delete and recreate overlay
    await qemuManager.wipeOverlay(node);
    
    // Update node state
    const updatedNode = await nodeManager.updateNode(id, {
      status: 'stopped',
      vncPort: null,
      guacConnectionId: null,
      guacUrl: null,
      pid: null,
      wipedAt: new Date().toISOString()
    });
    
    res.json({
      success: true,
      message: 'Node wiped successfully',
      ...updatedNode
    });
  } catch (error) {
    console.error('Error wiping node:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to wipe node'
    });
  }
});

/**
 * DELETE /api/nodes/:id
 * Delete a node completely (stop VM, delete overlay, remove from state)
 */
app.delete('/api/nodes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`Deleting node: ${id}`);
    
    const node = await nodeManager.getNode(id);
    if (!node) {
      return res.status(404).json({
        success: false,
        error: 'Node not found'
      });
    }
    
    // Stop VM if running
    if (node.status === 'running') {
      await qemuManager.stopVM(node);
    }
    
    // Delete overlay file
    await qemuManager.deleteOverlay(node);
    
    // Remove from state
    await nodeManager.deleteNode(id);
    
    res.json({
      success: true,
      message: 'Node deleted successfully',
      id: id
    });
  } catch (error) {
    console.error('Error deleting node:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete node'
    });
  }
});

// =======================
// ERROR HANDLERS
// =======================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.url
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

// =======================
// SERVER STARTUP
// =======================

async function initializeServer() {
  try {
    // Initialize managers
    await nodeManager.initialize();
    await guacamoleClient.initialize();
    await qemuManager.initialize();
    
    // Start server
    app.listen(PORT, '0.0.0.0', () => {
      console.log('='.repeat(60));
      console.log('🚀 SandBoxLabs Backend API Server');
      console.log('='.repeat(60));
      console.log(`✅ Server running on: http://localhost:${PORT}`);
      console.log(`✅ API base URL: http://localhost:${PORT}/api`);
      console.log(`✅ Environment: ${process.env.NODE_ENV}`);
      console.log(`✅ Guacamole: ${process.env.GUAC_BASE_URL}`);
      console.log('='.repeat(60));
      console.log('\n📋 Available Endpoints:');
      console.log('  GET    /api/health          - Health check');
      console.log('  GET    /api/nodes           - List all nodes');
      console.log('  GET    /api/nodes/:id       - Get node details');
      console.log('  POST   /api/nodes           - Create new node');
      console.log('  POST   /api/nodes/:id/run   - Start node');
      console.log('  POST   /api/nodes/:id/stop  - Stop node');
      console.log('  POST   /api/nodes/:id/wipe  - Wipe node');
      console.log('  DELETE /api/nodes/:id       - Delete node');
      console.log('='.repeat(60));
      console.log('\n🎮 Ready to accept requests!\n');
    });
  } catch (error) {
    console.error('Failed to initialize server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('\n⚠️  SIGTERM received, shutting down gracefully...');
  await qemuManager.cleanup();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\n⚠️  SIGINT received, shutting down gracefully...');
  await qemuManager.cleanup();
  process.exit(0);
});

// Start the server
initializeServer();
