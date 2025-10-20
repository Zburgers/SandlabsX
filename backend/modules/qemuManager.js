const { spawn, exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');

const execAsync = promisify(exec);

/**
 * QemuManager - Manages QEMU VM processes and disk overlays
 */
class QemuManager {
  constructor() {
    // Use absolute paths to avoid path resolution issues
    const projectRoot = path.resolve(__dirname, '../../');
    this.imagesPath = path.join(projectRoot, 'images');
    
    // Map OS types to their cloud base images
    this.baseImages = {
      'ubuntu': path.join(this.imagesPath, 'ubuntu-24-lts.qcow2'),      // Ubuntu 24 LTS Cloud Image
      'alpine': path.join(this.imagesPath, 'alpine-3.qcow2'),           // Alpine Linux 3.x Cloud Image
      'debian': path.join(this.imagesPath, 'debian-13.qcow2'),          // Debian 13 Cloud Image
      'default': path.join(this.imagesPath, 'ubuntu-24-lts.qcow2')      // Default to Ubuntu
    };
    
    this.baseImagePath = process.env.BASE_IMAGE_PATH || this.baseImages.default;
    this.overlaysPath = process.env.OVERLAYS_PATH || path.join(projectRoot, 'overlays');
    this.vmsPath = process.env.VMS_PATH || path.join(projectRoot, 'vms');
    this.runningVMs = new Map(); // id -> process
  }

  /**
   * Get the base image path for a specific OS type
   */
  getBaseImageForOS(osType) {
    return this.baseImages[osType] || this.baseImages.default;
  }

  async initialize() {
    console.log('🖥️  Initializing QemuManager...');
    
    // Create directories if they don't exist
    try {
      await fs.mkdir(this.overlaysPath, { recursive: true });
      console.log(`✅ Overlays directory: ${this.overlaysPath}`);
    } catch (error) {
      console.error('Error creating overlays directory:', error.message);
    }

    // Check if base image exists
    try {
      await fs.access(this.baseImagePath);
      console.log(`✅ Base image found: ${this.baseImagePath}`);
    } catch (error) {
      console.warn(`⚠️  Base image not found: ${this.baseImagePath}`);
      console.warn('   You will need to create a base image to run VMs');
    }

    // Check for qemu-img and qemu-system-x86_64
    try {
      await execAsync('which qemu-img');
      await execAsync('which qemu-system-x86_64');
      console.log('✅ QEMU tools found');
    } catch (error) {
      console.warn('⚠️  QEMU tools not found in PATH');
      console.warn('   Install: apt-get install qemu-system-x86 qemu-utils');
    }
  }

  /**
   * Create QCOW2 overlay from base image
   */
  async createOverlay(node) {
    console.log(`📀 Creating overlay for node ${node.id}...`);
    
    const overlayPath = node.overlayPath;
    const baseImage = this.getBaseImageForOS(node.osType);
    
    try {
      // Check if overlay already exists
      try {
        await fs.access(overlayPath);
        console.log(`  Overlay already exists: ${overlayPath}`);
        return overlayPath;
      } catch (error) {
        // Overlay doesn't exist, create it
      }

      // Verify base image exists
      try {
        await fs.access(baseImage);
        console.log(`  Using base image: ${baseImage}`);
      } catch (error) {
        throw new Error(`Base image not found: ${baseImage}`);
      }

      // Create overlay using qemu-img
      const cmd = `qemu-img create -f qcow2 -b ${baseImage} -F qcow2 ${overlayPath}`;
      console.log(`  Running: ${cmd}`);
      
      const { stdout, stderr } = await execAsync(cmd);
      if (stderr && !stderr.includes('Formatting')) {
        console.warn('  qemu-img stderr:', stderr);
      }
      
      console.log(`✅ Overlay created: ${overlayPath}`);
      return overlayPath;
    } catch (error) {
      console.error('Error creating overlay:', error);
      throw new Error(`Failed to create overlay: ${error.message}`);
    }
  }

  /**
   * Start QEMU VM with the overlay
   */
  async startVM(node) {
    console.log(`🚀 Starting VM for node ${node.id}...`);
    
    // Create overlay if it doesn't exist
    await this.createOverlay(node);
    
    // Get VNC port (use node's port if assigned, or get next available)
    const vncPort = node.vncPort || await this.getNextAvailablePort();
    const vncDisplay = vncPort - 5900; // VNC display number
    
    // Build QEMU command with better boot options
    const qemuArgs = [
      '-vnc', `0.0.0.0:${vncDisplay}`,
      '-hda', node.overlayPath,
      '-m', String(node.resources.ram || 2048),
      '-smp', String(node.resources.cpus || 2),
      '-boot', 'c',  // Boot from hard disk
      '-name', `node_${node.id}`,
      '-vga', 'std',  // Standard VGA for better compatibility
      '-serial', 'stdio',  // Serial console for debugging
    ];

    // Add KVM acceleration if available (Linux only)
    if (process.platform === 'linux') {
      try {
        await fs.access('/dev/kvm');
        qemuArgs.push('-enable-kvm');
        console.log('  KVM acceleration enabled');
      } catch (error) {
        console.log('  KVM not available, using software emulation');
      }
    }

    console.log(`  VNC Port: ${vncPort} (display :${vncDisplay})`);
    console.log(`  Command: qemu-system-x86_64 ${qemuArgs.join(' ')}`);
    console.log(`  Overlay: ${node.overlayPath}`);
    console.log(`  Base: ${this.baseImagePath}`);
    try {
      // Spawn QEMU process
      const qemuProcess = spawn('qemu-system-x86_64', qemuArgs, {
        detached: false,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      // Store process reference
      this.runningVMs.set(node.id, {
        process: qemuProcess,
        vncPort: vncPort,
        startTime: Date.now()
      });

      // Handle process events
      qemuProcess.stdout.on('data', (data) => {
        console.log(`  [QEMU ${node.id}] ${data.toString().trim()}`);
      });

      qemuProcess.stderr.on('data', (data) => {
        const msg = data.toString().trim();
        if (!msg.includes('warning') && !msg.includes('info')) {
          console.error(`  [QEMU ${node.id} ERROR] ${msg}`);
        }
      });

      qemuProcess.on('exit', (code, signal) => {
        console.log(`  [QEMU ${node.id}] Process exited (code: ${code}, signal: ${signal})`);
        this.runningVMs.delete(node.id);
      });

      qemuProcess.on('error', (error) => {
        console.error(`  [QEMU ${node.id}] Process error:`, error);
        this.runningVMs.delete(node.id);
      });

      // Wait a moment to ensure VM started
      await new Promise(resolve => setTimeout(resolve, 1000));

      if (qemuProcess.exitCode !== null) {
        throw new Error(`QEMU process exited immediately with code ${qemuProcess.exitCode}`);
      }

      console.log(`✅ VM started: PID ${qemuProcess.pid}, VNC :${vncDisplay} (${vncPort})`);
      
      return vncPort;
    } catch (error) {
      this.runningVMs.delete(node.id);
      console.error('Error starting VM:', error);
      throw new Error(`Failed to start VM: ${error.message}`);
    }
  }

  /**
   * Stop QEMU VM
   */
  async stopVM(node) {
    console.log(`⏹️  Stopping VM for node ${node.id}...`);
    
    const vmInfo = this.runningVMs.get(node.id);
    if (!vmInfo) {
      console.log('  VM is not running');
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
            console.log('  Graceful shutdown timeout, forcing kill...');
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
      console.log(`✅ VM stopped for node ${node.id}`);
    } catch (error) {
      console.error('Error stopping VM:', error);
      throw new Error(`Failed to stop VM: ${error.message}`);
    }
  }

  /**
   * Wipe overlay (delete and recreate)
   */
  async wipeOverlay(node) {
    console.log(`🧹 Wiping overlay for node ${node.id}...`);
    
    try {
      // Delete existing overlay
      try {
        await fs.unlink(node.overlayPath);
        console.log(`  Deleted: ${node.overlayPath}`);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          console.warn(`  Warning: ${error.message}`);
        }
      }

      // Recreate overlay
      await this.createOverlay(node);
      
      console.log(`✅ Overlay wiped for node ${node.id}`);
    } catch (error) {
      console.error('Error wiping overlay:', error);
      throw new Error(`Failed to wipe overlay: ${error.message}`);
    }
  }

  /**
   * Delete overlay completely
   */
  async deleteOverlay(node) {
    console.log(`🗑️  Deleting overlay for node ${node.id}...`);
    
    try {
      await fs.unlink(node.overlayPath);
      console.log(`✅ Overlay deleted: ${node.overlayPath}`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('Error deleting overlay:', error);
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
    console.log('🧹 Cleaning up QEMU processes...');
    
    const promises = Array.from(this.runningVMs.keys()).map(async (nodeId) => {
      const vmInfo = this.runningVMs.get(nodeId);
      if (vmInfo && vmInfo.process) {
        try {
          vmInfo.process.kill('SIGTERM');
          console.log(`  Stopped VM: ${nodeId}`);
        } catch (error) {
          console.error(`  Error stopping VM ${nodeId}:`, error.message);
        }
      }
    });

    await Promise.all(promises);
    this.runningVMs.clear();
    console.log('✅ Cleanup complete');
  }
}

module.exports = { QemuManager };
