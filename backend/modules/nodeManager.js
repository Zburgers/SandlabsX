const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

/**
 * NodeManager - Manages node state and persistence
 */
class NodeManager {
  constructor() {
    this.stateFile = process.env.STATE_FILE || path.join(__dirname, '..', 'nodes-state.json');
    this.nodes = new Map();
  }

  async initialize() {
    console.log('📊 Initializing NodeManager...');
    
    // Load existing state
    try {
      const data = await fs.readFile(this.stateFile, 'utf8');
      const state = JSON.parse(data);
      
      // Restore nodes to Map
      if (state.nodes && Array.isArray(state.nodes)) {
        state.nodes.forEach(node => {
          this.nodes.set(node.id, node);
        });
        console.log(`✅ Loaded ${this.nodes.size} existing nodes from state file`);
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('📝 No existing state file, starting fresh');
        await this.saveState();
      } else {
        console.error('⚠️  Error loading state:', error.message);
      }
    }
  }

  async saveState() {
    try {
      const state = {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        nodes: Array.from(this.nodes.values())
      };
      
      await fs.writeFile(this.stateFile, JSON.stringify(state, null, 2), 'utf8');
    } catch (error) {
      console.error('Error saving state:', error);
      throw error;
    }
  }

  async createNode(name, osType = 'ubuntu', resources = {}) {
    const id = uuidv4();
    const timestamp = new Date().toISOString();
    
    // Use container paths for overlays
    const overlaysPath = process.env.OVERLAYS_PATH || '/overlays';
    
    const node = {
      id,
      name: name || `node-${id.substring(0, 8)}`,
      osType,
      status: 'stopped',
      overlayPath: path.join(overlaysPath, `node_${id}.qcow2`),
      vncPort: null,
      guacConnectionId: null,
      guacUrl: null,
      pid: null,
      createdAt: timestamp,
      updatedAt: timestamp,
      startedAt: null,
      stoppedAt: null,
      wipedAt: null,
      resources: {
        ram: parseInt(resources.ram) || parseInt(process.env.QEMU_RAM) || 2048,
        cpus: parseInt(resources.cpus) || parseInt(process.env.QEMU_CPUS) || 2
      }
    };

    this.nodes.set(id, node);
    await this.saveState();
    
    console.log(`✅ Created node: ${node.name} (${id}) - ${node.osType} with ${node.resources.ram}MB RAM, ${node.resources.cpus} CPUs`);
    return node;
  }

  async getNode(id) {
    return this.nodes.get(id) || null;
  }

  async listNodes() {
    return Array.from(this.nodes.values()).sort((a, b) => 
      new Date(b.createdAt) - new Date(a.createdAt)
    );
  }

  async updateNode(id, updates) {
    const node = this.nodes.get(id);
    if (!node) {
      throw new Error('Node not found');
    }

    const updatedNode = {
      ...node,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this.nodes.set(id, updatedNode);
    await this.saveState();
    
    return updatedNode;
  }

  async deleteNode(id) {
    const node = this.nodes.get(id);
    if (!node) {
      throw new Error('Node not found');
    }

    this.nodes.delete(id);
    await this.saveState();
    
    console.log(`🗑️  Deleted node: ${node.name} (${id})`);
    return true;
  }

  async getNextAvailableVncPort() {
    const startPort = parseInt(process.env.VNC_START_PORT) || 5900;
    const usedPorts = new Set(
      Array.from(this.nodes.values())
        .filter(n => n.vncPort)
        .map(n => n.vncPort)
    );

    let port = startPort;
    while (usedPorts.has(port)) {
      port++;
    }

    return port;
  }
}

module.exports = { NodeManager };
