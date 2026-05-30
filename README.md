<h1 align="center">
  RapidAuth: Secure Document Integrity System
</h1>

# 📌 Project Description

RapidAuth is a secure, centralized digital credential verification platform that enables educational institutions to issue tamper-resistant, instantly verifiable academic documents.

Instead of blockchain, the system uses:
- **SHA-256 hashing** for document integrity
- **HMAC-SHA256 digital signatures** for issuer authenticity
- **Unique verification IDs** for each credential
- **QR codes & magic links** for easy sharing
- **Audit logs** for complete transparency

It creates a unified system for the entire document lifecycle:
- Issuance
- Student control
- Verification
- Revocation
- Audit

Across all college-issued credentials.

---

# 🚨 The Problem

Educational institutions face a credential crisis:

- Students wait days for simple documents like NOCs and bonafide certificates.
- Recruiters spend weeks verifying marksheets and internship proofs.
- 68% of recruiters admit they cannot verify every document thoroughly.
- Fake documents cost Indian companies an estimated ₹1,200 crore annually.
- College staff spend 40–50% of their time handling verification requests.

### ❌ Existing Solutions Fail

- DigiLocker excludes dynamic college-level issuance.
- Academic ERPs lack external verification capability.
- Most systems focus only on degrees.
- NOCs, LORs, internships, and achievement certificates are ignored.

---

# 🌐 Live Demo URL

https://rapid-auth-two.vercel.app/

---

# 💡 Solution (Without Blockchain)

RapidAuth replaces blockchain with a secure cryptographic verification engine:

### 🔹 1. Digital Issuance System
- Colleges log in as Authority (admin/admin123)
- Each document is:
  - SHA-256 hashed from its content
  - HMAC-signed using the institutional secret key
  - Assigned a unique **Verification ID** (UUID)

### 🔹 2. Student Dashboard
- Students log in with college email + OTP (no wallet required)
- Can view/download documents
- Control access (public/private per document)
- Share via QR code or secure magic link

### 🔹 3. Instant Verification Portal
- Recruiters enter the Verification ID or scan QR
- System checks:
  - Document hash integrity (re-computes SHA-256)
  - Issuing authority
  - Current status (active / revoked / superseded)
- Shows: ✅ **Verified** / ⚠️ **Tampered** / 🔴 **Revoked**

### 🔹 4. Revocation System
- Colleges can revoke credentials with a mandatory reason
- Status updates instantly across the system

### 🔹 5. Audit & Logs
- Every action tracked: who issued, who accessed, when verified

---

# 🏗 Architecture Overview

RapidAuth uses a hybrid architecture combining a **Node.js/Express backend** (cryptographic engine), **in-memory credential store**, and a **React frontend**.

```
Frontend (React/Vite)    Backend (Node/Express)
─────────────────────    ──────────────────────
IssuerPanel        ──▶  POST /api/issue
                         SHA-256 hash + HMAC sign
                   ◀──  verificationId + hash

VerifyCredential   ──▶  GET /api/verify/:id
                         Re-compute hash, compare
                   ◀──  VERIFIED / TAMPERED / REVOKED

AuditTrail         ──▶  GET /api/audit
```

---

# 🛠 Tech Stack

### Frontend
- React + Vite

### Backend
- Node.js + Express
- Built-in `crypto` module (SHA-256, HMAC-SHA256)

### Security
- SHA-256 document hashing
- HMAC-SHA256 institutional signing
- JWT-style time-bound QR/magic link tokens
- Email + OTP authentication for students/recruiters

### Storage
- In-memory (demo) — easily swappable to MongoDB/Firebase

---

# ⚙ Installation & Setup

## ✅ Prerequisites
- Node.js (v18+)
- Git

## 🚀 Installation Steps

### 1. Clone the repository
```bash
git clone <repo-url>
cd RapidAuth
```

### 2. Start Backend
```bash
cd backend
npm install
npm start
# Runs on http://localhost:4001
```

### 3. Start Frontend
```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:5173
```

---

## 👥 Demo Credentials

### 🏛 Authority (Issuer)
- Username: `admin`
- Password: `admin123`

### 🎓 Student
- Email: `ravi@campusvault.ai`
- OTP: `123456`

### 🏢 Recruiter
- Email: `hr@campusvault.ai`
- OTP: `123456`

---

# 📖 Usage Guide

1. **Start as University Authority** — Login with `admin / admin123`
2. **Issue a credential** — Select student, doc type, fill in value, click Sign & Issue
3. **Copy the Verification ID** — shown after issuance
4. **As a Student** — Login with OTP, view credentials, share via QR or email link
5. **As a Recruiter** — Login with OTP, paste Verification ID → see hash integrity check + status

---

# ⚠ Known Limitations

### 1. Email Service Simulation
OTP and magic links are simulated (console logs only).
**Resolution:** Integrate SendGrid or AWS SES.

### 2. Data Persistence
In-memory store resets on server restart.
**Resolution:** MongoDB or Firebase integration.

### 3. Rate Limiting
Basic rate limiting only.
**Resolution:** Redis-based production throttling.

### 4. Mobile Responsiveness
Dashboard not fully optimized for mobile.
**Resolution:** Dedicated mobile UI components.

---

 
