/**
 * global-api/routes.js
 *
 * Express router for the Global Credential Verification API.
 * Mounts two public routes — no authentication required.
 * Intended for external systems: HR portals, universities, recruiters.
 *
 * Routes:
 *   GET /api/v1/verify/:txId          — verify by Algorand transaction ID
 *   GET /api/v1/credential/:credentialId — fetch public credential metadata
 *
 * Usage in index.js:
 *   const globalApiRouter = require('./global-api/routes');
 *   app.use('/api/v1', globalApiRouter);
 */

const express = require('express');
const router  = express.Router();
const { verifyByTxId, getCredentialById } = require('./controller');

// ── GET /api/v1/verify/:txId ──────────────────────────────────────────────────
// Verify a credential by its Algorand transaction ID.
// Public — no auth required.
// See controller.verifyByTxId and service.verifyCredentialByTxId for full flow.
router.get('/verify/:txId', verifyByTxId);

// ── GET /api/v1/credential/:credentialId ─────────────────────────────────────
// Fetch public-safe credential metadata by verificationId (UUID).
// Public — no auth required.
// See controller.getCredentialById and service.getCredentialPublic for full flow.
router.get('/credential/:credentialId', getCredentialById);

module.exports = router;
