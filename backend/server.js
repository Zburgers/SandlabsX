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

// Import rate limiters
const {
  createNodeLimiter,
  startNodeLimiter,
  uploadImageLimiter
} = require('./middleware/rateLimit');

// Import modules
// Use PostgreSQL-backed NodeManager for better reliability and scalability
const { NodeManager } = require('./modules/nodeManagerPostgres');
const { GuacamoleClient } = require('./modules/guacamoleClient');
const { QemuManager } = require('./modules/qemuManager');
const { LabManager } = require('./modules/labManager');
const { auditLogger } = require('./modules/auditLogger');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
  exposedHeaders: ['RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset', 'X-Total-Count']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware (Pino HTTP)
app.use(pinoHttp({ logger }));

// Initialize managers
const nodeManager = new NodeManager();
const guacamoleClient = new GuacamoleClient();
const qemuManager = new QemuManager();
const labManager = new LabManager();

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

// Import RBAC middleware and user controller
const {
  requireRole,
  requireOwnership,
  requireLabAccess,
  requireNodeAccess,
  enrichUserRole
} = require('./middleware/rbac');

const userController = require('./controllers/userController');
const authController = require('./controllers/authController');

// Auth Routes (Public)
app.post('/api/auth/login', authController.login);
app.post('/api/auth/register', authController.register);

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

// Enrich user with role from database after JWT auth
app.use('/api', enrichUserRole);

// Auth Routes (Protected)
app.post('/api/auth/change-password', authController.changePassword);

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
app.post('/api/nodes', requireRole(['admin', 'instructor']), createNodeLimiter, async (req, res) => {
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

    // Create node with overlay - pass userId from JWT for FK
    const userId = req.auth?.sub || null;
    const node = await nodeManager.createNode(name, resolvedOsType, resources, { image, userId });

    // Audit log
    await auditLogger.logNodeCreate(userId, node.id, node.name, node.osType);

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
app.post('/api/nodes/:id/run', startNodeLimiter, async (req, res) => {
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

    // Audit log
    const userId = req.auth?.sub || null;
    await auditLogger.logNodeStart(userId, node.id, node.name);

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

    // Audit log
    const userId = req.auth?.sub || null;
    await auditLogger.logNodeStop(userId, node.id, node.name);

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

    // Audit log
    const userId = req.auth?.sub || null;
    await auditLogger.logNodeWipe(userId, node.id, node.name);

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
app.delete('/api/nodes/:id', requireRole(['admin', 'instructor']), async (req, res) => {
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

    // Audit log
    const userId = req.auth?.sub || null;
    await auditLogger.logNodeDelete(userId, id, node.name);

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
app.post('/api/images/custom', uploadImageLimiter, upload.single('image'), async (req, res) => {
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

/**
 * POST /api/images/:id/validate
 * Validate image integrity using qemu-img
 */
app.post('/api/images/:id/validate', async (req, res) => {
  try {
    const { id } = req.params;

    logger.info({ action: 'validateImage', imageId: id }, 'Validating image');

    // Resolve image path from ID
    let imagePath;

    // Check if it's a base image
    const baseImagePath = qemuManager.getBaseImageForOS(id);
    try {
      await fs.access(baseImagePath);
      imagePath = baseImagePath;
    } catch (error) {
      // Try custom images
      const customPath = path.join(qemuManager.customImagesPath, id.endsWith('.qcow2') ? id : `${id}.qcow2`);
      try {
        await fs.access(customPath);
        imagePath = customPath;
      } catch (err) {
        return res.status(404).json({
          success: false,
          error: 'Image not found',
          code: 'NOT_FOUND',
          timestamp: new Date().toISOString()
        });
      }
    }

    // Validate the image
    const validationResult = await qemuManager.validateImage(imagePath);

    res.json({
      success: true,
      id,
      name: path.basename(imagePath),
      ...validationResult
    });
  } catch (error) {
    logger.error({ err: error, action: 'validateImage' }, 'Error validating image');

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: 'Image file not found',
        code: 'NOT_FOUND',
        timestamp: new Date().toISOString()
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to validate image',
      code: 'INTERNAL_ERROR',
      timestamp: new Date().toISOString()
    });
  }
});

// =======================
// LAB ENDPOINTS
// =======================

/**
 * POST /api/labs
 * Create a new lab with topology
 */
app.post('/api/labs', requireRole(['admin', 'instructor']), async (req, res) => {
  try {
    const userId = req.auth?.sub;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User ID not found in token',
        code: 'UNAUTHORIZED'
      });
    }

    const { name, description, templateName, topologyJson, isPublic } = req.body;

    logger.info({ action: 'createLab', userId, name }, 'Creating new lab');

    const lab = await labManager.createLab(userId, {
      name,
      description,
      templateName,
      topologyJson,
      isPublic
    });

    res.status(201).json(lab);
  } catch (error) {
    logger.error({ err: error, action: 'createLab' }, 'Error creating lab');
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: error.message || 'Failed to create lab',
      code: error.code || 'INTERNAL_ERROR'
    });
  }
});

/**
 * GET /api/labs
 * List user's labs with pagination
 */
app.get('/api/labs', async (req, res) => {
  try {
    const userId = req.auth?.sub;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User ID not found in token',
        code: 'UNAUTHORIZED'
      });
    }

    const { page, limit, templateName, isPublic } = req.query;

    logger.info({ action: 'listLabs', userId, page, limit }, 'Listing labs');

    const result = await labManager.getLabs(userId, {
      page,
      limit,
      templateName,
      isPublic
    });

    res.json(result);
  } catch (error) {
    logger.error({ err: error, action: 'listLabs' }, 'Error listing labs');
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to list labs'
    });
  }
});

/**
 * GET /api/labs/:id
 * Get a single lab by ID
 */
app.get('/api/labs/:id', async (req, res) => {
  try {
    const userId = req.auth?.sub;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User ID not found in token',
        code: 'UNAUTHORIZED'
      });
    }

    const { id } = req.params;

    logger.info({ action: 'getLab', userId, labId: id }, 'Getting lab');

    const lab = await labManager.getLab(id, userId);

    if (!lab) {
      return res.status(404).json({
        success: false,
        error: 'Lab not found',
        code: 'NOT_FOUND'
      });
    }

    res.json(lab);
  } catch (error) {
    logger.error({ err: error, action: 'getLab' }, 'Error getting lab');
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: error.message || 'Failed to get lab',
      code: error.code || 'INTERNAL_ERROR'
    });
  }
});

/**
 * PATCH /api/labs/:id
 * Update a lab
 */
app.patch('/api/labs/:id', requireRole(['admin', 'instructor']), async (req, res) => {
  try {
    const userId = req.auth?.sub;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User ID not found in token',
        code: 'UNAUTHORIZED'
      });
    }

    const { id } = req.params;
    const { name, description, topologyJson, templateName, isPublic } = req.body;

    logger.info({ action: 'updateLab', userId, labId: id }, 'Updating lab');

    const lab = await labManager.updateLab(id, userId, {
      name,
      description,
      topologyJson,
      templateName,
      isPublic
    });

    res.json(lab);
  } catch (error) {
    logger.error({ err: error, action: 'updateLab' }, 'Error updating lab');
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: error.message || 'Failed to update lab',
      code: error.code || 'INTERNAL_ERROR'
    });
  }
});

/**
 * DELETE /api/labs/:id
 * Delete a lab
 */
app.delete('/api/labs/:id', requireRole(['admin', 'instructor']), async (req, res) => {
  try {
    const userId = req.auth?.sub;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User ID not found in token',
        code: 'UNAUTHORIZED'
      });
    }

    const { id } = req.params;

    logger.info({ action: 'deleteLab', userId, labId: id }, 'Deleting lab');

    const result = await labManager.deleteLab(id, userId);

    res.json(result);
  } catch (error) {
    logger.error({ err: error, action: 'deleteLab' }, 'Error deleting lab');
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: error.message || 'Failed to delete lab',
      code: error.code || 'INTERNAL_ERROR'
    });
  }
});

/**
 * POST /api/labs/:id/start
 * Start all nodes in a lab (spawn VMs from topology)
 */
app.post('/api/labs/:id/start', requireRole(['admin', 'instructor']), async (req, res) => {
  try {
    const userId = req.auth?.sub;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User ID not found in token',
        code: 'UNAUTHORIZED'
      });
    }

    const { id } = req.params;

    logger.info({ action: 'startLab', userId, labId: id }, 'Starting lab');

    const result = await labManager.startLab(id, userId, {
      nodeManager,
      qemuManager,
      guacamoleClient
    });

    // Audit log
    await auditLogger.logLabStart(userId, id, result.labName, result.started.length);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error({ err: error, action: 'startLab' }, 'Error starting lab');
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: error.message || 'Failed to start lab',
      code: error.code || 'INTERNAL_ERROR'
    });
  }
});

/**
 * POST /api/labs/:id/stop
 * Stop all running nodes in a lab
 */
app.post('/api/labs/:id/stop', requireRole(['admin', 'instructor']), async (req, res) => {
  try {
    const userId = req.auth?.sub;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User ID not found in token',
        code: 'UNAUTHORIZED'
      });
    }

    const { id } = req.params;

    logger.info({ action: 'stopLab', userId, labId: id }, 'Stopping lab');

    const result = await labManager.stopLab(id, userId, {
      nodeManager,
      qemuManager
    });

    // Audit log
    await auditLogger.logLabStop(userId, id, result.labName, result.stopped.length);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error({ err: error, action: 'stopLab' }, 'Error stopping lab');
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: error.message || 'Failed to stop lab',
      code: error.code || 'INTERNAL_ERROR'
    });
  }
});

/**
 * GET /api/labs/:id/export
 * Export a lab as downloadable JSON
 */
app.get('/api/labs/:id/export', async (req, res) => {
  try {
    const userId = req.auth?.sub;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User ID not found in token',
        code: 'UNAUTHORIZED'
      });
    }

    const { id } = req.params;

    logger.info({ action: 'exportLab', userId, labId: id }, 'Exporting lab');

    // Get user email if available (from token or default)
    const userEmail = req.auth?.email || 'unknown@sandlabx.local';

    const exportData = await labManager.exportLab(id, userId, userEmail);

    // Set headers for file download
    const filename = `${exportData.name.replace(/[^a-zA-Z0-9-_]/g, '_')}.json`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/json');

    res.json(exportData);
  } catch (error) {
    logger.error({ err: error, action: 'exportLab' }, 'Error exporting lab');
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: error.message || 'Failed to export lab',
      code: error.code || 'INTERNAL_ERROR'
    });
  }
});

/**
 * POST /api/labs/import
 * Import a lab from JSON
 */
app.post('/api/labs/import', async (req, res) => {
  try {
    const userId = req.auth?.sub;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User ID not found in token',
        code: 'UNAUTHORIZED'
      });
    }

    const { name, labJson, isTemplate } = req.body;

    // Validate request body
    if (!labJson) {
      return res.status(400).json({
        success: false,
        error: 'labJson is required in request body',
        code: 'VALIDATION_ERROR'
      });
    }

    logger.info({ action: 'importLab', userId, name }, 'Importing lab');

    const result = await labManager.importLab(userId, labJson, name, isTemplate);

    res.status(201).json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error({ err: error, action: 'importLab' }, 'Error importing lab');
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: error.message || 'Failed to import lab',
      code: error.code || 'VALIDATION_ERROR'
    });
  }
});

// =======================
// USER ENDPOINTS (Admin)
// =======================

/**
 * GET /api/users/me
 * Get current user profile
 */
app.get('/api/users/me', userController.getCurrentUser);

/**
 * GET /api/users
 * List all users (admin only)
 */
app.get('/api/users', requireRole(['admin']), userController.listUsers);

/**
 * GET /api/users/:id
 * Get user by ID (admin only)
 */
app.get('/api/users/:id', requireRole(['admin']), userController.getUser);

/**
 * POST /api/users
 * Create a new user (admin only)
 */
app.post('/api/users', requireRole(['admin']), userController.createUser);

/**
 * PATCH /api/users/:id/role
 * Update user role (admin only)
 */
app.patch('/api/users/:id/role', requireRole(['admin']), userController.updateUserRole);

/**
 * DELETE /api/users/:id
 * Delete a user (admin only)
 */
app.delete('/api/users/:id', requireRole(['admin']), userController.deleteUser);

// =======================
// ERROR HANDLERS
// =======================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    code: 'NOT_FOUND',
    timestamp: new Date().toISOString()
  });
});

// Global error handler with sanitization
app.use((err, req, res, next) => {
  const requestId = req.headers['x-request-id'] || `req-${Date.now()}`;

  // Log full error details server-side
  logger.error({
    err,
    requestId,
    userId: req.user?.id,
    endpoint: req.originalUrl,
    method: req.method
  }, 'Unhandled error');

  // Determine error type and sanitize response
  let statusCode = 500;
  let errorCode = 'INTERNAL_ERROR';
  let clientMessage = 'Internal server error';

  // Handle specific error types
  if (err.name === 'UnauthorizedError') {
    statusCode = 401;
    errorCode = 'UNAUTHORIZED';
    clientMessage = 'Invalid or missing authentication token';
  } else if (err.name === 'ValidationError' || err.type === 'entity.parse.failed') {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    clientMessage = 'Invalid request payload';
  } else if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
    statusCode = 503;
    errorCode = 'SERVICE_UNAVAILABLE';
    clientMessage = 'Service temporarily unavailable';
  } else if (err.code === 'ENOENT') {
    statusCode = 404;
    errorCode = 'NOT_FOUND';
    clientMessage = 'Resource not found';
  } else if (err.code === '23505') { // PostgreSQL unique violation
    statusCode = 409;
    errorCode = 'CONFLICT';
    clientMessage = 'Resource already exists';
  } else if (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT') {
    statusCode = 503;
    errorCode = 'SERVICE_UNAVAILABLE';
    clientMessage = 'Database connection failed';
  }

  res.status(statusCode).json({
    success: false,
    error: clientMessage,
    code: errorCode,
    timestamp: new Date().toISOString(),
    requestId
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
    await labManager.initialize();
    await auditLogger.initialize();

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
