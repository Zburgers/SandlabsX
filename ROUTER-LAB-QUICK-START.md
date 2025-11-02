# Router Lab Quick Start
## QEMU Router Networking Lab - Get Started in 5 Minutes

**For:** SandBoxLabs POC - Task 2  
**Version:** 1.0.0

---

## 🚀 Three Ways to Get Started

### Option 1: Automated Setup (Fastest - 2 minutes)

```bash
cd /home/runner/work/SandlabsX/SandlabsX

# Download router image (if not done)
wget https://labs.networkgeek.in/router.qcow2 -O images/router.qcow2

# Run automated setup
./scripts/network/setup-router-lab.sh

# Connect via VNC
vncviewer localhost:5900  # Router
vncviewer localhost:5901  # PC1
vncviewer localhost:5902  # PC2
```

### Option 2: Using SandLabsX UI

```bash
# Start SandLabsX
./run-all.sh

# Open http://localhost:3000
# Create nodes and configure via Guacamole console
```

### Option 3: Manual Step-by-Step

See detailed guide: [`docs/ROUTER-NETWORKING-GUIDE.md`](docs/ROUTER-NETWORKING-GUIDE.md)

---

## 📚 Complete Documentation

### Start Here
1. **[Technical PRD](docs/TASK-2-ROUTER-NETWORKING-PRD.md)** - Complete requirements and architecture
2. **[Setup Guide](docs/ROUTER-NETWORKING-GUIDE.md)** - Step-by-step instructions
3. **[Troubleshooting](docs/NETWORK-TROUBLESHOOTING.md)** - Common issues and solutions
4. **[Implementation Summary](docs/TASK-2-IMPLEMENTATION-SUMMARY.md)** - Task completion report

### Quick Links
- **Network Topology:** See PRD Section 2.3
- **Configuration Commands:** See Setup Guide Step 4-6
- **Verification Tests:** See Setup Guide "Verification & Testing"
- **Issue Mitigation:** See PRD Section 7 or Troubleshooting Guide

---

## 🎯 What You'll Build

```
PC1 (192.168.1.2) ──┐
                    ├─── Router ───┐
Network 1           │              │  Network 2
192.168.1.0/24      │              │  192.168.2.0/24
                    │              │
                    └──────────────┴─ PC2 (192.168.2.2)

✓ 1 Cisco Router (dual interfaces)
✓ 2 Linux PCs (Ubuntu/Alpine)
✓ Full routing between networks
✓ VNC console access for all VMs
```

---

## ✅ Success Verification

```bash
# On PC1
ping 192.168.2.2    # Should work! (via router)

# On PC2  
ping 192.168.1.2    # Should work! (via router)
```

---

## 🧹 Cleanup

```bash
./scripts/network/cleanup-router-lab.sh
```

---

## 📞 Need Help?

- **Common Issues:** [`docs/NETWORK-TROUBLESHOOTING.md`](docs/NETWORK-TROUBLESHOOTING.md)
- **Setup Problems:** [`docs/ROUTER-NETWORKING-GUIDE.md`](docs/ROUTER-NETWORKING-GUIDE.md)
- **Technical Details:** [`docs/TASK-2-ROUTER-NETWORKING-PRD.md`](docs/TASK-2-ROUTER-NETWORKING-PRD.md)

---

**Quick Reference:**
- Router VNC: `localhost:5900`
- PC1 VNC: `localhost:5901`
- PC2 VNC: `localhost:5902`
- Guacamole: `http://localhost:8081/guacamole` (guacadmin/guacadmin)

**Scripts:**
- Setup: `./scripts/network/setup-router-lab.sh`
- Cleanup: `./scripts/network/cleanup-router-lab.sh`
- Configure PC1: `./scripts/router/pc1-network-config.sh`
- Configure PC2: `./scripts/router/pc2-network-config.sh`
