# Managed image pipeline

The image pipeline provides one operational model for appliance disks, cloud images, and ISO installation targets.

## Storage

Managed images live in `images/custom` by default:

```text
custom/
├── appliance.qcow2
├── .manifests/appliance.json
├── .locks/appliance.lock
└── .staging/
```

The lock and staging directories are internal. Never attach VMs to files in `.staging`.

## Commands

### Host and QEMU checks

```bash
cd backend
npm run image:doctor
```

### Inspect and validate

```bash
npm run sandlabx -- image inspect /path/to/disk.vmdk
npm run sandlabx -- image validate /path/to/base.qcow2
```

Managed base images must be QCOW2, unencrypted, structurally valid, and independent of external backing files.

### Import

```bash
npm run sandlabx -- image import /path/to/disk.vmdk \
  --name firewall-1 \
  --display-name "Training Firewall" \
  --description "Prepared appliance image" \
  --tags firewall,training \
  --sha256 EXPECTED_HASH
```

The source is converted into a compressed standalone QCOW2 file and published through a staging file and atomic rename.

### Catalog pull

```bash
npm run sandlabx -- image pull ubuntu-24.04
```

Catalog entries live in `images/catalog.json`. Add SHA-256 values whenever a vendor provides stable release hashes.

### Compact and resize

```bash
npm run sandlabx -- image compact firewall-1
npm run sandlabx -- image resize firewall-1 40G
```

Resizing changes virtual disk capacity. The guest partition and filesystem must still be expanded inside the VM.

### ISO installer plan

```bash
npm run sandlabx -- image plan-install /isos/debian.iso \
  --name debian-desktop \
  --disk-size 40G \
  --cpus 4 \
  --memory 8192 \
  --vnc 5990 \
  --seed /isos/cloud-init-seed.iso
```

The planner emits exact `qemu-img` and `qemu-system-x86_64` argument arrays. A second seed ISO can carry unattended installation metadata for distributions that support it.

## Failure behavior

- A checksum mismatch publishes nothing.
- A conversion or validation failure publishes nothing.
- An interrupted import leaves only a removable staging file.
- Concurrent work on the same image fails with `LOCKED`.
- Existing images require `--overwrite`.
- ISO files must use the installer workflow.

## API integration target

The browser upload endpoint still uses legacy conversion methods. The next integration step is to call `ImagePipeline.import` from the upload route and expose job progress through WebSockets or server-sent events.
