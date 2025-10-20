# SandBoxLabs - Project Structure

## 📚 Related Documentation

- **[Main README](./README.md)** - Complete project documentation
- **[Quick Start Guide](./QUICK-START.md)** - Get running in 1 command
- **[Project Summary](./PROJECT-SUMMARY.md)** - Overview and deliverables
- **[Backend API Docs](./backend/README.md)** - API endpoints
- **[Frontend Docs](./frontend/README.md)** - UI components
- **[Documentation Index](./docs/README.md)** - All documentation files

## 📁 Directory Layout

```
sandboxlabs/
├── 📄 README.md                # Complete project documentation
├── 📄 QUICK-START.md           # Quick setup guide
├── 📄 CHEAT-SHEET.txt          # Command reference
├── 📄 PROJECT-SUMMARY.md       # Project overview
├── 📄 STATUS.md                # Current status
├── 📄 STRUCTURE.md             # This file
│
├── 🔧 Core Scripts
│   ├── run-all.sh              # Start everything
│   ├── stop-all.sh             # Stop everything
│   ├── status.sh               # Check status
│   ├── setup-all.sh            # Initial setup
│   ├── quick-test.sh           # Quick health check
│   └── test-backend.sh         # Backend tests
│
├── 🐳 Infrastructure
│   ├── docker-compose.yml      # Docker services
│   └── initdb-schema.sql       # Guacamole DB schema
│
├── 🎨 Frontend (Next.js/React)
│   ├── app/
│   │   ├── page.tsx            # Main dashboard
│   │   ├── layout.tsx          # Root layout
│   │   └── globals.css         # Styles
│   ├── components/
│   │   ├── NodeCard.tsx
│   │   ├── CreateNodeModal.tsx
│   │   ├── GuacamoleViewer.tsx
│   │   ├── StatusBadge.tsx
│   │   └── Button.tsx
│   ├── lib/
│   │   ├── api.ts              # API client
│   │   ├── types.ts            # TypeScript types
│   │   └── mockData.ts         # Mock data
│   ├── package.json
│   └── README.md
│
├── 🔧 Backend (Node.js/Express)
│   ├── server.js               # Main API server
│   ├── modules/
│   │   ├── nodeManager.js      # Node state management
│   │   ├── qemuManager.js      # QEMU lifecycle
│   │   └── guacamoleClient.js  # Guacamole integration
│   ├── .env                    # Configuration
│   ├── package.json
│   └── README.md
│
├── 💾 VM Storage
│   ├── images/                 # Base OS images
│   │   ├── ubuntu-24-lts.qcow2
│   │   ├── alpine-3.qcow2
│   │   └── debian-13.qcow2
│   ├── overlays/               # Node overlays (runtime)
│   └── vms/                    # Legacy VM storage
│
├── 🗄️ Database
│   └── pgdata/                 # PostgreSQL data (runtime)
│
└── 📚 Documentation
    └── docs/
        └── README.md           # Additional docs
```

## 🎯 Key Files

### Essential Documentation
- **README.md** - Start here! Complete setup and usage guide
- **QUICK-START.md** - Get running in 1 command
- **CHEAT-SHEET.txt** - Common commands and API examples

### Main Scripts
- **run-all.sh** - One command to start everything
- **stop-all.sh** - Clean shutdown
- **status.sh** - Check all services

### Configuration
- **docker-compose.yml** - Infrastructure definition
- **backend/.env** - Backend configuration
- **frontend/.env.local** - Frontend configuration

## 🚀 Quick Access

### URLs
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001/api
- Guacamole: http://localhost:8081/guacamole

### Key Commands
```bash
# Start
./run-all.sh

# Check status
./status.sh

# Stop
./stop-all.sh
```

## 📊 Project Stats
- Frontend: ~1,063 LOC (TypeScript/React)
- Backend: ~800 LOC (JavaScript/Express)
- Documentation: ~2,000 lines
- Scripts: ~15 shell scripts
- Total: Production-ready lab environment

---

For complete documentation, see **README.md**
