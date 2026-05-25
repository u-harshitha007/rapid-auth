/**
 * offline-verification/utils.js
 *
 * Utility functions for the Offline Verification module.
 * Self-contained — no imports from index.js or global-api/.
 *
 * Exports:
 *   sha256(data)                  — SHA-256 hex digest (matches issuance hash)
 *   signPayload(payload, secret)  — HMAC-SHA256 signature for proof tokens
 *   verifySignature(payload, sig, secret) — verify a proof token signature
 *   buildProofToken(record, secret, ttlMs) — create a signed offline proof
 *   buildErrorResponse(code, msg) — standard error shape
 */

const crypto = require('crypto');

// ── SHA-256 ───────────────────────────────────────────────────────────────────
/**
 * SHA-256 of a JSON-serialised object.
 * Must match the same function in index.js so hashes are comparable.
 *
 * @param {object|string} data
 * @returns {string} hex digest
 */
function sha256(data) {
    return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

// ── HMAC-SHA256 signature ─────────────────────────────────────────────────────
/**
 * Sign a string payload with HMAC-SHA256 using the institution secret.
 * The same secret used in index.js for credential issuance.
 *
 * @param {string} payload  — string to sign (typically JSON.stringify of proof)
 * @param {string} secret   — HMAC key (INSTITUTION_SECRET env var)
 * @returns {string} hex signature
 */
function signPayload(payload, secret) {
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

// ── Signature verification ────────────────────────────────────────────────────
/**
 * Verify that a signature matches the payload.
 * Uses timing-safe comparison to prevent timing attacks.
 *
 * @param {string} payload   — original string that was signed
 * @param {string} signature — hex signature to verify
 * @param {string} secret    — HMAC key
 * @returns {boolean}
 */
function verifySignature(payload, signature, secret) {
    const expected = signPayload(payload, secret);
    try {
        // timingSafeEqual requires same-length buffers
        return crypto.timingSafeEqual(
            Buffer.from(expected, 'hex'),
            Buffer.from(signature, 'hex')
        );
    } catch {
        return false; // different lengths → definitely invalid
    }
}

// ── Build offline proof token ─────────────────────────────────────────────────
/**
 * Create a signed, time-bound proof token for a credential.
 * This token is embedded in QR codes and magic links.
 * It carries only the minimum fields needed for offline verification.
 *
 * Token structure:
 * {
 *   v:          1,                  // token version
 *   credId:     verificationId,
 *   docType:    record.docType,
 *   issuer:     record.issuer,
 *   holderName: record.studentName,
 *   status:     record.status,
 *   docHash:    record.documentHash, // for tamper detection
 *   txId:       record.txId,         // for optional on-chain check
 *   issuedAt:   record.issuedAt,
 *   exp:        expiry timestamp (ms),
 *   sig:        HMAC-SHA256 of the above fields
 * }
 *
 * @param {object} record   — credential record from store/Firestore
 * @param {string} secret   — INSTITUTION_SECRET
 * @param {number} ttlMs    — time-to-live in milliseconds (default 24 hours)
 * @returns {object} signed proof token
 */
function buildProofToken(record, secret, ttlMs = 24 * 60 * 60 * 1000) {
    const exp = Date.now() + ttlMs;

    // Only include fields needed for offline verification — no internal IDs
    const payload = {
        v:          1,
        credId:     record.verificationId,
        docType:    record.docType,
        issuer:     record.issuer,
        holderName: record.studentName,
        status:     record.status,
        docHash:    record.documentHash,
        txId:       record.txId || null,
        issuedAt:   record.issuedAt,
        exp,
    };

    // Sign the canonical JSON string of the payload
    const sig = signPayload(JSON.stringify(payload), secret);

    return { ...payload, sig };
}

// ── Standard error response ───────────────────────────────────────────────────
/**
 * Build a consistent error response object.
 *
 * @param {string} code    — machine-readable error code
 * @param {string} message — human-readable message
 * @returns {{ error: string, code: string }}
 */
function buildErrorResponse(code, message) {
    return { error: message, code };
}

module.exports = {
    sha256,
    signPayload,
    verifySignature,
    buildProofToken,
    buildErrorResponse,
};
