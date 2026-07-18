'use strict';

const { checksum } = require('../modules/imagePipeline');

const DIGEST = /^sha256:[a-f0-9]{64}$/;

class ImageArtifactService {
  constructor({ repository, pipeline, capacity }) {
    if (!repository) throw new TypeError('repository is required');
    this.repository = repository;
    this.pipeline = pipeline;
    this.capacity = capacity;
  }

  async publish(input, client) {
    validateImage(input);
    return immutable(await this.repository.createVersion({
      name: input.name, digest: input.digest, format: input.format, storagePath: input.storagePath,
      sizeBytes: input.sizeBytes, virtualSizeBytes: input.virtualSizeBytes || null,
      architecture: input.architecture || null, provenance: structuredClone(input.provenance), metadata: structuredClone(input.metadata || {}),
    }, client));
  }

  async resolveImageVersion(imageVersionId, client) {
    const image = await this.repository.getVersion(imageVersionId, client);
    if (!image) throw codeError('Image version not found', 'IMAGE_VERSION_NOT_FOUND');
    return immutable(image);
  }

  async listImageVersions(client) { return Object.freeze((await this.repository.listVersions(client)).map(immutable)); }

  assertImageCompatibility(image, profile, hostCapabilities = {}) {
    if (!profile.supportedImage?.formats?.includes(image.format) || (image.architecture && !profile.supportedImage?.architectures?.includes(image.architecture))) throw codeError('Image is not compatible with workload profile', 'IMAGE_PROFILE_INCOMPATIBLE');
    if (profile.architecture !== hostCapabilities.architecture) throw codeError('Host architecture does not support workload profile', 'HOST_CAPABILITY_UNSUPPORTED');
    const accelerations = Array.isArray(hostCapabilities.acceleration) ? hostCapabilities.acceleration : [hostCapabilities.acceleration].filter(Boolean);
    if ((profile.acceleration || []).some(item => !accelerations.includes(item))) throw codeError('Host acceleration does not support workload profile', 'HOST_CAPABILITY_UNSUPPORTED');
    return true;
  }

  async capture({ instance, node, ownerId, name, displayName, metadata = {} }, client) {
    if (instance?.state !== 'STOPPED') throw codeError('Image capture requires a stopped instance', 'INSTANCE_NOT_STOPPED');
    if (!node?.overlayPath || instance.ownerId !== ownerId || node.ownerId !== ownerId) throw codeError('Capture overlay is not owned by the requester', 'OVERLAY_NOT_OWNED');
    if (!this.pipeline) throw codeError('Image pipeline is unavailable', 'IMAGE_PIPELINE_UNAVAILABLE');
    const overlay = await this.pipeline.validate(node.overlayPath, { requireQcow2: true, allowBackingFile: true });
    if (!overlay.valid) throw codeError(`Capture source is invalid: ${overlay.errors.join('; ')}`, 'CAPTURE_SOURCE_INVALID');
    if (this.capacity?.assertCanStore) await this.capacity.assertCanStore(overlay.actualSize || overlay.fileSize, client);
    const manifest = await this.pipeline.import(node.overlayPath, { name, displayName, source: node.overlayPath, overwrite: false });
    return this.publish({
      name: manifest.id, digest: `sha256:${await checksum(this.pipeline.managedPath(manifest.id))}`, format: 'qcow2', storagePath: this.pipeline.managedPath(manifest.id),
      sizeBytes: manifest.sizeBytes, virtualSizeBytes: manifest.virtualSize, metadata,
      provenance: { kind: 'CAPTURE', sourceInstanceId: instance.id, sourceNodeId: node.id },
    }, client);
  }
}

function validateImage(input) {
  if (!input || typeof input !== 'object' || !input.name || !DIGEST.test(input.digest || '') || input.format !== 'qcow2' || !input.storagePath || !Number.isSafeInteger(input.sizeBytes) || input.sizeBytes < 0 || !input.provenance || typeof input.provenance !== 'object') throw codeError('Image version requires a name, SHA-256 digest, QCOW2 storage, size, and provenance', 'INVALID_IMAGE_ARTIFACT');
}
function immutable(value) { return Object.freeze(structuredClone(value)); }
function codeError(message, code, details) { return Object.assign(new Error(message), { code, details }); }

module.exports = { ImageArtifactService };
