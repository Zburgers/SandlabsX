# VM Base Images Guide

This directory contains the base QCOW2 images used to create virtual machines in SandBoxLabs.

## Quick Setup

### Method 1: Download Pre-converted Cloud Images (Recommended)

Cloud images are pre-installed and ready to use:

```bash
# Create directory
mkdir -p images
cd images

# Ubuntu 24.04 LTS (Recommended)
wget https://cloud-images.ubuntu.com/noble/current/noble-server-cloudimg-amd64.img \
  -O ubuntu-24-lts.qcow2

# Alpine Linux 3.19 (Lightweight)
wget https://dl-cdn.alpinelinux.org/alpine/v3.19/releases/cloud/nocloud_alpine-3.19.1-x86_64-uefi-cloudinit-r0.qcow2 \
  -O alpine-3.qcow2

# Debian 12 Bookworm
wget https://cloud.debian.org/images/cloud/bookworm/latest/debian-12-generic-amd64.qcow2 \
  -O debian-13.qcow2
```

### Method 2: Convert from Existing VMs

If you have existing VMs in VirtualBox, VMware, or other formats:

```bash
# From VirtualBox VDI
qemu-img convert -f vdi -O qcow2 source.vdi ubuntu-24-lts.qcow2

# From VMware VMDK
qemu-img convert -f vmdk -O qcow2 source.vmdk ubuntu-24-lts.qcow2

# From RAW/IMG
qemu-img convert -f raw -O qcow2 source.img ubuntu-24-lts.qcow2
```

## Required Filenames

| OS Type | Filename | Download |
|---------|----------|----------|
| **ubuntu** | `ubuntu-24-lts.qcow2` | [Ubuntu Cloud Images](https://cloud-images.ubuntu.com/) |
| **alpine** | `alpine-3.qcow2` | [Alpine Cloud](https://alpinelinux.org/cloud/) |
| **debian** | `debian-13.qcow2` | [Debian Cloud](https://cloud.debian.org/images/cloud/) |

## Verify Images

```bash
# Check format
qemu-img info ubuntu-24-lts.qcow2

# List all images
ls -lh *.qcow2
```

For detailed instructions on creating, converting, and optimizing images, see the main [README.md](../README.md#base-vm-images-setup).
