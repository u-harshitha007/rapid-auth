# Offline Verification

Placeholder — implementation in progress.

## Goal
Allow credential verification to work without a live internet connection or blockchain API.

## Planned flow
1. Admin issues credential on-chain as usual
2. Student generates a QR / magic link carrying a signed proof payload
3. Verifier scans QR — app checks signature locally using trusted issuer public key
4. App checks token expiry locally
5. App checks cached revocation list — revoked credentials fail without a network call
6. If internet is available, app additionally confirms live blockchain status
7. If anything fails, falls back safely without breaking the whole flow

## Files (to be created)
- `service.js`   — offline proof generation and local verification logic
- `routes.js`    — Express routes for offline proof endpoints
- `controller.js`— HTTP handlers
