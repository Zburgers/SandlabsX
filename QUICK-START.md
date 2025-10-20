
# 🚀 QUICK START - RUN IN 1 COMMAND

## The Simplest Way to Start Everything

### 1️⃣ ONE COMMAND TO START EVERYTHING:

```bash
cd /home/naki/Desktop/itsthatnewshit/sandboxlabs
./run-all.sh
```

**That's it!** This single command will:
- ✅ Install all dependencies (backend + frontend)
- ✅ Start Docker services (Guacamole, PostgreSQL, Guacd)
- ✅ Start Backend API server (port 3001)
- ✅ Start Frontend dev server (port 3000)
- ✅ Run everything in the background

**Wait 20 seconds** for everything to start, then open:
👉 **http://localhost:3000**

---

## 2️⃣ Check Status

```bash
./status.sh
```

Shows you what's running and what's not.

---

## 3️⃣ Stop Everything

```bash
./stop-all.sh
```

Stops all services cleanly.

---

## 📋 All Commands (From Root Directory)

| Command | What It Does |
|---------|--------------|
| `./run-all.sh` | **START EVERYTHING** (Docker + Backend + Frontend) |
| `./stop-all.sh` | **STOP EVERYTHING** |
| `./status.sh` | Check what's running |
| `tail -f backend.log` | View backend logs |
| `tail -f frontend.log` | View frontend logs |
| `docker-compose logs -f` | View Docker logs |

---

## 🌐 Access URLs

Once everything is running:

| Service | URL |
|---------|-----|
| **Frontend UI** (main app) | http://localhost:3000 |
| **Backend API** | http://localhost:3001/api |
| **API Health Check** | http://localhost:3001/api/health |
| **Guacamole Console** | http://localhost:8081/guacamole |

**Guacamole Login:**
- Username: `guacadmin`
- Password: `guacadmin`

---

## 🎮 Using The Application

1. Open **http://localhost:3000**
2. Click **"Add Node"** button
3. Enter a name (or leave blank for auto-name)
4. Click **Create**
5. Node appears in the list
6. Click **"Run"** to start the VM
7. Click **"Connect"** to open console
8. Use **"Stop"** to shut down
9. Use **"Wipe"** to reset to clean state

---

## 🐛 Troubleshooting

### If something doesn't start:

```bash
# Check status
./status.sh

# Check logs
tail -f backend.log
tail -f frontend.log
docker-compose logs
```

### Common Issues:

**"Port already in use"**
```bash
# Stop everything first
./stop-all.sh

# Kill any orphan processes
pkill -f "next dev"
pkill -f "node.*server"

# Try again
./run-all.sh
```

**"Docker services not starting"**
```bash
docker-compose down
docker-compose up -d
```

**"Backend not responding"**
```bash
# Check backend log
tail -f backend.log

# Manually test
cd backend
node server.js
```

---

## 📦 First Time Setup (Optional)

If `./run-all.sh` doesn't work the first time, run setup first:

```bash
# Install dependencies manually
cd backend
npm install

cd ../frontend
npm install

cd ..

# Then start
./run-all.sh
```

---

## 🎯 Directory Structure (Where You Are)

```
/home/naki/Desktop/itsthatnewshit/sandboxlabs/  ← YOU ARE HERE
├── run-all.sh         ← START EVERYTHING
├── stop-all.sh        ← STOP EVERYTHING  
├── status.sh          ← CHECK STATUS
├── backend/           ← Backend API code
├── frontend/          ← Frontend UI code
├── docker-compose.yml ← Docker services
└── [logs and pid files created automatically]
```

---

## 💡 Tips

1. **Always run from the root directory** (`/home/naki/Desktop/itsthatnewshit/sandboxlabs/`)
2. **Wait 20-30 seconds** after running `./run-all.sh` for everything to start
3. **Check logs** if something doesn't work: `tail -f backend.log`
4. **Use status.sh** to see what's running
5. **Always stop cleanly** with `./stop-all.sh` before shutting down

---

## 🚀 Ready to Use!

```bash
cd /home/naki/Desktop/itsthatnewshit/sandboxlabs
./run-all.sh
# Wait 20 seconds...
# Open http://localhost:3000
```

**That's all you need!** 🎉
