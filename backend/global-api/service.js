/**
 * global-api/service.js
 *
 * Business logic for the Global Verification API.
 * All database access and validation rules live here.
 * Controllers call these functions and only handle HTTP concerns.
 *
 * Exports:
 *   verifyCredentialByTxId(txId, db, store)       — full verification flow
 *   getCredentialPublic(credentialId, db, store)  — public metadata fetch
 */

const {
    sha256,
    validateTxId,
    checkAlgorandTxId,
    findCredential,
} = require('./utils');

// ── verifyCredentialByTxId ────────────────────────────────────────────────────
/**
 * Full verification flow for an external caller (HR portal, university, etc.).
 *
 * Flow:
 *   1. Validate txId format
 *   2. Query Firestore "credentials" collection where txId == :txId
 *      (falls back to in-memory store if Firestore is not configured)
 *   3. Check credential exists
 *   4. Check status: reject if revoked or superseded
 *   5. Re-compute SHA-256 document hash — detect tampering
 *   6. Query Algorand Testnet indexer to confirm txId on-chain
 *      (skipped gracefully if indexer is unreachable)
 *   7. Return structured result object
 *
 * @param {string}                           txId   — Algorand transaction ID
 * @param {FirebaseFirestore.Firestore|null} db     — Firestore instance or null
 * @param {object}                           store  — in-memory credentials object
 * @returns {Promise<{ status: number, body: object }>}
 *   status — HTTP status code to send
 *   body   — JSON response body
 */
async function verifyCredentialByTxId(txId, db, store) {

    // Step 1: Validate txId format
    const { valid, reason } = validateTxId(txId);
    if (!valid) {
        return {
            status: 400,
            body: { verified: false, error: reason, code: 'INVALID_TX_ID' },
        };
    }

    // Step 2: Find credential by txId (Firestore → in-memory fallback)
    let record;
    try {
        record = await findCredential(db, store, 'txId', txId);
    } catch (err) {
        return {
            status: 500,
            body: { verified: false, error: 'Database lookup failed', code: 'DB_ERROR' },
        };
    }

    // Step 3: Credential must exist
    if (!record) {
        return {
            status: 404,
            body: {
                verified: false,
                error: 'No credential found for this transaction ID',
                code: 'NOT_FOUND',
            },
        };
    }

    // Step 4a: Reject revoked credentials
    if (record.status === 'revoked') {
        return {
            status: 200,
            body: {
                verified: false,
                credentialId: record.verificationId,
                issuer: record.issuer,
                documentType: record.docType,
                status: 'Revoked',
                txId: record.txId,
                revocationReason: record.revocationReason || null,
            },
        };
    }

    // Step 4b: Reject superseded credentials
    if (record.status === 'superseded') {
        return {
            status: 200,
            body: {
                verified: false,
                credentialId: record.verificationId,
                issuer: record.issuer,
                documentType: record.docType,
                status: 'Superseded',
                txId: record.txId,
                supersededBy: record.nextVersion || null,
            },
        };
    }

    // Step 5: Re-compute document hash to detect tampering
    // The canonical payload must match exactly what was hashed at issuance
    const docPayload = {
        studentId:   record.studentId,
        studentName: record.studentName,
        docType:     record.docType,
        value:       record.value,
        issuer:      record.issuer,
        issuedAt:    record.issuedAt,
    };
    const recomputedHash = sha256(docPayload);
    const isTampered = recomputedHash !== record.documentHash;

    if (isTampered) {
        return {
            status: 200,
            body: {
                verified: false,
                credentialId: record.verificationId,
                issuer: record.issuer,
                documentType: record.docType,
                status: 'Tampered',
                txId: record.txId,
            },
        };
    }

    // Step 6: Optionally confirm txId on Algorand Testnet indexer
    // Returns true (found), false (not found), or null (indexer unreachable)
    // null means we skip blockchain validation — credential is still verified
    // based on the hash check above
    let blockchainConfirmed = null;
    try {
        blockchainConfirmed = await checkAlgorandTxId(txId);
    } catch {
        blockchainConfirmed = null; // unreachable — skip gracefully
    }

    // Step 7: Return verified result
    return {
        status: 200,
        body: {
            verified: true,
            credentialId: record.verificationId,
            issuer: record.issuer,
            documentType: record.docType,
            holderName: record.studentName,
            status: 'Active',
            txId: record.txId,
            issuedAt: record.issuedAt,
            // Only include blockchainConfirmed if we actually got a result
            ...(blockchainConfirmed !== null && { blockchainConfirmed }),
        },
    };
}

// ── getCredentialPublic ───────────────────────────────────────────────────────
/**
 * Fetch public-safe credential metadata by verificationId.
 * Never exposes documentHash, signature, or internal fields.
 *
 * Flow:
 *   1. Query Firestore "credentials" collection by document ID (verificationId)
 *      (falls back to in-memory store if Firestore is not configured)
 *   2. Return public metadata: credentialId, issuer, documentType, status, ipfsCid, txId
 *
 * @param {string}                           credentialId — verificationId (UUID)
 * @param {FirebaseFirestore.Firestore|null} db           — Firestore instance or null
 * @param {object}                           store        — in-memory credentials object
 * @returns {Promise<{ status: number, body: object }>}
 */
async function getCredentialPublic(credentialId, db, store) {

    // Step 1: Find credential by verificationId (Firestore → in-memory fallback)
    let record;
    try {
        record = await findCredential(db, store, 'verificationId', credentialId);
    } catch (err) {
        return {
            status: 500,
            body: { error: 'Database lookup failed', code: 'DB_ERROR' },
        };
    }

    if (!record) {
        return {
            status: 404,
            body: { error: 'Credential not found', code: 'NOT_FOUND' },
        };
    }

    // Step 2: Return only public-safe fields
    // documentHash and signature are intentionally excluded
    return {
        status: 200,
        body: {
            credentialId:    record.verificationId,
            documentType:    record.docType,
            issuer:          record.issuer,
            holderName:      record.studentName,
            value:           record.value,
            status:          record.status,
            issuedAt:        record.issuedAt,
            txId:            record.txId            || null,
            ipfsCid:         record.ipfsCid         || null,
            previousVersion: record.previousVersion || null,
            nextVersion:     record.nextVersion     || null,
            // Include revocation details only when revoked
            ...(record.status === 'revoked' && {
                revocationReason: record.revocationReason,
                revokedAt:        record.revokedAt,
            }),
        },
    };
}

module.exports = { verifyCredentialByTxId, getCredentialPublic };
