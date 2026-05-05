import React, { useState, useEffect } from 'react';
import { ShieldCheck, FilePlus, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { ApiService } from '../services/ApiService';

const DOC_TYPES = ['Marksheet', 'Degree', 'NOC', 'Internship', 'LOR', 'Placement', 'Bonafide', 'Achievement'];

const IssuerPanel = ({ address, students, onClaimIssued, claims, onRevoke }) => {
    const [form, setForm] = useState({
        studentId: students[0]?.id || '',
        docType: DOC_TYPES[0],
        value: '',
        issuer: 'Academic Office',
    });
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState(null); // { type: 'success'|'error', message, detail }
    const [issuedCredentials, setIssuedCredentials] = useState([]);
    const [fetching, setFetching] = useState(true);

    // Load existing credentials from backend
    useEffect(() => {
        ApiService.getCredentials()
            .then(data => setIssuedCredentials(Array.isArray(data) ? data : []))
            .catch(() => setIssuedCredentials([]))
            .finally(() => setFetching(false));
    }, []);

    const handleChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

    const handleIssue = async () => {
        if (!form.value.trim()) {
            setStatus({ type: 'error', message: 'Please fill in all fields.' });
            return;
        }
        const student = students.find(s => s.id === form.studentId);
        setLoading(true);
        setStatus(null);
        try {
            const result = await ApiService.issueCredential({
                studentId: form.studentId,
                studentName: student?.name || form.studentId,
                docType: form.docType,
                value: form.value,
                issuer: form.issuer,
                issuedBy: address,
            });

            setIssuedCredentials(prev => [result.record, ...prev]);
            setStatus({
                type: 'success',
                message: `✅ Credential issued successfully!`,
                detail: `Verification ID: ${result.verificationId}\nHash: ${result.documentHash.slice(0, 32)}...`,
            });
            setForm(prev => ({ ...prev, value: '' }));

            // Notify App so student view updates too
            if (onClaimIssued) {
                onClaimIssued({
                    id: result.verificationId,
                    studentId: form.studentId,
                    type: form.docType,
                    value: form.value,
                    issuer: form.issuer,
                    date: new Date().toISOString().slice(0, 10),
                    status: 'active',
                    visible: true,
                    verificationId: result.verificationId,
                    documentHash: result.documentHash,
                });
            }
        } catch (err) {
            setStatus({ type: 'error', message: `❌ ${err.message}` });
        } finally {
            setLoading(false);
        }
    };

    const handleRevoke = async (cred) => {
        const reason = prompt(`Reason for revoking "${cred.docType}" for ${cred.studentName}?`);
        if (!reason) return;
        try {
            await ApiService.revokeCredential(cred.verificationId, reason, address);
            setIssuedCredentials(prev =>
                prev.map(c => c.verificationId === cred.verificationId
                    ? { ...c, status: 'revoked', revocationReason: reason }
                    : c)
            );
            if (onRevoke) onRevoke(cred.verificationId, reason);
        } catch (err) {
            alert(`Revocation failed: ${err.message}`);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* ── Issue Form ── */}
            <div className="cv-card">
                <div className="cv-card-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                        <div style={{ background: 'rgba(99,102,241,0.1)', color: 'var(--cv-primary)', width: '40px', height: '40px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <FilePlus size={20} />
                        </div>
                        <div>
                            <h2 style={{ margin: 0 }}>📋 Issue Credential</h2>
                            <p className="cv-hint" style={{ margin: 0 }}>
                                Document is SHA-256 hashed and HMAC-signed by the institution.
                            </p>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1.5rem' }}>
                    {/* Student */}
                    <div>
                        <label style={{ fontSize: '0.8rem', color: 'var(--cv-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.4rem' }}>Student</label>
                        <select className="cv-input" value={form.studentId} onChange={e => handleChange('studentId', e.target.value)} style={{ width: '100%' }}>
                            {students.map(s => <option key={s.id} value={s.id}>{s.name} ({s.id}) — {s.dept}</option>)}
                        </select>
                    </div>

                    {/* Doc Type */}
                    <div>
                        <label style={{ fontSize: '0.8rem', color: 'var(--cv-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.4rem' }}>Document Type</label>
                        <select className="cv-input" value={form.docType} onChange={e => handleChange('docType', e.target.value)} style={{ width: '100%' }}>
                            {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>

                    {/* Value */}
                    <div>
                        <label style={{ fontSize: '0.8rem', color: 'var(--cv-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.4rem' }}>Details / Value</label>
                        <input
                            className="cv-input"
                            type="text"
                            placeholder={`e.g. Sem 6 – 9.1 CGPA`}
                            value={form.value}
                            onChange={e => handleChange('value', e.target.value)}
                            style={{ width: '100%' }}
                            onKeyDown={e => e.key === 'Enter' && handleIssue()}
                        />
                    </div>

                    {/* Issuer */}
                    <div>
                        <label style={{ fontSize: '0.8rem', color: 'var(--cv-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.4rem' }}>Issuing Authority</label>
                        <input
                            className="cv-input"
                            type="text"
                            value={form.issuer}
                            onChange={e => handleChange('issuer', e.target.value)}
                            style={{ width: '100%' }}
                        />
                    </div>

                    <button
                        className="cv-btn-primary"
                        onClick={handleIssue}
                        disabled={loading}
                        style={{ padding: '1rem', fontSize: '1rem' }}
                    >
                        {loading ? '⏳ Hashing & Signing...' : '🔏 Sign & Issue Credential'}
                    </button>

                    {status && (
                        <div style={{
                            padding: '1rem 1.25rem',
                            borderRadius: '12px',
                            background: status.type === 'success' ? 'rgba(34,197,94,0.07)' : 'rgba(239,68,68,0.07)',
                            border: `1px solid ${status.type === 'success' ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
                            color: status.type === 'success' ? '#22c55e' : '#ef4444',
                            fontSize: '0.88rem',
                        }}>
                            <div style={{ fontWeight: '700', marginBottom: status.detail ? '0.5rem' : 0 }}>{status.message}</div>
                            {status.detail && <pre style={{ margin: 0, fontSize: '0.75rem', opacity: 0.8, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{status.detail}</pre>}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Issued Credentials Table ── */}
            <div className="cv-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                    <h3 style={{ margin: 0 }}>📁 All Issued Credentials</h3>
                    <button
                        className="cv-btn-ghost"
                        style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                        onClick={() => {
                            setFetching(true);
                            ApiService.getCredentials()
                                .then(data => setIssuedCredentials(Array.isArray(data) ? data : []))
                                .finally(() => setFetching(false));
                        }}
                    >
                        <RefreshCw size={13} /> Refresh
                    </button>
                </div>

                {fetching ? (
                    <div style={{ textAlign: 'center', color: 'var(--cv-text-dim)', padding: '2rem' }}>Loading credentials...</div>
                ) : issuedCredentials.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--cv-text-dim)', padding: '2rem', fontSize: '0.9rem' }}>No credentials issued yet. Issue your first one above.</div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {issuedCredentials.map(cred => (
                            <div key={cred.verificationId} style={{
                                padding: '1rem 1.25rem',
                                border: '1px solid var(--cv-border)',
                                borderRadius: '14px',
                                background: cred.status === 'revoked' ? 'rgba(239,68,68,0.03)' : 'rgba(255,255,255,0.01)',
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                                            <span className={`cv-tag cv-tag-${cred.status}`} style={{ fontSize: '0.6rem' }}>{cred.status.toUpperCase()}</span>
                                            <strong style={{ color: '#fff', fontSize: '0.92rem' }}>{cred.docType} — {cred.studentName}</strong>
                                        </div>
                                        <div style={{ fontSize: '0.78rem', color: 'var(--cv-text-dim)', marginBottom: '0.4rem' }}>
                                            {cred.value}
                                        </div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--cv-text-dim)', fontFamily: 'monospace' }}>
                                            ID: <code style={{ color: 'var(--cv-primary)' }}>{cred.verificationId}</code>
                                        </div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--cv-text-dim)', marginTop: '0.2rem', fontFamily: 'monospace' }}>
                                            SHA-256: <code>{cred.documentHash?.slice(0, 40)}…</code>
                                        </div>
                                        {cred.status === 'revoked' && (
                                            <div style={{ marginTop: '0.5rem', fontSize: '0.78rem', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                                <AlertTriangle size={12} /> Revoked: {cred.revocationReason}
                                            </div>
                                        )}
                                    </div>
                                    {cred.status === 'active' && (
                                        <select
                                            className="cv-input cv-input-small"
                                            style={{ fontSize: '0.75rem', padding: '0.4rem 0.6rem', minWidth: '120px' }}
                                            onChange={(e) => {
                                                const reason = e.target.value;
                                                if (reason && window.confirm(`Revoke "${cred.docType}" for ${cred.studentName}?`)) {
                                                    handleRevoke({ ...cred, revocationReason: reason });
                                                }
                                                e.target.value = '';
                                            }}
                                        >
                                            <option value="">🚫 Revoke…</option>
                                            <option value="Fraudulent Document">Fraudulent</option>
                                            <option value="Error in Issuance">Data Error</option>
                                            <option value="Administrative Policy">Policy Change</option>
                                            <option value="Expired Early">Early Expiry</option>
                                        </select>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default IssuerPanel;
