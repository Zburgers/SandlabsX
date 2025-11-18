#!/bin/bash
set -euo pipefail

IMAGES_DIR="/images"
AUTO_DOWNLOAD=${AUTO_DOWNLOAD_IMAGES:-"false"}

declare -A IMAGES
IMAGES[ubuntu-24-lts.qcow2]="https://cloud-images.ubuntu.com/releases/24.04/release/ubuntu-24.04-server-cloudimg-amd64.img"
IMAGES[alpine-3.qcow2]="https://dl-cdn.alpinelinux.org/alpine/latest-stable/releases/x86_64/alpine-standard-3.18.0-x86_64.iso"
IMAGES[debian-13.qcow2]="https://cdimage.debian.org/cdimage/cloud/bullseye/latest/debian-10-openstack-amd64.qcow2"

mkdir -p "$IMAGES_DIR"

if [ "$AUTO_DOWNLOAD" != "true" ]; then
  echo "Auto-download disabled (AUTO_DOWNLOAD_IMAGES != true). Skipping image download."
  exit 0
fi

echo "Auto-download enabled. Ensuring base images exist in $IMAGES_DIR"

for name in "${!IMAGES[@]}"; do
  dest="$IMAGES_DIR/$name"
  url="${IMAGES[$name]}"
  if [ -f "$dest" ]; then
    echo " - Exists: $dest"
    continue
  fi

  echo " - Downloading $name from $url"
  # Use wget/curl fallback
  if command -v wget >/dev/null 2>&1; then
    wget -O "$dest" "$url" || { echo "Failed to download $url"; rm -f "$dest"; exit 1; }
  else
    curl -fSL "$url" -o "$dest" || { echo "Failed to download $url"; rm -f "$dest"; exit 1; }
  fi

  echo "   Downloaded: $dest"
done

echo "All requested images are present."

exit 0
#!/bin/bash

# init-images.sh - Initialize base VM images for SandlabX
# This script downloads cloud-init ready base images if they don't exist

set -e

IMAGES_DIR="/images"
DOWNLOAD_ENABLED=${AUTO_DOWNLOAD_IMAGES:-"true"}

echo "🔍 Checking for base VM images in ${IMAGES_DIR}..."

# Create images directory if it doesn't exist
mkdir -p "${IMAGES_DIR}"

# Base image definitions
declare -A IMAGES=(
    ["ubuntu-24-lts.qcow2"]="https://cloud-images.ubuntu.com/noble/current/noble-server-cloudimg-amd64.img"
    ["alpine-3.qcow2"]="https://dl-cdn.alpinelinux.org/alpine/v3.19/releases/cloud/nocloud_alpine-3.19.1-x86_64-uefi-cloudinit-r0.qcow2"
    ["debian-13.qcow2"]="https://cloud.debian.org/images/cloud/bookworm/latest/debian-12-generic-amd64.qcow2"
)

# Function to download and verify image
download_image() {
    local filename=$1
    local url=$2
    local filepath="${IMAGES_DIR}/${filename}"
    
    echo "📥 Downloading ${filename}..."
    echo "   URL: ${url}"
    
    # Download with progress
    if wget -q --show-progress -O "${filepath}.tmp" "${url}"; then
        mv "${filepath}.tmp" "${filepath}"
        echo "✅ Downloaded: ${filename}"
        
        # Verify it's a valid qcow2 image
        if qemu-img info "${filepath}" > /dev/null 2>&1; then
            echo "✅ Verified: ${filename} is a valid QCOW2 image"
            return 0
        else
            echo "❌ Invalid image format, removing..."
            rm -f "${filepath}"
            return 1
        fi
    else
        echo "❌ Failed to download ${filename}"
        rm -f "${filepath}.tmp"
        return 1
    fi
}

# Check each base image
missing_images=()
for image in "${!IMAGES[@]}"; do
    filepath="${IMAGES_DIR}/${image}"
    
    if [ -f "${filepath}" ]; then
        echo "✅ Found: ${image}"
        
        # Verify it's a valid image
        if qemu-img info "${filepath}" > /dev/null 2>&1; then
            size=$(qemu-img info "${filepath}" | grep "virtual size" | awk '{print $3, $4}')
            echo "   Size: ${size}"
        else
            echo "⚠️  Invalid or corrupted: ${image}"
            missing_images+=("${image}")
        fi
    else
        echo "❌ Missing: ${image}"
        missing_images+=("${image}")
    fi
done

# Download missing images if auto-download is enabled
if [ ${#missing_images[@]} -gt 0 ]; then
    if [ "${DOWNLOAD_ENABLED}" = "true" ]; then
        echo ""
        echo "🚀 Auto-download enabled. Downloading missing images..."
        echo ""
        
        for image in "${missing_images[@]}"; do
            url="${IMAGES[${image}]}"
            if [ -n "${url}" ]; then
                download_image "${image}" "${url}" || echo "⚠️  Failed to download ${image}, continuing..."
            fi
        done
    else
        echo ""
        echo "⚠️  Auto-download is disabled (AUTO_DOWNLOAD_IMAGES=false)"
        echo "   Missing images:"
        for image in "${missing_images[@]}"; do
            echo "   - ${image}"
            echo "     URL: ${IMAGES[${image}]}"
        done
        echo ""
        echo "   To enable auto-download, set AUTO_DOWNLOAD_IMAGES=true"
        echo "   Or manually download images to: ${IMAGES_DIR}"
    fi
fi

echo ""
echo "📊 Image Status Summary:"
echo "----------------------"
for image in "${!IMAGES[@]}"; do
    filepath="${IMAGES_DIR}/${image}"
    if [ -f "${filepath}" ]; then
        echo "✅ ${image}"
    else
        echo "❌ ${image} (VMs with this OS will fail to start)"
    fi
done
echo ""

# Continue even if some images are missing
echo "✅ Image initialization complete"
exit 0
