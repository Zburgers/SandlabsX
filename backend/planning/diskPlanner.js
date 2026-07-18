'use strict';
const path = require('node:path');
function planDisks(capsule, instanceId, imageVersions, overlaysRoot) {
  return Object.entries(capsule.nodes).map(([nodeId, node]) => {
    const image = imageVersions[node.image];
    return { nodeId, imageVersionId: image.id, digest: image.digest, baseImage: image.storagePath, format: image.format, overlayPath: path.join(overlaysRoot, instanceId, `${nodeId}.qcow2`), sizeGiB: node.resources.diskGiB, action: 'createOverlay' };
  }).sort((a, b) => a.nodeId.localeCompare(b.nodeId));
}
module.exports = { planDisks };
