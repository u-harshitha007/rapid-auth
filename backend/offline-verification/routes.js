/**
 * offline-verification/routes.js
 *
 * Express router for the Offline Verification module.
 * Mounted at /api/v1/offline in index.js.
 *
 * Routes:
 *   POST /api/v1/offline/proof/:credentialId
 *     — Student generates a signed offline proof token
 *     — Token is embedded in QR code or magic link
 *
 *   POST /api/v1/offline/verify
 *     — Recruiter/verifier submits a proof token for local verification
 *     — Works without internet; optionally confirms on Algorand if available
 *
 * Usage in index.js:
 *   app.use('/api/v1/offline', require('./offline-verification/routes'));
 */

const express = require('express');
const router  = express.Router();
const { generateProof, verifyProof } = require('./controller');

// Generate a signed offline proof token for a credential
// Called by the student before sharing via QR or magic link
router.post('/proof/:credentialId', generateProof);

// Verify a proof token submitted by a recruiter/verifier
// Works offline — local signature check + optional Algorand confirmation
router.post('/verify', verifyProof);

module.exports = router;
