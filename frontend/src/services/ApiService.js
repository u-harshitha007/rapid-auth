/**
 * ApiService.js
 * Centralized service for all RapidAuth backend API calls.
 * Replace BASE_URL with your deployed backend URL in production.
 */

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4001';

export const ApiService = {

    /** Issue a new credential via backend */
    async issueCredential({ studentId, studentName, docType, value, issuer, issuedBy, previousVersion }) {
        const res = await fetch(`${BASE_URL}/api/issue`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentId, studentName, docType, value, issuer, issuedBy, previousVersion }),
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Failed to issue credential');
        return res.json();
    },

    /** Verify a credential by verificationId */
    async verifyCredential(verificationId) {
        const res = await fetch(`${BASE_URL}/api/verify/${encodeURIComponent(verificationId)}`);
        return res.json();
    },

    /** Revoke a credential */
    async revokeCredential(verificationId, reason, revokedBy) {
        const res = await fetch(`${BASE_URL}/api/revoke/${encodeURIComponent(verificationId)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason, revokedBy }),
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Failed to revoke');
        return res.json();
    },

    /** Get all credentials, optionally filtered by studentId */
    async getCredentials(studentId) {
        const url = studentId
            ? `${BASE_URL}/api/credentials?studentId=${encodeURIComponent(studentId)}`
            : `${BASE_URL}/api/credentials`;
        const res = await fetch(url);
        return res.json();
    },

    /** Get full audit log */
    async getAuditLog() {
        const res = await fetch(`${BASE_URL}/api/audit`);
        return res.json();
    },

    /** Health check */
    async health() {
        const res = await fetch(`${BASE_URL}/api/health`);
        return res.json();
    },
};
