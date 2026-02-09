# Automatic Base Image Download Feature

## Overview

The backend container now **automatically downloads base VM images** on startup if they don't exist. This eliminates manual setup steps and makes the system ready to use immediately.

## What Changed

### 1. Backend Dockerfile (`backend/Dockerfile`)

**Added:**
- QEMU tools (`qemu-system-x86_64`, `qemu-img`)
- System utilities (`curl`, `wget`, `bash`)
- Image initialization script (`init-images.sh`)

**Before:**
```dockerfile
FROM node:18-alpine
# No QEMU tools
CMD ["node", "server.js"]
```

**After:**
```dockerfile
FROM node:18-alpine
RUN apk add --no-cache qemu-system-x86_64 qemu-img curl wget bash
COPY init-images.sh /usr/local/bin/init-images.sh
CMD ["/bin/bash", "-c", "/usr/local/bin/init-images.sh && node server.js"]
```

### 2. Image Initialization Script (`backend/init-images.sh`)

**New file** that runs before the Node.js server starts:

```bash
#!/bin/bash
# Checks for missing base images
# Downloads from official sources if AUTO_DOWNLOAD_IMAGES=true
# Verifies image integrity with qemu-img
```

**Supported Images:**
- Ubuntu 24.04 LTS: https://cloud-images.ubuntu.com/noble/current/noble-server-cloudimg-amd64.img
- Alpine 3.19: https://dl-cdn.alpinelinux.org/alpine/v3.19/releases/cloud/nocloud_alpine-3.19.1-x86_64-uefi-cloudinit-r0.qcow2
- Debian 12: https://cloud.debian.org/images/cloud/bookworm/latest/debian-12-generic-amd64.qcow2

### 3. Docker Compose (`docker-compose.yml`)

**Changed:**
- `/images` volume: `ro` → `rw` (read-write access)
- Added environment variable: `AUTO_DOWNLOAD_IMAGES=true`

**Before:**
```yaml
volumes:
  - ./images:/images:ro  # Read-only
```

**After:**
```yaml
environment:
  AUTO_DOWNLOAD_IMAGES: "true"
volumes:
  - ./images:/images:rw  # Read-write
```

### 4. Documentation

**Added:**
- `images/README.md` - Complete guide for base images
- `AUTO-DOWNLOAD-IMAGES.md` - This file
- Updated main README.md with auto-download section

## How It Works

### Startup Sequence

1. **Container starts** → `init-images.sh` runs first
2. **Check images** → Scans `/images` directory
3. **Download missing** → If `AUTO_DOWNLOAD_IMAGES=true`, downloads from official sources
4. **Verify integrity** → Uses `qemu-img info` to validate
5. **Continue** → Starts Node.js server regardless of download success
6. **Server ready** → Backend API available on port 3001

### Console Output

When you run `docker compose up`, you'll see:

```
sandlabx-backend | 🔍 Checking for base VM images in /images...
sandlabx-backend | ✅ Found: ubuntu-24-lts.qcow2
sandlabx-backend | ❌ Missing: alpine-3.qcow2
sandlabx-backend | ❌ Missing: debian-13.qcow2
sandlabx-backend | 
sandlabx-backend | 🚀 Auto-download enabled. Downloading missing images...
sandlabx-backend | 
sandlabx-backend | 📥 Downloading alpine-3.qcow2...
sandlabx-backend |    URL: https://dl-cdn.alpinelinux.org/alpine/...
sandlabx-backend | alpine-3.qcow2   100%[========>]  98.5M  5.2MB/s    in 19s
sandlabx-backend | ✅ Downloaded: alpine-3.qcow2
sandlabx-backend | ✅ Verified: alpine-3.qcow2 is a valid QCOW2 image
sandlabx-backend | 
sandlabx-backend | 📊 Image Status Summary:
sandlabx-backend | ✅ ubuntu-24-lts.qcow2
sandlabx-backend | ✅ alpine-3.qcow2
sandlabx-backend | ❌ debian-13.qcow2 (VMs with this OS will fail to start)
sandlabx-backend | 
sandlabx-backend | ✅ Image initialization complete
sandlabx-backend | 🖥️  Initializing QemuManager...
sandlabx-backend | ✅ Overlays directory: /overlays
sandlabx-backend | ✅ QEMU tools found
sandlabx-backend | 🚀 Server listening on http://localhost:3001
```

## Configuration

### Enable/Disable Auto-Download

Edit `docker-compose.yml`:

```yaml
backend:
  environment:
    # Enable automatic downloads (default)
    AUTO_DOWNLOAD_IMAGES: "true"
    
    # OR disable for manual control
    # AUTO_DOWNLOAD_IMAGES: "false"
```

### Custom Image Sources

Edit `backend/init-images.sh` to add your own image sources:

```bash
declare -A IMAGES=(
    ["ubuntu-24-lts.qcow2"]="https://your-mirror.com/ubuntu.qcow2"
    ["alpine-3.qcow2"]="https://your-mirror.com/alpine.qcow2"
    ["custom-os.qcow2"]="https://your-server.com/custom.qcow2"
)
```

## Benefits

✅ **Zero manual setup** - Just run `docker compose up`
✅ **Automatic validation** - Images are verified after download
✅ **Flexible** - Can be disabled for manual control
✅ **Persistent** - Downloaded images are saved to host
✅ **Efficient** - Only downloads missing images
✅ **Safe** - Server continues even if some downloads fail

## Troubleshooting

### Download Fails

**Problem:** Network issues, wrong URLs, etc.

**Solution:** 
```bash
# Check logs
docker logs sandlabx-backend

# Manually download to ./images/
wget <url> -O ./images/ubuntu-24-lts.qcow2

# Restart container
docker compose restart backend
```

### Image Verification Fails

**Problem:** Corrupted download

**Solution:**
```bash
# Delete corrupted image
rm ./images/ubuntu-24-lts.qcow2

# Restart to re-download
docker compose restart backend
```

### Permission Denied

**Problem:** Container can't write to `/images`

**Solution:**
```bash
# Fix permissions on host
chmod 777 ./images/

# Or change ownership
sudo chown -R $(id -u):$(id -g) ./images/
```

### QEMU Tools Not Found

**Problem:** Old Docker image without QEMU

**Solution:**
```bash
# Rebuild backend container
docker compose build backend

# Restart
docker compose up -d backend
```

## Manual Override

If you want full control:

1. **Disable auto-download:**
   ```yaml
   AUTO_DOWNLOAD_IMAGES: "false"
   ```

2. **Download manually:**
   ```bash
   cd images/
   wget <url> -O ubuntu-24-lts.qcow2
   ```

3. **Verify:**
   ```bash
   qemu-img info ubuntu-24-lts.qcow2
   ```

4. **Start container:**
   ```bash
   docker compose up -d
   ```

## Image Details

| Image | Size | OS | Use Case |
|-------|------|-----|---------|
| `ubuntu-24-lts.qcow2` | ~700MB | Ubuntu 24.04 LTS | General purpose, full features |
| `alpine-3.qcow2` | ~100MB | Alpine Linux 3.19 | Lightweight, minimal resources |
| `debian-13.qcow2` | ~600MB | Debian 12 Bookworm | Stable, enterprise-ready |

All images are:
- ✅ Cloud-init ready
- ✅ QCOW2 format
- ✅ Official sources
- ✅ Regularly updated

## Security Considerations

- Images downloaded over **HTTPS**
- Sources are **official distributions**
- **No checksum validation** currently (future improvement)
- Images stored on **host filesystem** (./images/)
- Container has **write access** to /images (rw mount)

## Future Improvements

- [ ] Add SHA256 checksum verification
- [ ] Support for custom image mirrors
- [ ] Parallel downloads for faster setup
- [ ] Image update notifications
- [ ] Download progress in API endpoint
- [ ] Web UI for image management
- [ ] Image size optimization

## Related Files

- `backend/Dockerfile` - Container setup with QEMU
- `backend/init-images.sh` - Download script
- `docker-compose.yml` - Service configuration
- `images/README.md` - Image documentation
- `backend/modules/qemuManager.js` - Uses base images

## Questions?

See the main [README.md](./README.md) or check logs:
```bash
docker logs sandlabx-backend
```
