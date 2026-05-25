/**
 * offline-verification/service.js
 *
 * Business logic for the Offline Verification module.
 *
 * Two operations:
 *
 * 1. generateOfflineProof(credentialId, db, store)
 *    Called when a student wants to share a credential offline.
 *    Looks up the credential, builds a signed proof token, returns it.
 *    The token is embedded in a QR code or magic link by the frontend.
 *
 * 2. verifyOfflineProof(token)
 *    Called when a recruiter/verifier scans a QR or opens a magic link.
 *    Verifies the proof token locally — no blockchain call needed.
 *    Steps:
 *      a. Parse and validate token structure
 *      b. Check token has not expired
 *      c. Verify HMAC-SHA256 signature using institution secret
 *      d. Check credential status in token (active / revoked / superseded)
 *      e. Optionally confirm on Algorand if internet is available
 *    Returns a verification result with a clear status.
 */

const { buildProofToken, verifySignature, sha256, buildErrorResponse } = require('./utils');
const https = require('https');

// Institution secret — same key used at issuance in index.js
const INSTITUTION_SECRET = process.env.INSTITUTION_SECRET || 'rapidauth-secret-2026';

// Algorand Testnet indexer — used for optional online confirmation
const INDEXER = process.env.ALGOD_INDEXER_SERVER || 'https://testnet-idx.algonode.cloud';

// ── generateOfflineProof ──────────────────────────────────────────────────────
/**
 * Generate a signed offline proof token for a credential.
 *
 * Flow:
 *   1. Look up credential by verificationId (Firestore → in-memory fallback)
 *   2. Reject if credential is not active
 *   3. Build and sign a proof token with a 24-hour TTL
 *   4. Return the token (caller embeds it in QR / magic link)
 *
 * @param {string}      credentialId — verificationId (UUID)
 * @param {object|null} db           — Firestore instance or null
 * @param {object}      store        — in-memory credentials object
 * @param {number}      [ttlMs]      — token TTL in ms (default 24h)
 * @returns {Promise<{ status: number, body: object }>}
 */
async function generateOfflineProof(credentialId, db, store, ttlMs) {

    // Step 1: Find credential (Firestore first, then in-memory)
    let record = null;
    if (db) {
        try {
            const doc = await db.collection('credentials').doc(credentialId).get();
            if (doc.exists) record = doc.data();
        } catch (err) {
            console.error('[offline] Firestore lookup failed, trying in-memory:', err.message);
        }
    }
    if (!record) record = store[credentialId] || null;

    if (!record) {
        return {
            status: 404,
            body: buildErrorResponse('NOT_FOUND', 'Credential not found'),
        };
    }

    // Step 2: Only active credentials can generate offline proofs
    if (record.status !== 'active') {
        return {
            status: 400,
            body: buildErrorResponse(
                'CREDENTIAL_NOT_ACTIVE',
                `Cannot generate proof for a ${record.status} credential`
            ),
        };
    }

    // Step 3: Build signed proof token
    const token = buildProofToken(record, INSTITUTION_SECRET, ttlMs);

    return {
        status: 200,
        body: {
            token,
            // Base64-encode the token for easy embedding in QR / URL
            tokenBase64: Buffer.from(JSON.stringify(token)).toString('base64'),
            expiresAt: new Date(token.exp).toISOString(),
        },
    };
}

// ── verifyOfflineProof ────────────────────────────────────────────────────────
/**
 * Verify a signed offline proof token.
 * Works without internet — falls back to local checks only.
 * Optionally confirms on Algorand if internet is available.
 *
 * Flow:
 *   a. Parse token (accept raw object or base64 string)
 *   b. Validate required fields exist
 *   c. Check token expiry
 *   d. Verify HMAC-SHA256 signature (local — no network needed)
 *   e. Check credential status embedded in token
 *   f. Optionally query Algorand indexer for extra trust (skipped if offline)
 *
 * @param {object|string} rawToken — proof token object or base64-encoded string
 * @returns {Promise<{ status: number, body: object }>}
 */
async function verifyOfflineProof(rawToken) {

    // Step a: Parse token
    let token;
    try {
        if (typeof rawToken === 'string') {
            // Decode base64 → JSON
            token = JSON.parse(Buffer.from(rawToken, 'base64').toString('utf8'));
        } else {
            token = rawToken;
        }
    } catch {
        return {
            status: 400,
            body: buildErrorResponse('INVALID_TOKEN', 'Token could not be parsed'),
        };
    }

    // Step b: Validate required fields
    const required = ['v', 'credId', 'docType', 'issuer', 'status', 'docHash', 'exp', 'sig'];
    for (const field of required) {
        if (token[field] === undefined || token[field] === null) {
            return {
                status: 400,
                body: buildErrorResponse('INVALID_TOKEN', `Missing required field: ${field}`),
            };
        }
    }

    // Step c: Check token expiry
    if (Date.now() > token.exp) {
        return {
            status: 200,
            body: {
                verified: false,
                credentialId: token.credId,
                issuer: token.issuer,
                documentType: token.docType,
                status: 'Expired',
                reason: 'This proof token has expired. Ask the holder to generate a new one.',
            },
        };
    }

    // Step d: Verify HMAC-SHA256 signature
    // Extract sig, rebuild the payload without sig, re-sign and compare
    const { sig, ...payloadWithoutSig } = token;
    const isValidSig = verifySignature(JSON.stringify(payloadWithoutSig), sig, INSTITUTION_SECRET);

    if (!isValidSig) {
        return {
            status: 200,
            body: {
                verified: false,
                credentialId: token.credId,
                issuer: token.issuer,
                documentType: token.docType,
                status: 'InvalidSignature',
                reason: 'Proof signature is invalid — token may have been tampered with.',
            },
        };
    }

    // Step e: Check credential status embedded in token
    if (token.status === 'revoked') {
        return {
            status: 200,
            body: {
                verified: false,
                credentialId: token.credId,
                issuer: token.issuer,
                documentType: token.docType,
                status: 'Revoked',
                reason: 'This credential has been revoked by the issuer.',
            },
        };
    }

    if (token.status === 'superseded') {
        return {
            status: 200,
            body: {
                verified: false,
                credentialId: token.credId,
                issuer: token.issuer,
                documentType: token.docType,
                status: 'Superseded',
                reason: 'A newer version of this credential exists.',
            },
        };
    }

    // Step f: Optionally confirm txId on Algorand (skipped if no txId or offline)
    let blockchainConfirmed = null;
    if (token.txId) {
        try {
            blockchainConfirmed = await new Promise((resolve) => {
                https.get(`${INDEXER}/v2/transactions/${token.txId}`, (res) => {
                    if (res.statusCode === 200) return resolve(true);
                    if (res.statusCode === 404) return resolve(false);
                    resolve(null); // unexpected status → treat as unreachable
                }).on('error', () => resolve(null)); // offline → skip gracefully
            });
        } catch {
            blockchainConfirmed = null;
        }
    }

    // All checks passed — credential is verified
    return {
        status: 200,
        body: {
            verified: true,
            credentialId: token.credId,
            issuer: token.issuer,
            documentType: token.docType,
            holderName: token.holderName || null,
            status: 'Active',
            issuedAt: token.issuedAt,
            txId: token.txId || null,
            verificationMethod: blockchainConfirmed === true
                ? 'offline+blockchain'   // local sig + on-chain confirmed
                : 'offline',             // local sig only (blockchain skipped)
            ...(blockchainConfirmed !== null && { blockchainConfirmed }),
        },
    };
}

module.exports = { generateOfflineProof, verifyOfflineProof };
