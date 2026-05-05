import React, { useState, useEffect } from 'react';
import IssuerPanel from './components/IssuerPanel';
import VerifyCredential from './components/VerifyCredential';
import DegreeSharing from './components/DegreeSharing';
import AuditTrail from './components/AuditTrail';
import MyClaimsList from './components/MyClaimsList';
import EmailShare from './components/EmailShare';
import FlowExplanation from './components/FlowExplanation';
import FAQAccordion from './components/FAQAccordion';
import ProblemSolution from './components/ProblemSolution';
import MarketImpact from './components/MarketImpact';
import PremiumFooter from './components/PremiumFooter';
import DemoTour from './components/DemoTour';
import { Shield, Zap, Mail, History, Eye, CircleCheck, UserCheck, Lock } from 'lucide-react';
import './index.css';

// ─────────────────────────────────────────
//  MOCK SEED DATA  (mirrors backend seed)
// ─────────────────────────────────────────
const MOCK_STUDENTS = [
    { id: 'S001', name: 'Ravi Kumar', email: 'ravi@campusvault.ai', batch: '2021–2025', dept: 'Computer Science' },
    { id: 'S002', name: 'Priya Sharma', email: 'priya@campusvault.ai', batch: '2020–2024', dept: 'Mechanical Eng' },
    { id: 'S003', name: 'Arjun Mehta', email: 'arjun@campusvault.ai', batch: '2021–2025', dept: 'Electrical Eng' },
];

const MOCK_CLAIMS = [
    { id: 'C001', studentId: 'S001', type: 'Marksheet', value: 'Sem 5 – 8.8 CGPA', issuer: 'Academic Office', date: '2024-11-01', status: 'active', visible: true, revocationReason: null, previousVersion: null, nextVersion: null },
    { id: 'C002', studentId: 'S001', type: 'Degree', value: 'B.Tech CS', issuer: 'University Registrar', date: '2024-12-15', status: 'active', visible: true, revocationReason: null, previousVersion: null, nextVersion: null },
    { id: 'C003', studentId: 'S001', type: 'NOC', value: 'Campus No Dues', issuer: 'Campus Admin', date: '2025-01-10', status: 'active', visible: false, revocationReason: null, previousVersion: null, nextVersion: null },
    { id: 'C005', studentId: 'S002', type: 'Placement', value: 'Verified: Google Cloud India', issuer: 'Placement Cell', date: '2024-12-20', status: 'active', visible: true, revocationReason: null, previousVersion: null, nextVersion: null },
    { id: 'C006', studentId: 'S003', type: 'Marksheet', value: 'Sem 5 – 6.5 CGPA', issuer: 'Academic Office', date: '2024-11-01', status: 'revoked', visible: true, revocationReason: 'Error in calculation', previousVersion: null, nextVersion: 'C007' },
    { id: 'C007', studentId: 'S003', type: 'Marksheet', value: 'Sem 5 – 7.2 CGPA (Revised)', issuer: 'Academic Office', date: '2024-12-05', status: 'active', visible: true, revocationReason: null, previousVersion: 'C006', nextVersion: null },
];

const DEMO_RECRUITER_EMAIL = import.meta.env.VITE_DEMO_RECRUITER || 'hr@campusvault.ai';
const DEMO_OTP = import.meta.env.VITE_DEMO_OTP || '123456';
const DEMO_EMAIL = import.meta.env.VITE_DEMO_STUDENT || 'ravi@campusvault.ai';

// Hardcoded admin credentials for demo (Authority role)
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'admin123';

// ─────────────────────────────────────────
//  APP
// ─────────────────────────────────────────
function App() {
    const [address, setAddress] = useState('');
    const [userRole, setUserRole] = useState('');
    const [step, setStep] = useState(1);

    const [students] = useState(MOCK_STUDENTS);
    const [claims, setClaims] = useState(MOCK_CLAIMS);
    const [currentStudent, setCurrentStudent] = useState(null);
    const [auditLog, setAuditLog] = useState([
        { action: 'INITIALIZE', metadata: 'System booted — cryptographic mode (no blockchain)', timestamp: new Date().toLocaleString() }
    ]);

    // Admin login state
    const [adminUser, setAdminUser] = useState('');
    const [adminPass, setAdminPass] = useState('');
    const [adminError, setAdminError] = useState('');

    // OTP Login State
    const [studentEmail, setStudentEmail] = useState('');
    const [studentOtp, setStudentOtp] = useState(['', '', '', '', '', '']);
    const [studentOtpSent, setStudentOtpSent] = useState(false);
    const [studentSending, setStudentSending] = useState(false);

    const [verifierEmail, setVerifierEmail] = useState('');
    const [verifierOtp, setVerifierOtp] = useState(['', '', '', '', '', '']);
    const [verifierOtpSent, setVerifierOtpSent] = useState(false);
    const [verifierSending, setVerifierSending] = useState(false);

    const addAuditEntry = (action, metadata) => {
        setAuditLog(prev => [{ action, metadata, timestamp: new Date().toLocaleString() }, ...prev]);
    };

    const resetAuth = () => {
        setStudentEmail(''); setStudentOtp(['', '', '', '', '', '']); setStudentOtpSent(false);
        setVerifierEmail(''); setVerifierOtp(['', '', '', '', '', '']); setVerifierOtpSent(false);
        setAdminUser(''); setAdminPass(''); setAdminError('');
    };

    // ── Admin Login ──
    const handleAdminLogin = () => {
        if (adminUser === ADMIN_USER && adminPass === ADMIN_PASS) {
            setAddress('admin@rapidauth.system');
            setUserRole('issuer');
            setStep(1);
            addAuditEntry('LOGIN', 'Authority logged in via admin credentials');
            setAdminError('');
        } else {
            setAdminError('Invalid credentials. Use admin / admin123');
        }
    };

    // ── Send OTP ──
    const handleSendOtp = (role = 'student') => {
        const email = role === 'student' ? studentEmail : verifierEmail;
        const setSending = role === 'student' ? setStudentSending : setVerifierSending;
        const setOtpSent = role === 'student' ? setStudentOtpSent : setVerifierOtpSent;
        const targetEmail = role === 'student' ? DEMO_EMAIL : DEMO_RECRUITER_EMAIL;

        if (!email.includes('@')) { alert('Enter a valid email.'); return; }
        setSending(true);
        setTimeout(() => {
            if (email.toLowerCase() !== targetEmail.toLowerCase()) {
                setSending(false);
                alert(`Email not found.\n\n💡 Use: ${targetEmail}`);
                return;
            }
            setOtpSent(true);
            setSending(false);
            console.log(`[AUTH] OTP for ${email}: ${DEMO_OTP}`);
        }, 800);
    };

    // ── Verify OTP ──
    const handleOtpChange = (index, value, role = 'student') => {
        if (isNaN(value)) return;
        const otp = role === 'student' ? studentOtp : verifierOtp;
        const setOtp = role === 'student' ? setStudentOtp : setVerifierOtp;
        const prefix = role === 'student' ? 'otp-s' : 'otp-v';
        const newOtp = [...otp];
        newOtp[index] = value.slice(-1);
        setOtp(newOtp);
        if (value && index < 5) {
            document.getElementById(`${prefix}-${index + 1}`)?.focus();
        }
    };

    const handleVerifyOtp = (role = 'student') => {
        const otp = role === 'student' ? studentOtp : verifierOtp;
        const email = role === 'student' ? studentEmail : verifierEmail;
        const fullOtp = otp.join('');
        if (fullOtp !== DEMO_OTP) {
            alert(`Invalid OTP.\n\n💡 Use: ${DEMO_OTP}`);
            return;
        }
        if (role === 'student') {
            const student = students.find(s => s.email.toLowerCase() === email.toLowerCase());
            if (student) {
                setCurrentStudent(student);
                setAddress(student.email);
                setUserRole('student');
                setStep(1);
                addAuditEntry('LOGIN', `Student ${student.name} logged in via Email/OTP`);
            }
        } else {
            setAddress(email);
            setUserRole('verifier');
            setStep(1);
            addAuditEntry('LOGIN', `Verifier ${email} logged in via Email/OTP`);
        }
    };

    // ── Disconnect ──
    const handleDisconnect = () => {
        addAuditEntry('LOGOUT', `User ${address} disconnected`);
        setAddress('');
        setUserRole('');
        setCurrentStudent(null);
        resetAuth();
    };

    // ── Data handlers ──
    const handleClaimIssued = (newClaim) => {
        const id = newClaim.verificationId || `C${Date.now()}`;
        setClaims(prev => {
            const newObj = {
                ...newClaim,
                id,
                status: 'active',
                visible: true,
                revocationReason: null,
                previousVersion: newClaim.previousVersion || null,
                nextVersion: null,
            };
            if (newClaim.previousVersion) {
                const updated = prev.map(c => c.id === newClaim.previousVersion ? { ...c, status: 'superseded', nextVersion: id } : c);
                return [newObj, ...updated];
            }
            return [newObj, ...prev];
        });
        addAuditEntry('ISSUE', `${newClaim.type} issued to Student ${newClaim.studentId}`);
    };

    const handleToggleVisibility = (claimId) => {
        setClaims(prev => prev.map(c => c.id === claimId ? { ...c, visible: !c.visible } : c));
        const c = claims.find(cl => cl.id === claimId);
        addAuditEntry('VISIBILITY_TOGGLE', `Visibility of ${c?.type} changed to ${!c?.visible}`);
    };

    const handleRevoke = (claimId, reason = 'Administrative Action') => {
        setClaims(prev => prev.map(c => c.id === claimId ? {
            ...c, status: 'revoked', revocationReason: reason,
            revokedAt: new Date().toLocaleString(), revokedBy: address,
        } : c));
        addAuditEntry('REVOKE', `Claim ${claimId} revoked. Reason: ${reason}`);
    };

    const handleSupersede = (oldClaimId, newClaimData) => {
        const newId = `C${Date.now()}`;
        setClaims(prev => {
            const updated = prev.map(c => c.id === oldClaimId ? { ...c, status: 'superseded', nextVersion: newId } : c);
            return [{ ...newClaimData, id: newId, status: 'active', visible: true, previousVersion: oldClaimId, nextVersion: null }, ...updated];
        });
        addAuditEntry('SUPERSEDE', `Claim ${oldClaimId} replaced by ${newId}`);
    };

    return (
        <div className="cv-app">
            <header className="cv-header">
                <div className="cv-logo-group">
                    <Shield size={32} color="var(--cv-primary)" />
                    <h2 className="text-gradient">RapidAuth <span className="cv-tag">Secure</span></h2>
                </div>
                {address && (
                    <div className="cv-header-right">
                        <div className="cv-user-profile">
                            <span className="cv-user-name">
                                {currentStudent ? currentStudent.name : address.includes('@') ? address.split('@')[0] : `${address.slice(0, 6)}…`}
                            </span>
                            <span className="cv-role-badge">
                                {userRole === 'issuer' ? '🏛️ Authority' : userRole === 'student' ? '🎓 Student' : '🔍 Recruiter'}
                            </span>
                            <button className="cv-btn-ghost" onClick={handleDisconnect}>Disconnect</button>
                        </div>
                    </div>
                )}
            </header>

            <DemoTour userRole={userRole} step={step} claims={claims} address={address} />

            <main className="cv-main">
                {!address ? (
                    <div className="cv-portal-wrap">
                        {/* HERO */}
                        <div className="cv-portal-hero" style={{ textAlign: 'center', marginBottom: '4rem' }}>
                            <div className="cv-problem-badge">🔐 CRYPTOGRAPHIC VERIFICATION</div>
                            <h1 className="text-gradient" style={{ fontSize: '3.5rem', lineHeight: '1.1', marginBottom: '1.5rem' }}>
                                RapidAuth: Secure<br />Document Integrity
                            </h1>
                            <p className="cv-hero-sub" style={{ fontSize: '1.2rem', opacity: '0.8' }}>
                                Instant, tamper-proof academic credential verification using
                                <strong> SHA-256 hashing</strong> and <strong>digital signatures</strong> — no blockchain required.
                            </p>
                        </div>

                        {/* AUTH CARDS */}
                        <div className="cv-role-grid">
                            {/* Card 1: Authority */}
                            <div className="cv-role-card">
                                <div className="cv-step-label">ISSUE</div>
                                <div className="cv-role-icon">
                                    <div style={{ background: 'rgba(99,102,241,0.1)', color: 'var(--cv-primary)', width: '60px', height: '60px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
                                        <Lock size={32} />
                                    </div>
                                </div>
                                <h3>University Authority</h3>
                                <p>Issue digitally signed credentials. Manage document lifecycle with full revocation support.</p>

                                <div className="cv-otp-section" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                    <input
                                        className="cv-input"
                                        type="text"
                                        placeholder="Username"
                                        value={adminUser}
                                        onChange={e => { setAdminUser(e.target.value); setAdminError(''); }}
                                        onKeyDown={e => e.key === 'Enter' && handleAdminLogin()}
                                    />
                                    <input
                                        className="cv-input"
                                        type="password"
                                        placeholder="Password"
                                        value={adminPass}
                                        onChange={e => { setAdminPass(e.target.value); setAdminError(''); }}
                                        onKeyDown={e => e.key === 'Enter' && handleAdminLogin()}
                                    />
                                    <button className="cv-btn-primary" onClick={handleAdminLogin}>
                                        🔑 Login as Authority
                                    </button>
                                    {adminError && <div style={{ color: '#ef4444', fontSize: '0.8rem', textAlign: 'center' }}>{adminError}</div>}
                                    <div className="cv-demo-hint" style={{ fontWeight: 700, color: 'var(--cv-primary)' }}>
                                        💡 USE: <code>admin</code> / <code>admin123</code>
                                    </div>
                                </div>
                            </div>

                            {/* Card 2: Student */}
                            <div className="cv-role-card cv-role-card-highlight">
                                <div className="cv-step-label">CONTROL</div>
                                <div className="cv-role-icon">
                                    <div style={{ background: 'rgba(99,102,241,0.1)', color: 'var(--cv-primary)', width: '60px', height: '60px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
                                        <UserCheck size={32} />
                                    </div>
                                </div>
                                <h3>Student Identity Vault</h3>
                                <p>Manage your academic identity. Share via QR or secure email links with one-click revocation.</p>

                                {!studentOtpSent ? (
                                    <div className="cv-otp-section">
                                        <input className="cv-input" type="email" placeholder="Institutional Email" value={studentEmail} onChange={e => setStudentEmail(e.target.value)} />
                                        <button className="cv-btn-primary" onClick={() => handleSendOtp('student')} disabled={studentSending}>
                                            {studentSending ? 'Sending...' : '📧 Send OTP'}
                                        </button>
                                        <div className="cv-demo-hint" style={{ fontWeight: 700, color: 'var(--cv-primary)' }}>💡 USE: <code>{DEMO_EMAIL}</code></div>
                                    </div>
                                ) : (
                                    <div className="cv-otp-section">
                                        <div className="cv-otp-inputs">
                                            {studentOtp.map((digit, i) => (
                                                <input key={i} id={`otp-s-${i}`} className="cv-otp-digit" value={digit} onChange={e => handleOtpChange(i, e.target.value, 'student')} />
                                            ))}
                                        </div>
                                        <button className="cv-btn-primary" onClick={() => handleVerifyOtp('student')}>🔓 Enter Vault</button>
                                        <div className="cv-demo-hint">OTP: <code>{DEMO_OTP}</code></div>
                                    </div>
                                )}
                            </div>

                            {/* Card 3: Recruiter */}
                            <div className="cv-role-card">
                                <div className="cv-step-label">VERIFY</div>
                                <div className="cv-role-icon">
                                    <div style={{ background: 'rgba(99,102,241,0.1)', color: 'var(--cv-primary)', width: '60px', height: '60px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
                                        <CircleCheck size={32} />
                                    </div>
                                </div>
                                <h3>Verification Gateway</h3>
                                <p>Instantly verify candidate credentials via verification ID or QR. Zero manual checks needed.</p>

                                {!verifierOtpSent ? (
                                    <div className="cv-otp-section">
                                        <input className="cv-input" type="email" placeholder="Recruiter Email" value={verifierEmail} onChange={e => setVerifierEmail(e.target.value)} />
                                        <button className="cv-btn-primary" onClick={() => handleSendOtp('verifier')} disabled={verifierSending}>
                                            {verifierSending ? 'Sending...' : '📧 Send OTP'}
                                        </button>
                                        <div className="cv-demo-hint" style={{ fontWeight: 700, color: 'var(--cv-primary)' }}>💡 USE: <code>{DEMO_RECRUITER_EMAIL}</code></div>
                                    </div>
                                ) : (
                                    <div className="cv-otp-section">
                                        <div className="cv-otp-inputs">
                                            {verifierOtp.map((digit, i) => (
                                                <input key={i} id={`otp-v-${i}`} className="cv-otp-digit" value={digit} onChange={e => handleOtpChange(i, e.target.value, 'verifier')} />
                                            ))}
                                        </div>
                                        <button className="cv-btn-primary" onClick={() => handleVerifyOtp('verifier')}>🔓 Access Gateway</button>
                                        <div className="cv-demo-hint">OTP: <code>{DEMO_OTP}</code></div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* LANDING SECTIONS */}
                        <ProblemSolution />
                        <FlowExplanation />
                        <MarketImpact />
                        <FAQAccordion />
                        <PremiumFooter />
                    </div>
                ) : (
                    <div className="cv-dashboard">
                        <aside className="cv-sidebar">
                            <div className="cv-logo" style={{ padding: '0 1rem', marginBottom: '2rem' }}>
                                <Shield size={28} />
                                <span style={{ fontSize: '1.25rem', fontWeight: '800' }}>RapidAuth</span>
                            </div>

                            <div className="cv-sidebar-label">
                                {userRole === 'issuer' ? '🏛️ ISSUER OPS' : userRole === 'student' ? '🎓 MY VAULT' : '🔍 GATEWAY'}
                            </div>

                            <div className="cv-nav-group">
                                {userRole === 'issuer' && (
                                    <>
                                        <button className={`cv-sidebar-btn ${step === 1 ? 'active' : ''}`} onClick={() => setStep(1)}>Issue Credential</button>
                                        <button className={`cv-sidebar-btn ${step === 2 ? 'active' : ''}`} onClick={() => setStep(2)}>History Log</button>
                                    </>
                                )}
                                {userRole === 'student' && (
                                    <>
                                        <button className={`cv-sidebar-btn ${step === 1 ? 'active' : ''}`} onClick={() => setStep(1)}><Eye size={18} /> My Credentials</button>
                                        <button className={`cv-sidebar-btn ${step === 2 ? 'active' : ''}`} onClick={() => setStep(2)}><Mail size={18} /> Email Share</button>
                                        <button className={`cv-sidebar-btn ${step === 3 ? 'active' : ''}`} onClick={() => setStep(3)}><Zap size={18} /> QR Share</button>
                                    </>
                                )}
                                {userRole === 'verifier' && (
                                    <>
                                        <button className={`cv-sidebar-btn ${step === 1 ? 'active' : ''}`} onClick={() => setStep(1)}><Shield size={18} /> Verify Credential</button>
                                        <button className={`cv-sidebar-btn ${step === 2 ? 'active' : ''}`} onClick={() => setStep(2)}><History size={18} /> Audit Log</button>
                                    </>
                                )}
                            </div>
                        </aside>

                        <div className="cv-content">
                            {userRole === 'issuer' && (
                                <>
                                    {step === 1 && <IssuerPanel address={address} students={students} onClaimIssued={handleClaimIssued} claims={claims} onRevoke={handleRevoke} />}
                                    {step === 2 && <AuditTrail claims={claims} onRevoke={handleRevoke} onSupersede={handleSupersede} students={students} address={address} />}
                                </>
                            )}

                            {userRole === 'student' && currentStudent && (
                                <>
                                    {step === 1 && <MyClaimsList student={currentStudent} claims={claims.filter(c => c.studentId === currentStudent.id)} onToggleVisibility={handleToggleVisibility} />}
                                    {step === 2 && <EmailShare student={currentStudent} claims={claims.filter(c => c.studentId === currentStudent.id)} onShareLogged={(log) => addAuditEntry(log.action, log.metadata)} />}
                                    {step === 3 && <DegreeSharing student={currentStudent} claims={claims.filter(c => c.studentId === currentStudent.id && c.visible && c.status === 'active')} />}
                                </>
                            )}

                            {userRole === 'verifier' && (
                                <>
                                    {step === 1 && <VerifyCredential students={students} claims={claims} />}
                                    {step === 2 && (
                                        <div className="cv-card">
                                            <h3>📜 Verification Audit Log</h3>
                                            <p className="cv-hint">Real-time trail of all verification and issuance events.</p>
                                            <div style={{ marginTop: '1.5rem' }}>
                                                {auditLog.map((log, i) => (
                                                    <div key={i} className="cv-audit-entry" style={{ padding: '1rem', border: '1px solid var(--cv-border)', borderRadius: '12px', marginBottom: '0.75rem' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                                                            <strong style={{ color: 'var(--cv-primary)' }}>{log.action}</strong>
                                                            <span style={{ fontSize: '0.75rem', color: 'var(--cv-text-muted)' }}>{log.timestamp}</span>
                                                        </div>
                                                        <div style={{ fontSize: '0.9rem' }}>{log.metadata}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}

export default App;
