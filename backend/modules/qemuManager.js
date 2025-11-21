const { spawn, exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const constants = require('fs').constants;
const path = require('path');
const WebSocket = require('ws');

// Added helper for readable file sizes
function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const precision = value >= 10 || unitIndex === 0 ? 0 : 1;
  return `${value.toFixed(precision)} ${units[unitIndex]}`;
}

const execAsync = promisify(exec);

// Simple logger to replace emoji soup
const logger = {
  info: (msg, meta = {}) => console.log(`[INFO] ${msg}`, Object.keys(meta).length ? JSON.stringify(meta) : ''),
  warn: (msg, meta = {}) => console.warn(`[WARN] ${msg}`, Object.keys(meta).length ? JSON.stringify(meta) : ''),
  error: (msg, meta = {}) => console.error(`[ERROR] ${msg}`, Object.keys(meta).length ? JSON.stringify(meta) : ''),
  debug: (msg, meta = {}) => console.debug(`[DEBUG] ${msg}`, Object.keys(meta).length ? JSON.stringify(meta) : '')
};

/**
 * QemuManager - Manages QEMU VM processes and disk overlays
 */
class QemuManager {
  constructor() {
    // Use absolute paths to avoid path resolution issues
    const projectRoot = path.resolve(__dirname, '../../');
    this.imagesPath = path.join(projectRoot, 'images');
    this.customImagesPath = process.env.CUSTOM_IMAGES_PATH || path.join(this.imagesPath, 'custom');
    
    // Map OS types to their cloud base images
    this.baseImages = {
      ubuntu: path.join(this.imagesPath, 'ubuntu-24-lts.qcow2'),   // Ubuntu 24 LTS Cloud Image
      alpine: path.join(this.imagesPath, 'alpine-3.qcow2'),        // Alpine Linux 3.x Cloud Image
      debian: path.join(this.imagesPath, 'debian-13.qcow2'),       // Debian 13 Cloud Image
      bazzite: path.join(this.imagesPath, 'bazzite-gnome.qcow2'),  // Bazzite GNOME
      router: path.join(this.imagesPath, 'router.qcow2'),          // Cisco Router
      default: path.join(this.imagesPath, 'ubuntu-24-lts.qcow2')   // Default to Ubuntu
    };

    // Added base metadata so frontend can show richer cards
    this.baseImageMetadata = {
      ubuntu: {
        id: 'ubuntu-24-lts',
        name: 'Ubuntu 24.04 LTS',
        description: 'Ubuntu Noble Server Cloud Image'
      },
      alpine: {
        id: 'alpine-3',
        name: 'Alpine Linux 3.x',
        description: 'Minimal Alpine cloud image'
      },
      debian: {
        id: 'debian-13',
        name: 'Debian 13 (Trixie)',
        description: 'Debian NoCloud image'
      },
      bazzite: {
        id: 'bazzite-gnome',
        name: 'Bazzite GNOME',
        description: 'Fedora based gaming distro'
      },
      router: {
        id: 'router',
        name: 'Cisco Router',
        description: 'Cisco IOS Router (Serial Console Only)'
      }
    };
    
    this.baseImagePath = process.env.BASE_IMAGE_PATH || this.baseImages.default;
    this.overlaysPath = process.env.OVERLAYS_PATH || path.join(projectRoot, 'overlays');
    this.vmsPath = process.env.VMS_PATH || path.join(projectRoot, 'vms');
    this.pidsPath = path.join(projectRoot, 'pids'); // PID files directory
    this.runningVMs = new Map(); // id -> process
  }

  /**
   * Get the base image path for a specific OS type
   */
  getBaseImageForOS(osType) {
    return this.baseImages[osType] || this.baseImages.default;
  }

  async initialize() {
    logger.info('Initializing QemuManager...');
    
    // Create directories if they don't exist
    try {
      await fs.mkdir(this.overlaysPath, { recursive: true });
      logger.info(`Overlays directory: ${this.overlaysPath}`);
    } catch (error) {
      logger.error('Error creating overlays directory:', { error: error.message });
    }

    try {
      await fs.mkdir(this.customImagesPath, { recursive: true });
      logger.info(`Custom images directory: ${this.customImagesPath}`);
    } catch (error) {
      logger.error('Error creating custom images directory:', { error: error.message });
    }

    // Setup PID directory
    try {
      await fs.mkdir(this.pidsPath, { recursive: true });
      logger.info(`PIDs directory: ${this.pidsPath}`);
    } catch (error) {
      logger.error('Error creating PIDs directory:', { error: error.message });
    }

    // Check if base image exists
    try {
      await fs.access(this.baseImagePath);
      logger.info(`Base image found: ${this.baseImagePath}`);
    } catch (error) {
      logger.warn(`Base image not found: ${this.baseImagePath}`);
      logger.warn('You will need to create a base image to run VMs');
    }

    // Check for qemu-img and qemu-system-x86_64
    try {
      await execAsync('which qemu-img');
      await execAsync('which qemu-system-x86_64');
      logger.info('QEMU tools found');
    } catch (error) {
      logger.warn('QEMU tools not found in PATH');
      logger.warn('Install: apt-get install qemu-system-x86 qemu-utils');
    }

    // Cleanup stale processes
    await this.cleanupStaleProcesses();
  }

  async cleanupStaleProcesses() {
    logger.info('Checking for stale PID files...');
    try {
      const files = await fs.readdir(this.pidsPath);
      for (const file of files) {
        if (!file.endsWith('.pid')) continue;
        const pidPath = path.join(this.pidsPath, file);
        try {
          const pid = parseInt(await fs.readFile(pidPath, 'utf8'), 10);
          // Check if process exists
          try {
            process.kill(pid, 0);
            // Process exists, kill it
            logger.warn(`Killing stale process ${pid} from ${file}`);
            process.kill(pid, 'SIGKILL');
          } catch (e) {
            // Process doesn't exist, just delete file
          }
          await fs.unlink(pidPath);
        } catch (err) {
          logger.error(`Error cleaning up PID file ${file}:`, { error: err.message });
        }
      }
    } catch (error) {
      logger.error('Error scanning PID directory:', { error: error.message });
    }
  }

  async writePidFile(id, pid) {
    try {
      await fs.writeFile(path.join(this.pidsPath, `${id}.pid`), String(pid));
    } catch (error) {
      logger.error(`Failed to write PID file for ${id}`, { error: error.message });
    }
  }

  async deletePidFile(id) {
    try {
      await fs.unlink(path.join(this.pidsPath, `${id}.pid`));
    } catch (error) {
      // Ignore if not found
    }
  }

  sanitizeId(id) {
    return id.replace(/[^a-zA-Z0-9-]/g, '');
  }

  /**
   * Create QCOW2 overlay from base image
   */
  async createOverlay(node) {
    logger.info(`Creating overlay for node ${node.id}...`);
    
    const overlayPath = node.overlayPath;
    const baseImage = node.image && node.image.path ? node.image.path : this.getBaseImageForOS(node.osType);
    
    try {
      // Check if overlay already exists
      try {
        await fs.access(overlayPath);
        logger.info(`Overlay already exists: ${overlayPath}`);
        return overlayPath;
      } catch (error) {
        // Overlay doesn't exist, create it
      }

      // Verify base image exists
      try {
        await fs.access(baseImage);
        logger.info(`Using base image: ${baseImage}`);
      } catch (error) {
        throw new Error(`Base image not found: ${baseImage}`);
      }

      // Create overlay using qemu-img
      const cmd = `qemu-img create -f qcow2 -b ${baseImage} -F qcow2 ${overlayPath}`;
      logger.info(`Running: ${cmd}`);
      
      const { stdout, stderr } = await execAsync(cmd);
      if (stderr && !stderr.includes('Formatting')) {
        logger.warn('qemu-img stderr:', { stderr });
      }
      
      logger.info(`Overlay created: ${overlayPath}`);
      return overlayPath;
    } catch (error) {
      logger.error('Error creating overlay:', { error });
      throw new Error(`Failed to create overlay: ${error.message}`);
    }
  }

  /**
   * Start QEMU VM with the overlay
   */
  async startVM(node) {
    const safeId = this.sanitizeId(node.id);
    logger.info(`Starting VM for node ${safeId}...`);
    
    // Create overlay if it doesn't exist
    await this.createOverlay(node);
    
    // Determine if this is a router
  const isRouter = node.osType === 'router' || node.baseImage === 'router';
    const isBazzite = node.osType === 'bazzite';

  const ifupScript = process.env.QEMU_IFUP || '/etc/qemu-ifup';
  const ifdownScript = process.env.QEMU_IFDOWN || '/etc/qemu-ifdown';
    
    // Check KVM availability and permissions
    let kvmAvailable = false;
    try {
      await fs.access('/dev/kvm', constants.R_OK | constants.W_OK);
      kvmAvailable = true;
    } catch (error) {
      kvmAvailable = false;
    }

    // Enforce KVM for heavy workloads
    // Note: Router can run on TCG (slow/unstable) but Bazzite definitely needs KVM
    if (isBazzite && !kvmAvailable) {
      throw new Error(`KVM acceleration is required for ${node.osType} but /dev/kvm is not accessible (R/W).`);
    }

    // QEMU command and arguments
    const qemuCommand = 'qemu-system-x86_64';
    let qemuArgs = [];

    // Add KVM args immediately if available (Generic default)
    if (kvmAvailable) {
      // We will add these specifically per-type below to avoid duplication
    } else {
      logger.warn('KVM not available, using software emulation');
    }

    let vncPort = null;
    let vncDisplay = null;
    
    if (isRouter) {
      // ========== ROUTER CONFIGURATION ==========
      logger.info(`Router configuration (serial console only)`);

      // Machine type (q35 is recommended for IOSv)
      if (kvmAvailable) {
        qemuArgs.push('-machine', 'q35,accel=kvm');
      } else {
        qemuArgs.push('-machine', 'q35');
      }

      qemuArgs.push(
        '-drive', `file=${node.overlayPath},format=qcow2,if=virtio`,
        '-m', '2048',
        '-smp', '1'
      );

      if (kvmAvailable) {
        qemuArgs.push('-enable-kvm', '-cpu', 'host');
        logger.info('Router Mode: KVM Hardware Acceleration');
        
      } else {
        logger.warn('Router Mode: TCG Software Emulation (Expect high CPU usage)');
        // "core2duo" is known to be more stable for IOSv on TCG than default qemu64
        qemuArgs.push('-cpu', 'core2duo'); 
      }

      qemuArgs.push(
        '-nographic',
        '-serial', 'mon:stdio',
        // Fixed Network Configuration for Lab Topology
        // Gi0/0 -> tap0 -> br0 (192.168.1.x)
        '-device', 'e1000,netdev=net0,mac=52:54:00:11:11:11',
        '-netdev', `tap,id=net0,ifname=tap0,script=${ifupScript},downscript=${ifdownScript}`,
        // Gi0/1 -> tap1 -> br1 (192.168.2.x)
        '-device', 'e1000,netdev=net1,mac=52:54:00:22:22:22',
        '-netdev', `tap,id=net1,ifname=tap1,script=${ifupScript},downscript=${ifdownScript}`
      );

      logger.info(`Router will boot in serial console (no VNC)`);
      logger.info(`Router boot time: ~2-3 minutes - please wait!`);
      
    } else {
      // ========== STANDARD OS CONFIGURATION ==========
      logger.info(`Standard OS: ${node.osType}`);
      
      // Get VNC port
      vncPort = node.vncPort || await this.getNextAvailablePort();
      vncDisplay = vncPort - 5900;
      
      // Generate unique MAC address
      const mac0 = '52:54:00:12:36:' + Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
      
      // Determine TAP interface based on Node Name for Lab Topology
      // PC1 -> tap2 -> br0
      // PC2 -> tap3 -> br1
      let tapIfName = `tap-${safeId.substring(0,8)}`; // Default random
      const lowerName = (node.name || '').toLowerCase();
      
      if (lowerName.includes('pc1') || lowerName.includes('pc 1')) {
        tapIfName = 'tap2';
        logger.info(`Node identified as PC1, assigning ${tapIfName} (br0)`);
      } else if (lowerName.includes('pc2') || lowerName.includes('pc 2')) {
        tapIfName = 'tap3';
        logger.info(`Node identified as PC2, assigning ${tapIfName} (br1)`);
      }

      qemuArgs.push(
        '-vnc', `0.0.0.0:${vncDisplay}`,
        '-hda', node.overlayPath,
        '-m', String(node.resources.ram || 2048),
        '-smp', String(node.resources.cpus || 2),
        '-boot', 'c',
        '-name', `node_${safeId}`,
        '-vga', 'std',
        '-serial', 'stdio',
        // Network - connected to shared bridge so VMs can talk to each other
        '-device', `e1000,netdev=net0,mac=${mac0}`,
        '-netdev', `tap,id=net0,ifname=${tapIfName},script=${ifupScript},downscript=${ifdownScript}`
      );
      
      logger.info(`VNC Port: ${vncPort} (display :${vncDisplay})`);
    }

    logger.info(`Overlay: ${node.overlayPath}`);
    
    try {
      // Spawn QEMU process
      const qemuProcess = spawn(qemuCommand, qemuArgs, {
        detached: false,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // Write PID file
      await this.writePidFile(safeId, qemuProcess.pid);

      this.runningVMs.set(node.id, {
        process: qemuProcess,
        vncPort: vncPort,
        startTime: Date.now(),
        consoleClients: new Set(),
        isRouter: isRouter,
        bootWaitTime: isRouter ? 180000 : 30000
      });

      // Handle process events - improved for router serial output
      qemuProcess.stdout.on('data', (data) => {
        const output = data.toString();
        // logger.debug(`[${isRouter ? 'ROUTER' : 'VM'} Serial ${safeId.substring(0, 8)}] ${output.trim()}`);
        
        // Broadcast to WebSocket clients
        const vmInfo = this.runningVMs.get(node.id);
        if (vmInfo && vmInfo.consoleClients) {
          for (const client of vmInfo.consoleClients) {
            try {
              if (client.socket.readyState === WebSocket.OPEN) {
                client.socket.send(JSON.stringify({ 
                  type: 'data', 
                  stream: 'stdout', 
                  payload: output 
                }));
              } else {
                vmInfo.consoleClients.delete(client);
              }
            } catch (e) {
              logger.error('Console broadcast error:', { error: e.message });
              vmInfo.consoleClients.delete(client);
            }
          }
        }
      });

      qemuProcess.stderr.on('data', (data) => {
        const msg = data.toString().trim();
        if (!msg.includes('warning') && !msg.includes('info')) {
          logger.error(`[${isRouter ? 'ROUTER' : 'VM'} ${safeId.substring(0, 8)} ERROR] ${msg}`);
        }

        const vmInfo = this.runningVMs.get(node.id);
        if (vmInfo && vmInfo.consoleClients) {
          for (const client of vmInfo.consoleClients) {
            try {
              if (client.socket.readyState === WebSocket.OPEN) {
                client.socket.send(JSON.stringify({
                  type: 'data',
                  stream: 'stderr',
                  payload: data.toString()
                }));
              } else {
                vmInfo.consoleClients.delete(client);
              }
            } catch (e) {
              logger.error('Console broadcast error:', { error: e.message });
              vmInfo.consoleClients.delete(client);
            }
          }
        }
      });
      
      // Handle stdin errors gracefully (common with routers)
      qemuProcess.stdin.on('error', (err) => {
        logger.warn(`[${safeId.substring(0, 8)}] stdin error (may be normal): ${err.message}`);
      });

      qemuProcess.on('exit', (code, signal) => {
        logger.info(`[QEMU ${safeId.substring(0, 8)}] Process exited (code: ${code}, signal: ${signal})`);
        this.deletePidFile(safeId); // Cleanup PID file
        const vmInfo = this.runningVMs.get(node.id);
        if (vmInfo && vmInfo.consoleClients) {
          for (const client of vmInfo.consoleClients) {
            try {
              if (client.socket.readyState === WebSocket.OPEN) {
                client.socket.send(JSON.stringify({ type: 'exit', code, signal }));
                client.socket.close(1000, 'VM terminated');
              }
            } catch (err) {
              logger.error('QEMU console notify error:', { error: err.message });
            }
          }
          vmInfo.consoleClients.clear();
        }
        this.runningVMs.delete(node.id);
      });

      qemuProcess.on('error', (error) => {
        logger.error(`[QEMU ${safeId.substring(0, 8)}] Process error:`, { error });
        this.deletePidFile(safeId);
        this.runningVMs.delete(node.id);
      });

      // Check if process started successfully (within 2 seconds)
      await new Promise(resolve => setTimeout(resolve, 2000));

      if (qemuProcess.exitCode !== null) {
        const exitCode = qemuProcess.exitCode;
        this.runningVMs.delete(node.id);
        this.deletePidFile(safeId);
        throw new Error(`QEMU process failed to start (exit code ${exitCode}). Check QEMU arguments.`);
      }

      logger.info(`VM started: PID ${qemuProcess.pid}, VNC :${vncDisplay} (${vncPort})`);
      
      if (isRouter) {
        logger.info(`Router console via Serial Console in UI`);
        logger.info(`Cisco boot time: ~3 minutes`);
        logger.info(`Skipping Guacamole registration for router (serial console only)`);
      }
      
      return vncPort;
    } catch (error) {
      this.runningVMs.delete(node.id);
      this.deletePidFile(safeId);
      logger.error('Error starting VM:', { error });
      throw new Error(`Failed to start VM: ${error.message}`);
    }
  }

  /**
   * Stop QEMU VM
   */
  async stopVM(node) {
    logger.info(`Stopping VM for node ${node.id}...`);
    
    const vmInfo = this.runningVMs.get(node.id);
    if (!vmInfo) {
      logger.info('VM is not running');
      return;
    }

    try {
      const { process: qemuProcess } = vmInfo;
      
      // Try graceful shutdown first (SIGTERM)
      qemuProcess.kill('SIGTERM');
      
      // Wait up to 5 seconds for graceful shutdown
      await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          if (this.runningVMs.has(node.id)) {
            logger.info('Graceful shutdown timeout, forcing kill...');
            qemuProcess.kill('SIGKILL');
          }
          resolve();
        }, 5000);

        qemuProcess.once('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
      });

      this.runningVMs.delete(node.id);
      await this.deletePidFile(this.sanitizeId(node.id));

      if (vmInfo.consoleClients) {
        for (const client of vmInfo.consoleClients) {
          try {
            if (client.socket.readyState === WebSocket.OPEN) {
              client.socket.send(JSON.stringify({ type: 'exit', code: null, signal: 'terminated' }));
              client.socket.close(1000, 'VM stopped');
            }
          } catch (err) {
            logger.error('QEMU console stop notify error:', { error: err.message });
          }
        }
        vmInfo.consoleClients.clear();
      }
      logger.info(`VM stopped for node ${node.id}`);
    } catch (error) {
      logger.error('Error stopping VM:', { error });
      throw new Error(`Failed to stop VM: ${error.message}`);
    }
  }

  /**
   * Wipe overlay (delete and recreate)
   */
  async wipeOverlay(node) {
    logger.info(`Wiping overlay for node ${node.id}...`);
    
    try {
      // Delete existing overlay
      try {
        await fs.unlink(node.overlayPath);
        logger.info(`Deleted: ${node.overlayPath}`);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          logger.warn(`Warning: ${error.message}`);
        }
      }

      // Recreate overlay (and NVRAM if router)
      await this.createOverlay(node);
      
      logger.info(`Overlay wiped for node ${node.id}`);
    } catch (error) {
      logger.error('Error wiping overlay:', { error });
      throw new Error(`Failed to wipe overlay: ${error.message}`);
    }
  }

  /**
   * Delete overlay completely
   */
  async deleteOverlay(node) {
    logger.info(`Deleting overlay for node ${node.id}...`);
    
    try {
      await fs.unlink(node.overlayPath);
      logger.info(`Overlay deleted: ${node.overlayPath}`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        logger.error('Error deleting overlay:', { error });
        throw error;
      }
    }
  }

  /**
   * Get next available VNC port by checking actual system ports
   */
  async getNextAvailablePort() {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    const startPort = parseInt(process.env.VNC_START_PORT) || 5900;
    const maxPort = startPort + 100; // Check up to 100 ports
    
    // Get ports currently used by our running VMs
    const usedByUs = new Set(
      Array.from(this.runningVMs.values()).map(vm => vm.vncPort)
    );

    // Check actual system ports
    for (let port = startPort; port < maxPort; port++) {
      if (usedByUs.has(port)) {
        continue; // Skip ports we know we're using
      }
      
      // Check if port is available on the system
      try {
        const { stdout } = await execAsync(`netstat -tln 2>/dev/null | grep :${port} || ss -tln | grep :${port}`);
        if (stdout.trim()) {
          // Port is in use
          continue;
        }
      } catch (error) {
        // Command failed (no match found), port is available
      }
      
      // Port is available!
      return port;
    }

    // If we get here, all ports are in use
    throw new Error(`No available VNC ports in range ${startPort}-${maxPort}`);
  }

  /**
   * Cleanup all running VMs
   */
  async cleanup() {
    logger.info('Cleaning up QEMU processes...');
    
    const promises = Array.from(this.runningVMs.keys()).map(async (nodeId) => {
      const vmInfo = this.runningVMs.get(nodeId);
      if (vmInfo && vmInfo.process) {
        try {
          vmInfo.process.kill('SIGTERM');
          logger.info(`Stopped VM: ${nodeId}`);
        } catch (error) {
          logger.error(`Error stopping VM ${nodeId}:`, { error: error.message });
        }
      }
    });

    await Promise.all(promises);
    this.runningVMs.clear();
    logger.info('Cleanup complete');
  }

  isVMRunning(nodeId) {
    const vmInfo = this.runningVMs.get(nodeId);
    if (!vmInfo || !vmInfo.process) {
      return false;
    }

    const { process } = vmInfo;
    if (process.exitCode !== null) {
      return false;
    }

    if (process.signalCode !== null) {
      return false;
    }

    return !process.killed;
  }

  // Added to enumerate built-in and custom images for the UI
  async listAvailableImages() {
    const baseEntries = await Promise.all(Object.entries(this.baseImages)
      .filter(([key]) => key !== 'default')
      .map(async ([key, imagePath]) => {
        try {
          const stats = await fs.stat(imagePath);
          const meta = this.baseImageMetadata[key] || { id: key, name: key, description: '' };
          return {
            type: 'base',
            id: key,
            name: meta.name,
            description: meta.description,
            path: imagePath,
            sizeBytes: stats.size,
            size: formatBytes(stats.size),
            available: true
          };
        } catch (error) {
          const meta = this.baseImageMetadata[key] || { id: key, name: key, description: '' };
          return {
            type: 'base',
            id: key,
            name: meta.name,
            description: meta.description,
            path: imagePath,
            sizeBytes: 0,
            size: '0 B',
            available: false,
            error: error.message
          };
        }
      }));

    let customEntries = [];
    try {
      const files = await fs.readdir(this.customImagesPath);
      customEntries = await Promise.all(files.filter(f => f.endsWith('.qcow2')).map(async (file) => {
        const fullPath = path.join(this.customImagesPath, file);
        const stats = await fs.stat(fullPath);
        return {
          type: 'custom',
          id: file,
          name: file.replace(/\.qcow2$/i, ''),
          path: fullPath,
          sizeBytes: stats.size,
          size: formatBytes(stats.size),
          available: true,
          uploadedAt: stats.birthtime
        };
      }));
    } catch (error) {
      logger.error('Error listing custom images:', { error: error.message });
    }

    return {
      baseImages: baseEntries,
      customImages: customEntries
    };
  }

  // Added helper to resolve the source image for a node request
  async resolveImage({ imageType = 'base', osType = 'ubuntu', customImageName }) {
    if (imageType === 'custom') {
      if (!customImageName) {
        throw new Error('Custom image name required');
      }
      const candidate = path.join(this.customImagesPath, customImageName);
      try {
        const stats = await fs.stat(candidate);
        return {
          type: 'custom',
          id: customImageName,
          path: candidate,
          sizeBytes: stats.size,
          size: formatBytes(stats.size),
          name: path.parse(customImageName).name
        };
      } catch (error) {
        throw new Error(`Custom image not found: ${customImageName}`);
      }
    }

    const basePath = this.getBaseImageForOS(osType);
    try {
      const stats = await fs.stat(basePath);
      const meta = this.baseImageMetadata[osType] || { name: osType, description: '' };
      return {
        type: 'base',
        id: osType,
        path: basePath,
        sizeBytes: stats.size,
        size: formatBytes(stats.size),
        name: meta.name,
        description: meta.description
      };
    } catch (error) {
      throw new Error(`Base image not available for ${osType}`);
    }
  }

  // Added to connect WebSocket clients to QEMU stdio
  attachConsoleClient(nodeId, socket) {
    const vmInfo = this.runningVMs.get(nodeId);
    if (!vmInfo || !vmInfo.process) {
      throw new Error('VM is not running');
    }

    const { process } = vmInfo;
    if (!process.stdin || !process.stdout) {
      throw new Error('Console streams unavailable');
    }

    socket.on('message', (message) => {
      try {
        const payload = Buffer.isBuffer(message) ? message.toString('utf8') : String(message);
        process.stdin.write(payload);
      } catch (error) {
        logger.error('Console stdin write error:', { error: error.message });
      }
    });

    const clientRef = { socket };
    vmInfo.consoleClients.add(clientRef);

    socket.on('close', () => {
      vmInfo.consoleClients.delete(clientRef);
    });

    socket.send(JSON.stringify({ type: 'ready', nodeId }));
  }

  /**
   * Helper to wait for a specific prompt in stdout
   */
  async waitForPrompt(process, promptRegex, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
      let buffer = '';
      
      const onData = (data) => {
        buffer += data.toString();
        // Check last 1000 chars to avoid huge buffer
        const checkBuffer = buffer.slice(-1000);
        if (promptRegex.test(checkBuffer)) {
          cleanup();
          resolve(checkBuffer);
        }
      };

      const cleanup = () => {
        process.stdout.removeListener('data', onData);
        clearTimeout(timeoutId);
      };

      process.stdout.on('data', onData);
      
      const timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error(`Timeout waiting for prompt matching ${promptRegex}`));
      }, timeoutMs);
    });
  }

  /**
   * Auto-configure a Cisco router with network settings
   */
  async autoConfigureRouter(nodeId, config) {
    const vmInfo = this.runningVMs.get(nodeId);
    if (!vmInfo || !vmInfo.process) {
      throw new Error('VM is not running');
    }

    const { process } = vmInfo;
    if (!process.stdin) {
      throw new Error('Console stdin unavailable');
    }

    logger.info(`Auto-configuring router ${nodeId.substring(0, 8)}...`);
    logger.info(`Hostname: ${config.hostname}`);

    const sendCommand = async (cmd, expectRegex = null, timeout = 5000) => {
      process.stdin.write(cmd + '\r');
      logger.info(`Sent: ${cmd}`);
      if (expectRegex) {
        await this.waitForPrompt(process, expectRegex, timeout);
      } else {
        // Fallback for commands that don't produce clear prompts immediately
        await new Promise(r => setTimeout(r, 500));
      }
    };

    try {
      // Initial wake up
      process.stdin.write('\r');
      await new Promise(r => setTimeout(r, 1000));

      // Enter privileged mode
      await sendCommand('enable', /#/, 5000);
      
      // Enter config mode
      await sendCommand('configure terminal', /\(config\)#/, 5000);
      
      // Set hostname
      await sendCommand(`hostname ${config.hostname || 'Router1'}`, /\(config\)#/, 5000);

      // Set enable secret only if provided (allows password-less labs)
      if (config.enableSecret && config.enableSecret.trim().length > 0) {
        await sendCommand(`enable secret ${config.enableSecret}`, /\(config\)#/, 5000);
      } else {
        logger.info('Skipping enable secret configuration (no password requested)');
      }
      
      // Configure first interface
      await sendCommand('interface FastEthernet0/0', /\(config-if\)#/, 5000);
      await sendCommand(`ip address ${config.interface0.ip} ${config.interface0.mask}`, /\(config-if\)#/, 5000);
      await sendCommand('no shutdown', /\(config-if\)#/, 5000);
      await sendCommand('exit', /\(config\)#/, 5000);
      
      // Configure second interface
      await sendCommand('interface FastEthernet0/1', /\(config-if\)#/, 5000);
      await sendCommand(`ip address ${config.interface1.ip} ${config.interface1.mask}`, /\(config-if\)#/, 5000);
      await sendCommand('no shutdown', /\(config-if\)#/, 5000);
      await sendCommand('exit', /\(config\)#/, 5000);
      
      // Add static routes
      if (config.routes) {
        for (const route of config.routes) {
          await sendCommand(`ip route ${route.network} ${route.mask} ${route.nextHop}`, /\(config\)#/, 5000);
        }
      }
      
      // Exit config mode
      await sendCommand('end', /#/, 5000);
      
      // Save configuration
      await sendCommand('write memory', /OK/, 10000);
      
      logger.info(`Router configuration sent to ${config.hostname}`);
      return true;
    } catch (error) {
      logger.error('Router auto-configuration failed:', { error: error.message });
      throw error;
    }
  }

  /**
   * Ensure image is in QCOW2 format, convert if necessary
   */
  async ensureQcow2Format(imagePath) {
    logger.info(`Checking format of ${path.basename(imagePath)}...`);
    
    try {
      // Detect the current format
      const { stdout } = await execAsync(`qemu-img info --output=json "${imagePath}"`);
      const info = JSON.parse(stdout);
      const currentFormat = info.format;
      
      logger.info(`Current format: ${currentFormat}`);
      
      // If already QCOW2, return as-is
      if (currentFormat === 'qcow2') {
        logger.info(`Image is already in QCOW2 format`);
        return imagePath;
      }
      
      // Need to convert
      const ext = path.extname(imagePath);
      const baseName = path.basename(imagePath, ext);
      const convertedPath = path.join(
        path.dirname(imagePath),
        `${baseName}_converted.qcow2`
      );
      
      logger.info(`Converting ${currentFormat} to QCOW2...`);
      logger.info(`Source: ${imagePath}`);
      logger.info(`Target: ${convertedPath}`);
      
      // Convert to QCOW2
      const cmd = `qemu-img convert -f ${currentFormat} -O qcow2 "${imagePath}" "${convertedPath}"`;
      await execAsync(cmd);
      
      // Verify conversion
      const { stdout: verifyOutput } = await execAsync(`qemu-img info --output=json "${convertedPath}"`);
      const verifyInfo = JSON.parse(verifyOutput);
      
      if (verifyInfo.format !== 'qcow2') {
        throw new Error(`Conversion failed: resulting format is ${verifyInfo.format}`);
      }
      
      logger.info(`Conversion successful`);
      logger.info(`Original size: ${formatBytes(info['actual-size'] || info['virtual-size'])}`);
      logger.info(`Converted size: ${formatBytes(verifyInfo['actual-size'] || verifyInfo['virtual-size'])}`);
      
      return convertedPath;
    } catch (error) {
      logger.error('Error converting image format:', { error });
      throw new Error(`Failed to convert image to QCOW2: ${error.message}`);
    }
  }
}

module.exports = { QemuManager };
