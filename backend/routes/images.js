'use strict';

const express = require('express');

function createImageRouter({ imageArtifacts, workloadProfiles }) {
  if (!imageArtifacts || !workloadProfiles) throw new TypeError('imageArtifacts and workloadProfiles are required');
  const router = express.Router();

  router.get('/versions', async (req, res) => {
    try {
      const images = await imageArtifacts.listImageVersions();
      return res.json({ success: true, images: images.map(browserImage) });
    } catch (error) { return sendError(res, error); }
  });

  router.get('/profiles/versions', async (req, res) => {
    try { return res.json({ success: true, profiles: await workloadProfiles.listWorkloadProfileVersions() }); }
    catch (error) { return sendError(res, error); }
  });

  router.get('/versions/:id', async (req, res) => {
    try { return res.json({ success: true, image: await imageArtifacts.resolveImageVersion(req.params.id) }); }
    catch (error) { return sendError(res, error); }
  });

  router.get('/profiles/versions/:id', async (req, res) => {
    try { return res.json({ success: true, profile: await workloadProfiles.resolveWorkloadProfileVersion(req.params.id) }); }
    catch (error) { return sendError(res, error); }
  });

  router.post('/profiles/validate', (req, res) => {
    const result = workloadProfiles.validate(req.body?.profile);
    return res.status(result.valid ? 200 : 422).json({ success: result.valid, ...result });
  });

  return router;
}

function browserImage(image) {
  const { storagePath: _storagePath, provenance: _provenance, ...safe } = image;
  return safe;
}

function sendError(res, error) {
  const status = error.code?.endsWith('_NOT_FOUND') ? 404 : error.code?.startsWith('INVALID_') ? 422 : 500;
  return res.status(status).json({ success: false, code: error.code || 'INTERNAL_ERROR', error: error.message, details: error.details });
}

module.exports = { browserImage, createImageRouter };
