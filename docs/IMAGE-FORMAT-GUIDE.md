# QCOW2 Image Format Guide

## Overview

SandLabX uses QCOW2 (QEMU Copy-On-Write version 2) as the standard format for virtual machine disk images. This guide covers image format validation, conversion, and troubleshooting.

## Supported Formats

The backend now automatically converts the following formats to QCOW2:

- **QCOW2** - Native format (no conversion needed)
- **VMDK** - VMware virtual disk format
- **VDI** - VirtualBox disk image
- **VHDX** - Microsoft Hyper-V format
- **RAW/IMG** - Raw disk images
- **ISO** - Optical disc images (for installation media)

## What Was Fixed

### Original Issue

When uploading custom images, the system was encountering this error:
```
Error: Failed to create overlay: Command failed: qemu-img create -f qcow2 -b /images/custom/router_1762805489189.qcow2 -F qcow2 /overlays/node_xxx.qcow2
qemu-img: Image is not in qcow2 format
Could not open backing image.
```

### Root Cause

The uploaded file was actually a **VMDK (VMware) format** despite having a `.qcow2` extension. QEMU cannot create overlays from VMDK base images directly.

### Solution Implemented

1. **Auto-Detection**: Backend now detects the actual format using `qemu-img info`
2. **Auto-Conversion**: Non-QCOW2 formats are automatically converted
3. **Format Validation**: All images are verified before use
4. **Multi-Format Upload**: Frontend now accepts multiple disk image formats

## Manual Conversion Commands

### Check Image Format

```bash
# Basic format check
file /path/to/image.qcow2

# Detailed QEMU info
qemu-img info /path/to/image.qcow2

# JSON output for parsing
qemu-img info --output=json /path/to/image.qcow2
```

### Convert VMDK to QCOW2

```bash
qemu-img convert -f vmdk -O qcow2 input.vmdk output.qcow2
```

### Convert VDI to QCOW2

```bash
qemu-img convert -f vdi -O qcow2 input.vdi output.qcow2
```

### Convert VHDX to QCOW2

```bash
qemu-img convert -f vhdx -O qcow2 input.vhdx output.qcow2
```

### Convert RAW/IMG to QCOW2

```bash
qemu-img convert -f raw -O qcow2 input.img output.qcow2
```

## Router Image Verification

Your Cisco IOSv router image has been successfully converted:

```bash
# Location: /home/naki/Desktop/itsthatnewshit/sandboxlabs/images/router.qcow2
# Format: QCOW2
# Virtual Size: 2 GiB
# Disk Size: 122 MiB
# Status: ✅ Verified and bootable
```

### Boot Test Results

The router image successfully boots and shows:
- SeaBIOS initialization
- iPXE network boot option
- GRUB bootloader
- **Cisco IOSv** menu

## Testing Image Compatibility

### Create Test Overlay

```bash
qemu-img create -f qcow2 \
  -b /path/to/base/image.qcow2 \
  -F qcow2 \
  /tmp/test_overlay.qcow2
```

### Boot Test

```bash
timeout 10 qemu-system-x86_64 \
  -hda /tmp/test_overlay.qcow2 \
  -m 512 \
  -smp 1 \
  -nographic \
  -serial mon:stdio \
  -boot c
```

### Cleanup

```bash
rm /tmp/test_overlay.qcow2
```

## Application Workflow

### Upload Process (Automated)

1. User uploads disk image via web interface
2. Backend receives file (any supported format)
3. Format detection: `qemu-img info --output=json`
4. If not QCOW2: Auto-convert with progress logging
5. Verify conversion success
6. Delete original if conversion created new file
7. Register image in catalog

### Node Creation Process

1. User selects image (custom or pre-configured)
2. Backend resolves image path
3. **Verify QCOW2 format** ✅ (prevents overlay errors)
4. Create overlay: `qemu-img create -f qcow2 -b <base> -F qcow2 <overlay>`
5. Launch QEMU with overlay as HDA
6. Connect VNC/Serial console

## Troubleshooting

### Error: "Image is not in qcow2 format"

**Cause**: Base image is not in QCOW2 format

**Solution**:
```bash
# Check actual format
qemu-img info /path/to/image.qcow2

# Convert if needed
qemu-img convert -f <detected_format> -O qcow2 input.img output.qcow2
```

### Error: "Could not open backing image"

**Cause**: Incorrect path or permissions

**Solution**:
```bash
# Use absolute paths for base images
qemu-img create -f qcow2 \
  -b "$(pwd)/images/base.qcow2" \
  -F qcow2 overlay.qcow2

# Check permissions
chmod 644 base.qcow2
```

### Error: "File too large"

**Cause**: Image exceeds 20GB upload limit

**Solution**:
- Compress image: `qemu-img convert -c -O qcow2 input.qcow2 output.qcow2`
- Or increase limit in `backend/server.js`: `limits.fileSize`

## Best Practices

### Image Preparation

1. **Always verify format** before uploading
2. **Use QCOW2 native format** when possible for best performance
3. **Enable compression** for large images: `qemu-img convert -c`
4. **Test boot** before production use

### Naming Conventions

```
<os-type>-<version>-<variant>.qcow2

Examples:
- ubuntu-24-lts.qcow2
- cisco-iosv-15.6.qcow2
- alpine-3.18-virt.qcow2
- openwrt-23.05-x86.qcow2
```

### Storage Optimization

```bash
# Check actual disk usage
qemu-img info image.qcow2 | grep "disk size"

# Compress existing QCOW2
qemu-img convert -c -O qcow2 input.qcow2 output.qcow2

# Reclaim unused space
qemu-img convert -O qcow2 dirty.qcow2 clean.qcow2
```

## Performance Tips

### Faster Conversion

```bash
# Use higher compression for storage
qemu-img convert -c -O qcow2 input.img output.qcow2

# Use no compression for speed
qemu-img convert -O qcow2 -o compression_type=zlib input.img output.qcow2

# Parallel I/O (if available)
qemu-img convert -m 4 -O qcow2 input.img output.qcow2
```

### Overlay Performance

- Overlays inherit base image format automatically
- Keep base images on fast storage (SSD recommended)
- Limit overlay depth (max 2-3 layers)

## Updated Code References

### Backend Changes

**File**: `backend/server.js`
- Multi-format upload support
- Auto-conversion on upload
- Cleanup on error

**File**: `backend/modules/qemuManager.js`
- New method: `ensureQcow2Format(imagePath)`
- Format detection with JSON parsing
- Conversion with verification

### Testing Your Changes

```bash
# Restart backend
cd backend
npm start

# Test upload
curl -X POST http://localhost:3001/api/images/custom \
  -F "image=@/path/to/test.vmdk"

# Response should show successful conversion
```

## Summary

✅ **Fixed**: VMDK images now auto-convert to QCOW2
✅ **Verified**: Router image boots successfully  
✅ **Tested**: Overlay creation works correctly
✅ **Automated**: No manual conversion needed
✅ **Multi-format**: VMDK, VDI, VHDX, RAW all supported

The router image is ready to use in SandLabX!
