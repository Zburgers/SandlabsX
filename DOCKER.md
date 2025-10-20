# SandLabX - Docker Deployment

Complete containerized deployment of SandBoxLabs network lab environment.

## 🐳 Quick Start with Docker

### Prerequisites
- Docker Desktop or Docker Engine 20.10+
- Docker Compose V2
- 4GB+ available RAM
- 10GB+ available disk space

### One-Command Deployment

```bash
docker-compose up -d
```

That's it! Wait 30 seconds for all services to start, then access:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001/api
- **Guacamole**: http://localhost:8081/guacamole

## 📦 What Gets Deployed

The Docker Compose stack includes 5 services:

1. **PostgreSQL** - Database for Guacamole (port 5432)
2. **Guacd** - Guacamole proxy daemon (internal)
3. **Guacamole** - Web-based console (port 8081)
4. **Backend** - Node.js API server (port 3001)
5. **Frontend** - Next.js web UI (port 3000)

## 🔧 Configuration

All services are pre-configured and ready to use. Default credentials:

**Guacamole:**
- Username: `guacadmin`
- Password: `guacadmin`

**PostgreSQL:**
- Database: `guacamole_db`
- User: `guacamole`
- Password: `guacpass123`

## 📊 Container Management

### View Status
```bash
docker-compose ps
```

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
```

### Restart Services
```bash
# Restart all
docker-compose restart

# Restart specific service
docker-compose restart backend
```

### Stop All Services
```bash
docker-compose down
```

### Stop and Remove All Data
```bash
docker-compose down -v
```

## 🏗️ Building from Source

To rebuild the containers after code changes:

```bash
# Rebuild all
docker-compose build

# Rebuild specific service
docker-compose build backend
docker-compose build frontend

# Rebuild and restart
docker-compose up -d --build
```

## 📁 Volumes and Data Persistence

The stack uses named volumes for data persistence:

- `sandlabx-postgres-data` - PostgreSQL database
- `sandlabx-overlays` - QEMU VM overlays
- `sandlabx-backend-state` - Node state files

Data persists across container restarts but not across `docker-compose down -v`.

## 🔍 Health Checks

All services include health checks:

```bash
# Check health status
docker-compose ps

# Services show (healthy) when ready
```

Services start in order with health check dependencies:
1. PostgreSQL → Guacd
2. Guacamole (waits for PostgreSQL + Guacd)
3. Backend (waits for PostgreSQL + Guacamole)
4. Frontend (waits for Backend)

## 🌐 Networking

All services communicate on the `sandlabx-network` bridge network.

External access:
- Frontend: `localhost:3000`
- Backend API: `localhost:3001`
- Guacamole: `localhost:8081`
- PostgreSQL: `localhost:5432` (if needed)

## 🎯 Using the Application

1. Open http://localhost:3000
2. Click "Add Node" to create a VM
3. Click "Start" to boot the VM
4. Click "Connect" to access the console
5. Use "Stop", "Wipe", or "Delete" to manage nodes

## 🐛 Troubleshooting

### Containers not starting
```bash
# Check logs
docker-compose logs

# Restart from scratch
docker-compose down -v
docker-compose up -d
```

### Port conflicts
```bash
# Check what's using the ports
lsof -i :3000
lsof -i :3001
lsof -i :8081

# Change ports in docker-compose.yml if needed
```

### Health check failures
```bash
# Check individual service health
docker inspect sandlabx-backend | grep -A 10 Health
docker inspect sandlabx-frontend | grep -A 10 Health

# View detailed logs
docker-compose logs backend
```

### Database initialization issues
```bash
# Remove and recreate database
docker-compose down -v
docker-compose up -d postgres
# Wait 10 seconds
docker-compose up -d
```

## 📊 Resource Usage

Expected resource consumption:
- **CPU**: 2-4 cores recommended
- **RAM**: 2-4GB total
- **Disk**: ~5GB for containers + overlays
- **Network**: Bridge network (minimal overhead)

## 🔒 Security Notes

**⚠️ For development/demo use only!**

For production deployment:
- Change all default passwords
- Enable HTTPS/TLS
- Add authentication to APIs
- Configure firewall rules
- Use secrets management
- Enable audit logging

## 🚀 Production Deployment

For production use:

1. Update passwords in `docker-compose.yml`
2. Add SSL certificates
3. Configure reverse proxy (nginx/traefik)
4. Set up monitoring (Prometheus/Grafana)
5. Configure backups for volumes
6. Use production-grade PostgreSQL
7. Implement rate limiting
8. Add user authentication

## 📝 Environment Variables

Backend environment variables (configured in docker-compose.yml):

```yaml
PORT: 3001
NODE_ENV: production
DB_HOST: postgres
DB_PORT: 5432
DB_NAME: guacamole_db
DB_USER: guacamole
DB_PASSWORD: guacpass123
GUAC_BASE_URL: http://guacamole:8080/guacamole
BASE_IMAGE_PATH: /images/base.qcow2
OVERLAYS_PATH: /overlays
VNC_START_PORT: 5900
QEMU_RAM: 2048
QEMU_CPUS: 2
```

Frontend environment variables:

```yaml
NEXT_PUBLIC_API_URL: http://localhost:3001/api
NEXT_PUBLIC_GUACAMOLE_URL: http://localhost:8081/guacamole
NODE_ENV: production
```

## 🔄 Updates and Upgrades

To update the application:

```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

## 📚 Additional Documentation

- [Main README](./README.md) - Complete documentation
- [Quick Start](./QUICK-START.md) - Non-Docker setup
- [Backend Docs](./backend/README.md) - API documentation
- [Frontend Docs](./frontend/README.md) - UI documentation

## 💡 Tips

- Services start faster on subsequent runs (cached images)
- Use `--build` flag to force rebuild: `docker-compose up -d --build`
- View resource usage: `docker stats`
- Clean up unused resources: `docker system prune -a`

---

**Ready to deploy!** Run `docker-compose up -d` and you're done.
