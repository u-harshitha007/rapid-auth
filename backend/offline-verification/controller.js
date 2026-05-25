/**
 * offline-verification/controller.js
 *
 * HTTP handlers for the Offline Verification module.
 * Thin layer — extracts params, calls service, sends response.
 * No business logic here.
 *
 * Exports:
 *   generateProof(req, res)  — POST /api/v1/offline/proof/:credentialId
 *   verifyProof(req, res)    — POST /api/v1/offline/verify
 */

const { generateOfflineProof, verifyOfflineProof } = require('./service');

// ── generateProof ─────────────────────────────────────────────────────────────
/**
 * Handle POST /api/v1/offline/proof/:credentialId
 *
 * Student requests a signed offline proof token for a credential.
 * The token is returned as both a JSON object and a base64 string
 * (base64 is used for QR code / magic link embedding).
 *
 * Optional body: { ttlMs: number } — custom TTL in milliseconds
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 */
async function generateProof(req, res) {
    const { credentialId } = req.params;
    const ttlMs = req.body?.ttlMs || undefined; // optional custom TTL

    // db and store are set on app.locals by index.js
    const db    = req.app.locals.firestoreDb;
    const store = req.app.locals.credentials;

    const { status, body } = await generateOfflineProof(credentialId, db, store, ttlMs);
    res.status(status).json(body);
}

// ── verifyProof ───────────────────────────────────────────────────────────────
/**
 * Handle POST /api/v1/offline/verify
 *
 * Recruiter/verifier submits a proof token (from QR scan or magic link).
 * Verification is done locally — no blockchain call required.
 * Algorand is checked additionally if internet is available.
 *
 * Body: { token: <object or base64 string> }
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 */
async function verifyProof(req, res) {
    const { token } = req.body || {};

    if (!token) {
        return res.status(400).json({ error: 'token is required in request body', code: 'MISSING_TOKEN' });
    }

    const { status, body } = await verifyOfflineProof(token);

    // Log to shared audit trail if available
    if (req.app.locals.addAudit) {
        const outcome = body.verified ? 'OFFLINE_VERIFIED' : `OFFLINE_REJECTED:${body.status}`;
        req.app.locals.addAudit('OFFLINE_VERIFY', `credId=${body.credentialId} → ${outcome}`);
    }

    res.status(status).json(body);
}

module.exports = { generateProof, verifyProof };
