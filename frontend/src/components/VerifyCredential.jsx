import React, { useState, useEffect } from 'react';
import { ShieldCheck, QrCode, Link2, Search, AlertTriangle, CheckCircle2, XCircle, Camera } from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { ApiService } from '../services/ApiService';

const TABS = [
    { id: 'id', label: 'Verification ID', icon: <Search size={15} /> },
    { id: 'qr', label: 'QR Token', icon: <QrCode size={15} /> },
    { id: 'magic', label: 'Magic Link', icon: <Link2 size={15} /> },
    { id: 'registry', label: 'Registry', icon: <Search size={15} /> },
];

const STATUS_CONFIG = {
    ACTIVE: { color: '#22c55e', bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.25)', icon: <CheckCircle2 size={22} color="#22c55e" />, label: '✅ Verified & Active' },
    TAMPERED: { color: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.25)', icon: <XCircle size={22} color="#ef4444" />, label: '⚠️ Document Tampered' },
    REVOKED: { color: '#f97316', bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.25)', icon: <XCircle size={22} color="#f97316" />, label: '🔴 Document Revoked' },
    SUPERSEDED: { color: '#eab308', bg: 'rgba(234,179,8,0.08)', border: 'rgba(234,179,8,0.25)', icon: <AlertTriangle size={22} color="#eab308" />, label: '🔁 Superseded by newer version' },
    NOT_FOUND: { color: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.25)', icon: <XCircle size={22} color="#ef4444" />, label: '❌ Not Found' },
};

const VerifyCredential = ({ claims, students }) => {
    const [activeTab, setActiveTab] = useState('id');
    const [verificationId, setVerificationId] = useState('');
    const [payload, setPayload] = useState('');
    const [magicToken, setMagicToken] = useState('');
    const [registryId, setRegistryId] = useState('');
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [isScanning, setIsScanning] = useState(false);

    useEffect(() => {
        if (!isScanning) return;
        const scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: { width: 250, height: 250 } }, false);
        scanner.render((decodedText) => {
            setPayload(decodedText);
            setIsScanning(false);
            scanner.clear();
        }, () => { });
        return () => { scanner.clear().catch(() => { }); };
    }, [isScanning]);

    const reset = () => { setResult(null); setError(''); setVerificationId(''); setPayload(''); setMagicToken(''); setRegistryId(''); setIsScanning(false); };

    // ── Verify by ID (calls backend) ──
    const handleVerifyById = async () => {
        setError(''); setResult(null); setLoading(true);
        try {
            const data = await ApiService.verifyCredential(verificationId.trim());
            if (data.status === 'NOT_FOUND') {
                setError('No credential found with this ID. Check the ID and try again.');
            } else {
                setResult({ type: 'backend', data });
            }
        } catch {
            setError('Could not connect to verification server. Make sure the backend is running on port 4001.');
        } finally {
            setLoading(false);
        }
    };

    // ── QR Token Verify (local sig check) ──
    const handleVerifyQR = () => {
        setError(''); setResult(null); setLoading(true);
        setTimeout(() => {
            try {
                const parsed = JSON.parse(payload.trim());
                if (!parsed.sig || !parsed.sig.startsWith('DEMO_SIG')) {
                    setError('Invalid token — signature verification failed.');
                    setLoading(false); return;
                }
                if (Date.now() > parsed.expiry) {
                    setError('This token has expired. Ask the student to generate a new one.');
                    setLoading(false); return;
                }
                const student = students.find(s => s.id === parsed.studentId);
                setResult({ type: 'qr', student: student || { name: parsed.name, id: parsed.studentId, dept: parsed.dept, batch: parsed.batch }, claims: parsed.claims });
            } catch {
                setError('Could not parse payload. Paste the full JSON from the QR generator.');
            }
            setLoading(false);
        }, 600);
    };

    // ── Magic Link Verify ──
    const handleVerifyMagic = () => {
        setError(''); setResult(null); setLoading(true);
        setTimeout(() => {
            try {
                const url = magicToken.trim();
                const tokenParam = url.includes('?token=') ? url.split('?token=')[1].split('&')[0] : url;
                const decoded = decodeURIComponent(escape(atob(tokenParam)));
                const parsed = JSON.parse(decoded);
                if (!parsed.sig || !parsed.sig.startsWith('DEMO_SIG')) {
                    setError('Invalid magic link — signature check failed.');
                    setLoading(false); return;
                }
                if (Date.now() > parsed.expiry) {
                    setError('This magic link has expired.');
                    setLoading(false); return;
                }
                const student = students.find(s => s.id === parsed.studentId);
                setResult({ type: 'qr', student: student || { name: parsed.name, id: parsed.studentId, dept: parsed.dept, batch: parsed.batch }, claims: parsed.claims });
            } catch {
                setError('Invalid magic link format. Paste the full URL or token.');
            }
            setLoading(false);
        }, 600);
    };

    // ── Registry Lookup ──
    const handleRegistryLookup = () => {
        setError(''); setResult(null); setLoading(true);
        setTimeout(() => {
            const id = registryId.trim().toUpperCase();
            const student = students.find(s => s.id === id);
            if (!student) {
                setError(`No student found with ID "${id}". Try S001 or S002.`);
                setLoading(false); return;
            }
            const studentClaims = claims.filter(c => c.studentId === id && c.status === 'active' && c.visible !== false);
            setResult({ type: 'qr', student, claims: studentClaims.map(c => ({ type: c.type, value: c.value, issuer: c.issuer, date: c.date })) });
            setLoading(false);
        }, 500);
    };

    const renderBackendResult = (data) => {
        const cfg = STATUS_CONFIG[data.status] || STATUS_CONFIG.NOT_FOUND;
        const rec = data.record;
        return (
            <div style={{ marginTop: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: '14px', padding: '1rem 1.25rem', marginBottom: '1.25rem' }}>
                    {cfg.icon}
                    <div>
                        <div style={{ fontWeight: '700', color: cfg.color, fontSize: '0.9rem' }}>{cfg.label}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--cv-text-dim)' }}>Source: RapidAuth Verification Server</div>
                    </div>
                </div>

                {rec && (
                    <>
                        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--cv-border)', borderRadius: '14px', padding: '1.25rem', marginBottom: '1rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', fontSize: '0.85rem' }}>
                                <div><span style={{ color: 'var(--cv-text-dim)' }}>Student</span><div style={{ fontWeight: '700', color: '#fff' }}>{rec.studentName}</div></div>
                                <div><span style={{ color: 'var(--cv-text-dim)' }}>ID</span><div style={{ fontWeight: '700', color: '#fff' }}>{rec.studentId}</div></div>
                                <div><span style={{ color: 'var(--cv-text-dim)' }}>Document Type</span><div style={{ color: '#fff' }}>{rec.docType}</div></div>
                                <div><span style={{ color: 'var(--cv-text-dim)' }}>Issuer</span><div style={{ color: '#fff' }}>{rec.issuer}</div></div>
                                <div style={{ gridColumn: '1/-1' }}><span style={{ color: 'var(--cv-text-dim)' }}>Value</span><div style={{ color: '#fff' }}>{rec.value}</div></div>
                                <div style={{ gridColumn: '1/-1' }}><span style={{ color: 'var(--cv-text-dim)' }}>Issued At</span><div style={{ color: '#fff', fontSize: '0.78rem' }}>{rec.issuedAt}</div></div>
                            </div>
                        </div>

                        {/* Hash integrity */}
                        <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--cv-border)', borderRadius: '12px', padding: '1rem', marginBottom: '1rem', fontFamily: 'monospace', fontSize: '0.72rem' }}>
                            <div style={{ color: 'var(--cv-text-dim)', marginBottom: '0.4rem', fontFamily: 'inherit', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>🔒 Integrity Check</div>
                            <div style={{ color: data.integrityCheck?.match ? '#22c55e' : '#ef4444', marginBottom: '0.3rem' }}>
                                {data.integrityCheck?.match ? '✅ Hash matches — document unmodified' : '❌ Hash mismatch — document may be tampered'}
                            </div>
                            <div style={{ color: 'var(--cv-text-dim)', wordBreak: 'break-all' }}>SHA-256: {rec.documentHash}</div>
                        </div>

                        {rec.revocationReason && (
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', background: 'rgba(249,115,22,0.07)', border: '1px solid rgba(249,115,22,0.2)', borderRadius: '10px', padding: '0.75rem 1rem', fontSize: '0.85rem', color: '#f97316' }}>
                                <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: '1px' }} />
                                <span><strong>Revocation reason:</strong> {rec.revocationReason}</span>
                            </div>
                        )}
                    </>
                )}

                <button className="cv-btn-ghost" onClick={reset} style={{ marginTop: '1.25rem', width: '100%', fontSize: '0.85rem' }}>↩ Verify Another</button>
            </div>
        );
    };

    const renderQrResult = (res) => (
        <div style={{ marginTop: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: '14px', padding: '1rem 1.25rem', marginBottom: '1.25rem' }}>
                <CheckCircle2 size={22} color="#22c55e" />
                <div>
                    <div style={{ fontWeight: '700', color: '#22c55e', fontSize: '0.9rem' }}>✅ Identity Verified</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--cv-text-dim)' }}>Source: Signed Token</div>
                </div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--cv-border)', borderRadius: '14px', padding: '1.25rem', marginBottom: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', fontSize: '0.85rem' }}>
                    <div><span style={{ color: 'var(--cv-text-dim)' }}>Name</span><div style={{ fontWeight: '700', color: '#fff' }}>{res.student?.name}</div></div>
                    <div><span style={{ color: 'var(--cv-text-dim)' }}>ID</span><div style={{ fontWeight: '700', color: '#fff' }}>{res.student?.id}</div></div>
                    <div><span style={{ color: 'var(--cv-text-dim)' }}>Department</span><div style={{ color: '#fff' }}>{res.student?.dept}</div></div>
                    <div><span style={{ color: 'var(--cv-text-dim)' }}>Batch</span><div style={{ color: '#fff' }}>{res.student?.batch}</div></div>
                </div>
            </div>
            <div style={{ fontWeight: '700', fontSize: '0.8rem', color: 'var(--cv-text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>Verified Credentials ({res.claims?.length})</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {res.claims?.map((c, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: '12px', padding: '0.85rem 1.1rem' }}>
                        <ShieldCheck size={16} color="#22c55e" style={{ flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: '600', fontSize: '0.88rem', color: '#fff' }}>{c.type}</div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--cv-text-dim)' }}>{c.value}</div>
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--cv-text-dim)', textAlign: 'right' }}>{c.issuer}<br />{c.date}</div>
                    </div>
                ))}
            </div>
            <button className="cv-btn-ghost" onClick={reset} style={{ marginTop: '1.25rem', width: '100%', fontSize: '0.85rem' }}>↩ Verify Another</button>
        </div>
    );

    return (
        <div className="cv-card">
            <div className="cv-card-header">
                <h2>🔍 Recruiter Verification Gateway</h2>
                <p className="cv-hint">Instantly validate credentials via verification ID, QR code, or magic link.</p>
            </div>

            {/* Tab bar */}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.75rem', borderBottom: '1px solid var(--cv-border)', flexWrap: 'wrap' }}>
                {TABS.map(tab => (
                    <button key={tab.id} onClick={() => { setActiveTab(tab.id); reset(); }} style={{
                        display: 'flex', alignItems: 'center', gap: '0.4rem',
                        padding: '0.7rem 1.25rem', borderRadius: '10px 10px 0 0', border: 'none',
                        background: activeTab === tab.id ? 'rgba(99,102,241,0.12)' : 'transparent',
                        color: activeTab === tab.id ? 'var(--cv-primary)' : 'var(--cv-text-dim)',
                        borderBottom: activeTab === tab.id ? '2px solid var(--cv-primary)' : '2px solid transparent',
                        fontWeight: activeTab === tab.id ? '700' : '500',
                        fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.2s',
                    }}>
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            <div style={{ padding: '1.75rem 0' }}>
                {/* ── Verification ID tab ── */}
                {activeTab === 'id' && (
                    <div>
                        <div style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px', padding: '1rem 1.25rem', marginBottom: '1.25rem', fontSize: '0.84rem', color: 'var(--cv-text-muted)', lineHeight: 1.7 }}>
                            <strong style={{ color: 'var(--cv-primary)' }}>How to use:</strong> Enter the Verification ID from the student's issued credential. The server will check the document hash and return the status.
                        </div>
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <input
                                className="cv-input"
                                type="text"
                                placeholder="Enter Verification ID (UUID format)…"
                                value={verificationId}
                                onChange={e => setVerificationId(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleVerifyById()}
                                style={{ flex: 1, fontFamily: 'monospace', fontSize: '0.85rem' }}
                            />
                            <button className="cv-btn-primary" onClick={handleVerifyById} disabled={!verificationId.trim() || loading} style={{ padding: '0.75rem 1.5rem', whiteSpace: 'nowrap' }}>
                                {loading ? 'Verifying…' : '🔐 Verify'}
                            </button>
                        </div>
                    </div>
                )}

                {/* ── QR TOKEN tab ── */}
                {activeTab === 'qr' && (
                    <div>
                        <div style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px', padding: '1rem 1.25rem', marginBottom: '1.25rem', fontSize: '0.84rem', color: 'var(--cv-text-muted)', lineHeight: 1.7 }}>
                            <strong style={{ color: 'var(--cv-primary)' }}>How to use:</strong> Scan the student's QR code or paste the JSON payload below.
                        </div>
                        {isScanning ? (
                            <div style={{ marginBottom: '1.25rem' }}>
                                <div id="reader" style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--cv-border)' }}></div>
                                <button className="cv-btn-ghost" onClick={() => setIsScanning(false)} style={{ width: '100%', marginTop: '0.75rem', fontSize: '0.85rem' }}>Cancel Scanning</button>
                            </div>
                        ) : (
                            <button className="cv-btn-secondary" onClick={() => setIsScanning(true)} style={{ width: '100%', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', padding: '0.85rem', background: 'rgba(99,102,241,0.1)', border: '1px dashed var(--cv-primary)', color: 'var(--cv-primary)' }}>
                                <Camera size={20} /> Use Camera Scanner
                            </button>
                        )}
                        <textarea className="cv-input" rows={3} placeholder='Paste JSON payload…' value={payload} onChange={e => setPayload(e.target.value)} style={{ fontFamily: 'monospace', fontSize: '0.8rem', resize: 'vertical' }} />
                        <button className="cv-btn-primary" onClick={handleVerifyQR} disabled={!payload.trim() || loading} style={{ marginTop: '1rem', width: '100%', padding: '0.85rem' }}>
                            {loading ? 'Verifying…' : '🔐 Verify Token'}
                        </button>
                    </div>
                )}

                {/* ── MAGIC LINK tab ── */}
                {activeTab === 'magic' && (
                    <div>
                        <div style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px', padding: '1rem 1.25rem', marginBottom: '1.25rem', fontSize: '0.84rem', color: 'var(--cv-text-muted)', lineHeight: 1.7 }}>
                            <strong style={{ color: 'var(--cv-primary)' }}>How to use:</strong> Paste the magic link sent by the student.
                        </div>
                        <input className="cv-input" type="text" placeholder="Paste magic link URL…" value={magicToken} onChange={e => setMagicToken(e.target.value)} />
                        <button className="cv-btn-primary" onClick={handleVerifyMagic} disabled={!magicToken.trim() || loading} style={{ marginTop: '1rem', width: '100%', padding: '0.85rem' }}>
                            {loading ? 'Verifying…' : '🔗 Verify Magic Link'}
                        </button>
                    </div>
                )}

                {/* ── REGISTRY tab ── */}
                {activeTab === 'registry' && (
                    <div>
                        <div style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px', padding: '1rem 1.25rem', marginBottom: '1.25rem', fontSize: '0.84rem', color: 'var(--cv-text-muted)', lineHeight: 1.7 }}>
                            <strong style={{ color: 'var(--cv-primary)' }}>How to use:</strong> Enter the student's Enrollment ID.
                            <br />Demo IDs: <code style={{ color: 'var(--cv-primary)' }}>S001</code>, <code style={{ color: 'var(--cv-primary)' }}>S002</code>
                        </div>
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <input className="cv-input" type="text" placeholder="Enrollment ID (e.g. S001)" value={registryId} onChange={e => setRegistryId(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleRegistryLookup()} style={{ flex: 1 }} />
                            <button className="cv-btn-primary" onClick={handleRegistryLookup} disabled={!registryId.trim() || loading} style={{ padding: '0.75rem 1.5rem', whiteSpace: 'nowrap' }}>
                                {loading ? 'Looking up…' : '🔎 Lookup'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '12px', padding: '1rem 1.25rem', marginTop: '1.25rem' }}>
                        <AlertTriangle size={18} color="#ef4444" style={{ flexShrink: 0, marginTop: '1px' }} />
                        <span style={{ color: '#ef4444', fontSize: '0.88rem' }}>{error}</span>
                    </div>
                )}

                {/* Results */}
                {result && result.type === 'backend' && renderBackendResult(result.data)}
                {result && result.type === 'qr' && renderQrResult(result)}
            </div>
        </div>
    );
};

export default VerifyCredential;
