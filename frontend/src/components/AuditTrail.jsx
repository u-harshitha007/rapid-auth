import React, { useState } from 'react';
import { History, CircleAlert, Search } from 'lucide-react';

const AuditTrail = ({ claims, students, onRevoke, onSupersede, address }) => {
    const [filter, setFilter] = useState('all');
    const [search, setSearch] = useState('');

    const getStudentName = (id) => students.find(s => s.id === id)?.name || id;

    const filtered = claims.filter(c => {
        const matchesFilter = filter === 'all' || c.status === filter;
        const matchesSearch = !search ||
            getStudentName(c.studentId).toLowerCase().includes(search.toLowerCase()) ||
            c.type.toLowerCase().includes(search.toLowerCase()) ||
            c.id.toLowerCase().includes(search.toLowerCase());
        return matchesFilter && matchesSearch;
    });

    const handleRevokeWithReason = (claimId) => {
        const reason = prompt('Please enter the reason for revocation (e.g., Error in entry, Fraudulent document):');
        if (reason) {
            onRevoke(claimId, reason);
        }
    };


    return (
        <div className="cv-card">
            <div className="cv-card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                    <div style={{ background: 'rgba(99, 102, 241, 0.1)', color: 'var(--cv-primary)', width: '40px', height: '40px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <History size={20} />
                    </div>
                    <div>
                        <h2 style={{ margin: 0 }}>📜 Credential Lifecycle Explorer</h2>
                        <p className="cv-hint" style={{ margin: 0 }}>Cryptographic audit trail of all issued, revoked, and updated credentials.</p>
                    </div>
                </div>
            </div>

            <div className="cv-audit-toolbar" style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
                    <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--cv-text-dim)' }} />
                    <input
                        className="cv-input"
                        placeholder="Search student, claim type or ID..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{ paddingLeft: '2.5rem', width: '100%' }}
                    />
                </div>
                <select
                    className="cv-input"
                    style={{ width: 'auto', minWidth: '150px' }}
                    value={filter}
                    onChange={e => setFilter(e.target.value)}
                >
                    <option value="all">🌐 All States</option>
                    <option value="active">🟢 Active Only</option>
                    <option value="revoked">🔴 Revoked Only</option>
                    <option value="superseded">🟡 Replaced Only</option>
                </select>
            </div>

            <div className="cv-record-timeline">
                {filtered.map(c => (
                    <div key={c.id} style={{
                        padding: '1.25rem',
                        border: '1px solid var(--cv-border)',
                        borderRadius: '16px',
                        marginBottom: '1rem',
                        background: c.status === 'revoked' ? 'rgba(239,68,68,0.02)' : 'rgba(255,255,255,0.01)',
                        transition: '0.2s'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                                    <span className={`cv-tag cv-tag-${c.status}`} style={{ fontSize: '0.65rem' }}>{c.status.toUpperCase()}</span>
                                    <strong style={{ fontSize: '1rem', color: '#fff' }}>{c.type} — {getStudentName(c.studentId)}</strong>
                                </div>
                                <div style={{ fontSize: '0.78rem', color: 'var(--cv-text-dim)', marginBottom: '0.75rem' }}>
                                    ID: <code>{c.id}</code> | {c.date} | {c.issuer}
                                </div>
                                <div style={{ padding: '0.75rem 1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)', fontSize: '0.85rem' }}>
                                    <code style={{ color: 'var(--cv-primary)' }}>{c.value}</code>
                                </div>

                                {c.status === 'revoked' && (
                                    <div style={{ marginTop: '0.8rem', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', background: 'rgba(239,68,68,0.05)', padding: '0.5rem 0.75rem', borderRadius: '8px' }}>
                                        <CircleAlert size={14} /> <strong>Revoked:</strong> {c.revocationReason}
                                    </div>
                                )}

                                {c.previousVersion && (
                                    <div style={{ marginTop: '0.6rem', fontSize: '0.75rem', color: 'var(--cv-primary)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                        🔗 Replaced: <code>{c.previousVersion}</code>
                                    </div>
                                )}
                                {c.nextVersion && (
                                    <div style={{ marginTop: '0.6rem', fontSize: '0.75rem', color: 'var(--cv-text-dim)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                        🆕 Superseded by: <code>{c.nextVersion}</code>
                                    </div>
                                )}
                            </div>

                            {c.status === 'active' && (
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    <select
                                        className="cv-input cv-input-small"
                                        style={{ fontSize: '0.75rem', padding: '0.4rem 0.6rem', minWidth: '130px' }}
                                        onChange={(e) => {
                                            const reason = e.target.value;
                                            if (reason && window.confirm(`Permanently revoke this credential for ${getStudentName(c.studentId)}?\nReason: ${reason}`)) {
                                                onRevoke(c.id, reason);
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
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <div className="cv-audit-stats" style={{ display: 'flex', gap: '2rem', marginTop: '2rem', padding: '1.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="cv-stat">
                    <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#fff' }}>{claims.length}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--cv-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Total Lifecycle Events</div>
                </div>
                <div className="cv-stat">
                    <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--cv-primary)' }}>{claims.filter(c => c.status === 'active').length}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--cv-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Currently Active</div>
                </div>
            </div>
        </div>
    );
};

export default AuditTrail;
