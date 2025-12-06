const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs').promises;
const http = require('http');
const multer = require('multer');
const { WebSocketServer } = require('ws');

// Load environment variables
dotenv.config();

// Import modules
// Use PostgreSQL-backed NodeManager for better reliability and scalability
const { NodeManager } = require('./modules/nodeManagerPostgres');
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

// Added upload middleware for custom disk images
const upload = multer({
  storage: multer.diskStorage({
    destination: (_, __, cb) => cb(null, qemuManager.customImagesPath),
    filename: (_, file, cb) => {
      const baseName = path.parse(file.originalname).name.replace(/[^a-zA-Z0-9-_]+/g, '_');
      const filename = `${baseName || 'custom'}_${Date.now()}${path.extname(file.originalname)}`;
      cb(null, filename);
    }
  }),
  fileFilter: (_, file, cb) => {
    const ext = file.originalname.toLowerCase();
    const supportedFormats = ['.qcow2', '.vmdk', '.vdi', '.vhdx', '.raw', '.img', '.iso'];
    if (!supportedFormats.some(fmt => ext.endsWith(fmt))) {
      return cb(new Error(`Unsupported format. Supported: ${supportedFormats.join(', ')}`));
    }
    cb(null, true);
  },
  limits: {
    fileSize: 20 * 1024 * 1024 * 1024 // 20 GB
  }
});

let httpServer;
let wsServer;

// Import JWT auth middleware
const authMiddleware = require('./middleware/auth');

// Import Swagger UI
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');

// Health check endpoint (public)
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

// Swagger UI (public)
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Apply JWT authentication to all subsequent /api routes
app.use('/api', authMiddleware);

// =======================
// NODE ENDPOINTS
// =======================

/**
 * GET /api/nodes
 * List all nodes with their current status (synced with QEMU)
 */
app.get('/api/nodes', async (req, res) => {
  try {
    const nodes = await nodeManager.listNodes();

    // Sync status with actual QEMU processes
    for (const node of nodes) {
      const isActuallyRunning = qemuManager.isVMRunning(node.id);

      // If DB says running but QEMU says stopped, update DB
      if (node.status === 'running' && !isActuallyRunning) {
        await nodeManager.updateNode(node.id, {
          status: 'stopped',
          stoppedAt: new Date()
        });
        node.status = 'stopped';
      }
      // If DB says stopped but QEMU says running, update DB
      else if (node.status === 'stopped' && isActuallyRunning) {
        await nodeManager.updateNode(node.id, { status: 'running' });
        node.status = 'running';
      }
    }

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
    const { name, osType, resources, imageType, customImageName } = req.body;
    const resolvedOsType = osType || 'ubuntu';

    let image = null;
    try {
      image = await qemuManager.resolveImage({
        imageType: imageType || 'base',
        osType: resolvedOsType,
        customImageName
      });
    } catch (imageError) {
      return res.status(400).json({
        success: false,
        error: imageError.message || 'Invalid image selection'
      });
    }

    console.log(`Creating new node: ${name || 'auto-generated'} (${osType || 'ubuntu'})`);

    // Create node with overlay
    const node = await nodeManager.createNode(name, resolvedOsType, resources, { image });

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

    // Only register with Guacamole if this is NOT a router (routers use serial console only)
    let guacConnection = { id: null, url: null, pid: null };
    if (node.osType !== 'router') {
      guacConnection = await guacamoleClient.registerConnection(node, vncPort);
    } else {
      console.log(`  ⏩ Skipping Guacamole registration for router (serial console only)`);
    }

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
 * POST /api/nodes/:id/configure-router
 * Auto-configure a Cisco router with network settings
 */
app.post('/api/nodes/:id/configure-router', async (req, res) => {
  try {
    const { id } = req.params;
    const config = req.body;

    console.log(`Configuring router: ${id}`);

    const node = await nodeManager.getNode(id);
    if (!node) {
      return res.status(404).json({
        success: false,
        error: 'Node not found'
      });
    }

    console.log(`  Node osType: ${node.osType}, os: ${node.os}`);

    if (node.osType !== 'router' && node.os !== 'router') {
      return res.status(400).json({
        success: false,
        error: 'Node is not a router'
      });
    }

    if (node.status !== 'running') {
      return res.status(400).json({
        success: false,
        error: 'Router must be running to configure'
      });
    }

    // Auto-configure the router
    await qemuManager.autoConfigureRouter(id, config);

    res.json({
      success: true,
      message: 'Router configuration sent',
      hostname: config.hostname
    });
  } catch (error) {
    console.error('Error configuring router:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to configure router'
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

// Added image catalogue endpoint for frontend selection UI
app.get('/api/images', async (req, res) => {
  try {
    const images = await qemuManager.listAvailableImages();
    res.json({
      success: true,
      ...images
    });
  } catch (error) {
    console.error('Error listing images:', error);
    res.status(500).json({ success: false, error: 'Failed to list images' });
  }
});

// Added upload endpoint for custom QCOW2 images
app.post('/api/images/custom', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Image file is required' });
    }

    const uploadedPath = req.file.path;
    let finalImagePath = uploadedPath;

    // Convert to QCOW2 if not already in that format
    const convertedPath = await qemuManager.ensureQcow2Format(uploadedPath);
    if (convertedPath !== uploadedPath) {
      finalImagePath = convertedPath;
      // Clean up original file if conversion created a new one
      try {
        await fs.unlink(uploadedPath);
      } catch (err) {
        console.warn('Could not delete original file:', err.message);
      }
    }

    const image = await qemuManager.resolveImage({
      imageType: 'custom',
      customImageName: path.basename(finalImagePath)
    });

    res.status(201).json({
      success: true,
      image
    });
  } catch (error) {
    console.error('Error uploading image:', error);
    // Clean up on error
    if (req.file && req.file.path) {
      try {
        await fs.unlink(req.file.path);
      } catch (err) {
        console.warn('Could not delete uploaded file:', err.message);
      }
    }
    res.status(500).json({ success: false, error: error.message || 'Failed to upload image' });
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
    httpServer = http.createServer(app);
    wsServer = new WebSocketServer({ noServer: true });

    wsServer.on('connection', async (socket, request) => {
      try {
        const searchParams = request?.sandlabx?.searchParams;
        const nodeId = searchParams ? searchParams.get('nodeId') : null;
        if (!nodeId) {
          socket.send(JSON.stringify({ type: 'error', message: 'nodeId query parameter required' }));
          socket.close(1008, 'nodeId required');
          return;
        }

        const node = await nodeManager.getNode(nodeId);
        if (!node) {
          socket.send(JSON.stringify({ type: 'error', message: 'Node not found' }));
          socket.close(1008, 'Node not found');
          return;
        }

        const vmActive = qemuManager.isVMRunning(nodeId);

        if (node.status !== 'running' && !vmActive) {
          socket.send(JSON.stringify({ type: 'error', message: 'Node is not running' }));
          socket.close(1008, 'Node not running');
          return;
        }

        try {
          qemuManager.attachConsoleClient(nodeId, socket);
        } catch (error) {
          socket.send(JSON.stringify({ type: 'error', message: error.message }));
          socket.close(1011, 'Console unavailable');
        }
      } catch (error) {
        console.error('WebSocket connection error:', error.message);
        try {
          socket.send(JSON.stringify({ type: 'error', message: 'Server error' }));
        } catch (sendError) {
          console.error('WebSocket send error:', sendError.message);
        }
        socket.close(1011, 'Server error');
      }
    });

    httpServer.on('upgrade', (request, socket, head) => {
      try {
        const parsedUrl = new URL(request.url, `http://${request.headers.host}`);
        if (parsedUrl.pathname === '/ws/console') {
          request.sandlabx = { searchParams: parsedUrl.searchParams };
          wsServer.handleUpgrade(request, socket, head, (ws) => {
            ws.sandlabx = request.sandlabx;
            wsServer.emit('connection', ws, request);
          });
        } else {
          socket.destroy();
        }
      } catch (error) {
        console.error('Upgrade error:', error.message);
        socket.destroy();
      }
    });

    httpServer.listen(PORT, '0.0.0.0', () => {
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
  if (wsServer) {
    wsServer.clients.forEach(client => client.close(1001, 'Server shutting down'));
    wsServer.close();
  }
  if (httpServer) {
    httpServer.close(() => process.exit(0));
    return;
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\n⚠️  SIGINT received, shutting down gracefully...');
  await qemuManager.cleanup();
  if (wsServer) {
    wsServer.clients.forEach(client => client.close(1001, 'Server shutting down'));
    wsServer.close();
  }
  if (httpServer) {
    httpServer.close(() => process.exit(0));
    return;
  }
  process.exit(0);
});

// Start the server
initializeServer();
