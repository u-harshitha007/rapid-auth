/**
 * global-api/controller.js
 *
 * HTTP request/response handlers for the Global Verification API.
 * Controllers are thin — they extract params, call service functions,
 * and send the response. No business logic lives here.
 *
 * Exports:
 *   verifyByTxId(req, res)       — handles GET /api/v1/verify/:txId
 *   getCredentialById(req, res)  — handles GET /api/v1/credential/:credentialId
 */

const { verifyCredentialByTxId, getCredentialPublic } = require('./service');

// ── verifyByTxId ──────────────────────────────────────────────────────────────
/**
 * Handle GET /api/v1/verify/:txId
 *
 * Extracts txId from URL params, delegates to service,
 * logs the verification attempt, and sends the response.
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 */
async function verifyByTxId(req, res) {
    const { txId } = req.params;

    // db and store are attached to app by index.js when the router is mounted
    const db    = req.app.locals.firestoreDb;  // Firestore instance or null
    const store = req.app.locals.credentials;  // in-memory fallback object

    const { status, body } = await verifyCredentialByTxId(txId, db, store);

    // Log every external verification attempt to the shared audit log
    if (req.app.locals.addAudit) {
        const outcome = body.verified ? 'VERIFIED' : `REJECTED:${body.status || body.code}`;
        req.app.locals.addAudit(
            'EXTERNAL_VERIFY',
            `txId=${txId} → ${outcome}`
        );
    }

    res.status(status).json(body);
}

// ── getCredentialById ─────────────────────────────────────────────────────────
/**
 * Handle GET /api/v1/credential/:credentialId
 *
 * Extracts credentialId from URL params, delegates to service,
 * and sends the response.
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 */
async function getCredentialById(req, res) {
    const { credentialId } = req.params;

    const db    = req.app.locals.firestoreDb;
    const store = req.app.locals.credentials;

    const { status, body } = await getCredentialPublic(credentialId, db, store);

    res.status(status).json(body);
}

module.exports = { verifyByTxId, getCredentialById };
