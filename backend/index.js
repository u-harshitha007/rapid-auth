const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();

// ─────────────────────────────────────────────────────────
// CORS Configuration
// ─────────────────────────────────────────────────────────
const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://rapid-auth-two.vercel.app',
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) === -1) {
            return callback(new Error('CORS policy: origin not allowed'), false);
        }
        return callback(null, true);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// ─────────────────────────────────────────────────────────
// IN-MEMORY STORE  (resets on server restart — fine for demo)
// ─────────────────────────────────────────────────────────
const credentials = {}; // verificationId → credential record
const auditLog = [];    // append-only log

function addAudit(action, meta) {
    auditLog.unshift({ action, meta, timestamp: new Date().toISOString() });
}

// ─────────────────────────────────────────────────────────
// HELPER — SHA-256
// ─────────────────────────────────────────────────────────
function sha256(data) {
    return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

// Institutional secret used as HMAC key (simulates private key signing)
const INSTITUTION_SECRET = process.env.INSTITUTION_SECRET || 'rapidauth-secret-2026';

function sign(payload) {
    return crypto.createHmac('sha256', INSTITUTION_SECRET).update(payload).digest('hex');
}

// ─────────────────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────────────────

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'online', mode: 'Cryptographic (No Blockchain)', timestamp: new Date().toISOString() });
});

// ── ISSUE a credential ──────────────────────────────────
// POST /api/issue
// Body: { studentId, studentName, docType, value, issuer, issuedBy }
app.post('/api/issue', (req, res) => {
    const { studentId, studentName, docType, value, issuer, issuedBy } = req.body;

    if (!studentId || !docType || !value || !issuer) {
        return res.status(400).json({ error: 'Missing required fields: studentId, docType, value, issuer' });
    }

    const verificationId = uuidv4();
    const issuedAt = new Date().toISOString();

    // The canonical document payload that gets hashed
    const docPayload = { studentId, studentName, docType, value, issuer, issuedAt };
    const documentHash = sha256(docPayload);

    // HMAC signature over the hash (simulates institutional RSA signing)
    const signature = sign(documentHash);

    const record = {
        verificationId,
        studentId,
        studentName: studentName || studentId,
        docType,
        value,
        issuer,
        issuedBy: issuedBy || issuer,
        issuedAt,
        documentHash,
        signature,
        status: 'active',
        revocationReason: null,
        revokedAt: null,
        revokedBy: null,
        previousVersion: req.body.previousVersion || null,
        nextVersion: null,
    };

    // If superseding an old doc, mark it
    if (req.body.previousVersion && credentials[req.body.previousVersion]) {
        credentials[req.body.previousVersion].status = 'superseded';
        credentials[req.body.previousVersion].nextVersion = verificationId;
        addAudit('SUPERSEDE', `Doc ${req.body.previousVersion} superseded by ${verificationId}`);
    }

    credentials[verificationId] = record;
    addAudit('ISSUE', `${docType} issued to ${studentName || studentId} | ID: ${verificationId}`);

    res.json({ success: true, verificationId, documentHash, record });
});

// ── VERIFY a credential ──────────────────────────────────
// GET /api/verify/:id
app.get('/api/verify/:id', (req, res) => {
    const record = credentials[req.params.id];
    if (!record) {
        return res.status(404).json({ verified: false, status: 'NOT_FOUND', error: 'No credential found with this ID.' });
    }

    // Re-compute hash to detect tampering
    const docPayload = {
        studentId: record.studentId,
        studentName: record.studentName,
        docType: record.docType,
        value: record.value,
        issuer: record.issuer,
        issuedAt: record.issuedAt,
    };
    const recomputedHash = sha256(docPayload);
    const isTampered = recomputedHash !== record.documentHash;

    addAudit('VERIFY', `Verification attempt for ${record.verificationId} — status: ${record.status}`);

    res.json({
        verified: !isTampered && record.status === 'active',
        status: isTampered ? 'TAMPERED' : record.status.toUpperCase(),
        record,
        integrityCheck: {
            storedHash: record.documentHash,
            recomputedHash,
            match: !isTampered,
        }
    });
});

// ── REVOKE a credential ──────────────────────────────────
// POST /api/revoke/:id
// Body: { reason, revokedBy }
app.post('/api/revoke/:id', (req, res) => {
    const record = credentials[req.params.id];
    if (!record) return res.status(404).json({ error: 'Credential not found.' });
    if (record.status === 'revoked') return res.status(400).json({ error: 'Already revoked.' });

    record.status = 'revoked';
    record.revocationReason = req.body.reason || 'Administrative Action';
    record.revokedAt = new Date().toISOString();
    record.revokedBy = req.body.revokedBy || 'admin';

    addAudit('REVOKE', `Credential ${req.params.id} revoked — Reason: ${record.revocationReason}`);

    res.json({ success: true, record });
});

// ── GET all credentials (for issuer dashboard) ───────────
// GET /api/credentials?studentId=S001
app.get('/api/credentials', (req, res) => {
    let records = Object.values(credentials);
    if (req.query.studentId) {
        records = records.filter(r => r.studentId === req.query.studentId);
    }
    res.json(records);
});

// ── AUDIT LOG ────────────────────────────────────────────
// GET /api/audit
app.get('/api/audit', (req, res) => {
    res.json(auditLog);
});

// ─────────────────────────────────────────────────────────
// SEED some demo data on startup
// ─────────────────────────────────────────────────────────
function seedDemo() {
    const seeds = [
        { studentId: 'S001', studentName: 'Ravi Kumar', docType: 'Marksheet', value: 'Sem 5 – 8.8 CGPA', issuer: 'Academic Office' },
        { studentId: 'S001', studentName: 'Ravi Kumar', docType: 'Degree', value: 'B.Tech CS', issuer: 'University Registrar' },
        { studentId: 'S001', studentName: 'Ravi Kumar', docType: 'NOC', value: 'Campus No Dues', issuer: 'Campus Admin' },
        { studentId: 'S002', studentName: 'Priya Sharma', docType: 'Placement', value: 'Verified: Google Cloud India', issuer: 'Placement Cell' },
        { studentId: 'S003', studentName: 'Arjun Mehta', docType: 'Marksheet', value: 'Sem 5 – 7.2 CGPA (Revised)', issuer: 'Academic Office' },
    ];

    seeds.forEach(s => {
        const verificationId = uuidv4();
        const issuedAt = new Date().toISOString();
        const docPayload = { studentId: s.studentId, studentName: s.studentName, docType: s.docType, value: s.value, issuer: s.issuer, issuedAt };
        const documentHash = sha256(docPayload);
        const signature = sign(documentHash);
        credentials[verificationId] = {
            verificationId, ...s, issuedBy: s.issuer, issuedAt,
            documentHash, signature, status: 'active',
            revocationReason: null, revokedAt: null, revokedBy: null,
            previousVersion: null, nextVersion: null,
        };
    });

    addAudit('INIT', 'Demo seed data loaded — 5 credentials issued');
    console.log('✅ Demo data seeded:', Object.keys(credentials).length, 'credentials');
}

seedDemo();

// ─────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4001;
app.listen(PORT, () => {
    console.log(`🚀 RapidAuth Backend (No-Blockchain) running on port ${PORT}`);
    console.log(`   Security: SHA-256 hashing + HMAC-SHA256 signatures`);
});
