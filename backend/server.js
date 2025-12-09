const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs').promises;
const http = require('http');
const multer = require('multer');
const { WebSocketServer } = require('ws');
const pinoHttp = require('pino-http');

// Load environment variables
dotenv.config();

// Import logger
const logger = require('./logger');

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

// Request logging middleware (Pino HTTP)
app.use(pinoHttp({ logger }));

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
// Health check endpoint (public)
app.get('/api/health', async (req, res) => {
  const dbHealth = await nodeManager.checkHealth();
  const qemuHealth = await qemuManager.checkHealth();

  // Check Guacamole (HTTP check)
  let guacHealth = false;
  try {
    // Use fetch or http.get
    const guacUrl = process.env.GUAC_BASE_URL || 'http://localhost:8081/guacamole';
    // Simple check: if we get a response (even 404/302), service is up
    const response = await fetch(guacUrl);
    guacHealth = response.status < 500;
  } catch (e) {
    guacHealth = false;
  }

  const services = {
    backend: 'running',
    database: dbHealth ? 'connected' : 'disconnected',
    qemu: qemuHealth ? 'available' : 'unavailable',
    guacamole: guacHealth ? 'connected' : 'unreachable'
  };

  // Determine overall status
  let status = 'healthy';
  if (!dbHealth || !qemuHealth) {
    status = 'unhealthy';
  } else if (!guacHealth) {
    status = 'degraded';
  }

  const statusCode = status === 'unhealthy' ? 503 : 200;

  res.status(statusCode).json({
    status,
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    services,
    uptime: process.uptime()
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
    logger.error({ err: error, action: 'listNodes' }, 'Error listing nodes');
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
    logger.error({ err: error, action: 'getNode' }, 'Error getting node');
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

    logger.info({ action: 'createNode', name, osType }, 'Creating new node');

    // Create node with overlay
    const node = await nodeManager.createNode(name, resolvedOsType, resources, { image });

    res.status(201).json({
      success: true,
      ...node
    });
  } catch (error) {
    logger.error({ err: error, action: 'createNode' }, 'Error creating node');
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

    logger.info({ action: 'startNode', nodeId: id }, 'Starting node');

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
      logger.info({ nodeId: id, osType: 'router' }, 'Skipping Guacamole registration for router (serial console only)');
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
    logger.error({ err: error, action: 'startNode' }, 'Error starting node');
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

    logger.info({ action: 'stopNode', nodeId: id }, 'Stopping node');

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
    logger.error({ err: error, action: 'stopNode' }, 'Error stopping node');
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

    logger.info({ action: 'wipeNode', nodeId: id }, 'Wiping node');

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
    logger.error({ err: error, action: 'wipeNode' }, 'Error wiping node');
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

    logger.info({ action: 'configureRouter', nodeId: id }, 'Configuring router');

    const node = await nodeManager.getNode(id);
    if (!node) {
      return res.status(404).json({
        success: false,
        error: 'Node not found'
      });
    }

    logger.debug({ nodeId: id, osType: node.osType, os: node.os }, 'Node type info');

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
    logger.error({ err: error, action: 'configureRouter' }, 'Error configuring router');
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

    logger.info({ action: 'deleteNode', nodeId: id }, 'Deleting node');

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
    logger.error({ err: error, action: 'deleteNode' }, 'Error deleting node');
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
    logger.error({ err: error, action: 'listImages' }, 'Error listing images');
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
    logger.error({ err: error, action: 'uploadImage' }, 'Error uploading image');
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
  logger.error({ err }, 'Unhandled error');
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
        logger.error({ err: error }, 'WebSocket connection error');
        try {
          socket.send(JSON.stringify({ type: 'error', message: 'Server error' }));
        } catch (sendError) {
          logger.error({ err: sendError }, 'WebSocket send error');
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
        logger.error({ err: error }, 'Upgrade error');
        socket.destroy();
      }
    });

    httpServer.listen(PORT, '0.0.0.0', () => {
      logger.info({
        port: PORT,
        apiBaseUrl: `http://localhost:${PORT}/api`,
        environment: process.env.NODE_ENV,
        guacamole: process.env.GUAC_BASE_URL
      }, '🚀 SandBoxLabs Backend API Server started');
    });
  } catch (error) {
    logger.fatal({ err: error }, 'Failed to initialize server');
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.warn('SIGTERM received, shutting down gracefully...');
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
  logger.warn('SIGINT received, shutting down gracefully...');
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
