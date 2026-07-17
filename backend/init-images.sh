#!/usr/bin/env bash
set -euo pipefail

# LEGACY IMAGE BOOTSTRAP
#
# This script predates ImagePipeline and scans a fixed hard-coded image set.
# It no longer runs during normal backend startup because qemu-img inspection
# and network downloads can delay or fail the API for images that are not used.
#
# Use only through `make image-init` for compatibility with old lab definitions.
# All new image discovery/import/download/install workflows must use ImagePipeline,
# manifests, the catalog, and asynchronous operation tracking.
#
# Removal condition: legacy node definitions no longer reference these filenames.

IMAGES_DIR="${IMAGES_DIR:-/images}"
AUTO_DOWNLOAD="${AUTO_DOWNLOAD_IMAGES:-false}"

declare -A IMAGES
IMAGES["ubuntu-24-lts.qcow2"]="https://cloud-images.ubuntu.com/noble/current/noble-server-cloudimg-amd64.img"
IMAGES["alpine-3.qcow2"]="https://dl-cdn.alpinelinux.org/alpine/v3.19/releases/cloud/nocloud_alpine-3.19.1-x86_64-uefi-cloudinit-r0.qcow2"
IMAGES["debian-13.qcow2"]="https://cloud.debian.org/images/cloud/bookworm/latest/debian-12-generic-amd64.qcow2"

mkdir -p "${IMAGES_DIR}"

echo "LEGACY image check in ${IMAGES_DIR}"
echo "AUTO_DOWNLOAD_IMAGES=${AUTO_DOWNLOAD}"

download_image() {
  local filename="$1"
  local url="$2"
  local filepath="${IMAGES_DIR}/${filename}"
  local tmp_path="${filepath}.tmp"

  echo "Downloading ${filename}"
  echo "Source: ${url}"

  rm -f "${tmp_path}"

  if command -v wget >/dev/null 2>&1; then
    wget -O "${tmp_path}" "${url}"
  else
    curl -fSL "${url}" -o "${tmp_path}"
  fi

  if qemu-img info "${tmp_path}" >/dev/null 2>&1; then
    mv "${tmp_path}" "${filepath}"
    echo "Downloaded and verified: ${filename}"
  else
    rm -f "${tmp_path}"
    echo "Downloaded file is not a valid QEMU image: ${filename}" >&2
    return 1
  fi
}

for image in "${!IMAGES[@]}"; do
  filepath="${IMAGES_DIR}/${image}"

  if [ -f "${filepath}" ]; then
    if qemu-img info "${filepath}" >/dev/null 2>&1; then
      echo "Found valid image: ${image}"
      continue
    fi

    quarantine_path="${filepath}.invalid.$(date -u +%Y%m%dT%H%M%SZ)"
    echo "Invalid or unreadable image found: ${image}" >&2
    echo "Quarantining it at: ${quarantine_path}" >&2
    mv "${filepath}" "${quarantine_path}"
  fi

  echo "Missing image: ${image}"

  if [ "${AUTO_DOWNLOAD}" = "true" ]; then
    download_image "${image}" "${IMAGES[${image}]}" || {
      echo "Warning: failed to download ${image}; VMs using this image will fail to start."
    }
  else
    echo "Auto-download disabled. Set AUTO_DOWNLOAD_IMAGES=true only for an explicit make image-init run."
    echo "Manual URL: ${IMAGES[${image}]}"
  fi
done

echo "LEGACY image initialization complete."
