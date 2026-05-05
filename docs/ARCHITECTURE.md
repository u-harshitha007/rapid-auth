# 🏗️ RapidAuth Architecture Deep-Dive

## 🔐 Centralized Hash Anchoring Pattern

RapidAuth uses a **server-side cryptographic verification engine** instead of blockchain. Every credential is processed through a two-step pipeline:

1. **SHA-256 Hashing** — The document payload (studentId, docType, value, issuer, issuedAt) is canonicalized as JSON and hashed using SHA-256. This produces a 64-character hex digest that is unique to the exact document contents.

2. **HMAC-SHA256 Signing** — The hash is signed using HMAC-SHA256 with the institution's secret key. This proves the document was issued by an authorized party, without requiring a blockchain wallet.

### Verification Flow
```
Recruiter submits verificationId
        ↓
Backend fetches stored record
        ↓
Re-computes SHA-256 hash of original document fields
        ↓
Compares with stored hash
        ↓
✅ Match  → VERIFIED   |   ❌ Mismatch → TAMPERED
```

### Benefits
1. **No wallet required** — Issuers log in with credentials, not crypto wallets.
2. **Zero transaction cost** — No gas fees or testnet dependency.
3. **Instant verification** — Sub-100ms response vs. blockchain indexer latency.
4. **Tamper detection** — Any modification to the document data produces a different hash.

---

## 🛡️ Zero-Trust Identity Flow

RapidAuth implements a layered access control system:

1. **Authority** — Password-protected admin login. Credentials never leave the server session.
2. **Student** — Email + OTP login (no private key or wallet needed).
3. **Verifier/Recruiter** — Email + OTP login. Can only view public/shared credentials.

Dynamic tokens (QR codes, magic links) carry time-bound, signed payloads and expire automatically to prevent replay attacks.
