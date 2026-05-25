/**
 * global-api/utils.js
 *
 * Utility functions for the Global Verification API.
 * All helpers are self-contained — no imports from index.js
 * to avoid circular dependencies.
 *
 * Exports:
 *   sha256(data)                        — SHA-256 of a JSON-serialised object
 *   buildErrorResponse(code, message)   — standard error shape
 *   validateTxId(txId)                  — basic format check for Algorand txIds
 *   checkAlgorandTxId(txId)             — query Algonode indexer, returns bool|null
 *   initFirestore()                     — initialise Firebase Admin, return db|null
 *   findCredential(db, store, field, v) — Firestore-first lookup with in-memory fallback
 */

const crypto = require('crypto');
const https  = require('https');

// ── SHA-256 ───────────────────────────────────────────────────────────────────
/**
 * Compute SHA-256 of a JSON-serialised object.
 * Matches the same function used in index.js so hashes are comparable.
 *
 * @param {object|string} data
 * @returns {string} hex digest
 */
function sha256(data) {
    return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

// ── Standard error response ───────────────────────────────────────────────────
/**
 * Build a consistent error response object.
 *
 * @param {string} code     — machine-readable error code
 * @param {string} message  — human-readable message
 * @returns {{ error: string, code: string }}
 */
function buildErrorResponse(code, message) {
    return { error: message, code };
}

// ── txId format validation ────────────────────────────────────────────────────
/**
 * Basic sanity check for an Algorand transaction ID.
 * Algorand txIds are 52-character base32 strings.
 * We accept anything >= 8 chars so demo/test IDs also pass.
 *
 * @param {string} txId
 * @returns {{ valid: boolean, reason: string }}
 */
function validateTxId(txId) {
    if (!txId || typeof txId !== 'string') {
        return { valid: false, reason: 'txId is required' };
    }
    if (txId.trim().length < 8) {
        return { valid: false, reason: 'txId is too short' };
    }
    return { valid: true, reason: 'ok' };
}

// ── Algorand indexer check ────────────────────────────────────────────────────
/**
 * Query the Algorand Testnet indexer to confirm a txId exists on-chain.
 *
 * Returns:
 *   true  — transaction found on-chain
 *   false — transaction not found (404)
 *   null  — indexer unreachable (network error) — caller should skip gracefully
 *
 * Uses the public Algonode endpoint — no API key required.
 *
 * @param {string} txId
 * @returns {Promise<boolean|null>}
 */
function checkAlgorandTxId(txId) {
    const INDEXER = process.env.ALGOD_INDEXER_SERVER || 'https://testnet-idx.algonode.cloud';
    const url = `${INDEXER}/v2/transactions/${txId}`;

    return new Promise((resolve) => {
        https.get(url, (res) => {
            // 200 = found, 404 = not found, anything else = treat as unreachable
            if (res.statusCode === 200) return resolve(true);
            if (res.statusCode === 404) return resolve(false);
            resolve(null);
        }).on('error', () => resolve(null)); // network error → skip gracefully
    });
}

// ── Firebase Admin initialisation ────────────────────────────────────────────
/**
 * Initialise Firebase Admin SDK using env vars and return a Firestore instance.
 * Returns null if FIREBASE_PROJECT_ID is not set (demo/local mode).
 *
 * Safe to call multiple times — guards against double-initialisation.
 *
 * Required env vars:
 *   FIREBASE_PROJECT_ID
 *   FIREBASE_CLIENT_EMAIL
 *   FIREBASE_PRIVATE_KEY  (newlines stored as \n in env)
 *
 * @returns {FirebaseFirestore.Firestore|null}
 */
function initFirestore() {
    const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;
    if (!FIREBASE_PROJECT_ID) return null; // no config — demo mode

    try {
        const admin = require('firebase-admin');
        // Guard against double-initialisation (e.g. hot reload in dev)
        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: FIREBASE_PROJECT_ID,
                    clientEmail: FIREBASE_CLIENT_EMAIL,
                    // Env vars store literal \n — restore real newlines
                    privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
                }),
            });
        }
        return admin.firestore();
    } catch (err) {
        console.warn('[global-api] Firestore init failed:', err.message);
        return null;
    }
}

// ── Credential lookup ─────────────────────────────────────────────────────────
/**
 * Find a credential by a field value.
 * Tries Firestore first; falls back to the in-memory store passed in.
 *
 * @param {FirebaseFirestore.Firestore|null} db   — Firestore instance (or null)
 * @param {object}                           store — in-memory credentials object
 * @param {'txId'|'verificationId'}          field — field to search by
 * @param {string}                           value — value to match
 * @returns {Promise<object|null>}
 */
async function findCredential(db, store, field, value) {
    // ── Firestore path ────────────────────────────────────
    if (db) {
        try {
            if (field === 'verificationId') {
                // verificationId is the Firestore document ID — direct get is O(1)
                const doc = await db.collection('credentials').doc(value).get();
                return doc.exists ? doc.data() : null;
            }
            // For txId (or any other field) use a where query
            const snap = await db
                .collection('credentials')
                .where(field, '==', value)
                .limit(1)
                .get();
            return snap.empty ? null : snap.docs[0].data();
        } catch (err) {
            // Firestore error — log and fall through to in-memory
            console.error('[global-api] Firestore query error, using in-memory fallback:', err.message);
        }
    }

    // ── In-memory fallback ────────────────────────────────
    if (field === 'verificationId') return store[value] || null;
    return Object.values(store).find(c => c[field] === value) || null;
}

module.exports = {
    sha256,
    buildErrorResponse,
    validateTxId,
    checkAlgorandTxId,
    initFirestore,
    findCredential,
};
