# PulseClinic Pharmacy — Production Operations Runbook

## 1. System Health & Monitoring
- **Health Check Endpoint:** `GET /api/v1/admin/health`
  - Returns `HTTP 200` with database latency and memory stats.
- **Vercel Cron Scheduled Job:** `POST /api/v1/jobs/cron/daily-check`
  - Requires header `x-cron-secret: <CRON_SECRET>` or admin token.
  - Automatically scans inventory for low stock ($\le 20$ units) and near-expiry batches ($\le 90$ days).
  - Processes pending outbox email delivery queue.

---

## 2. Disaster Recovery & Backup Runbook (RSK-023, RSK-024)

### Creating Daily Snapshot
Run point-in-time snapshot export:
```bash
npx tsx scripts/backup-firestore.ts
```
Outputs SHA-256 verified archive to `backups/pulseclinic_backup_<storeId>_<timestamp>.json`.

### Emergency Dry-Run Restore Verification
Verify backup integrity and simulate document recovery:
```bash
npx tsx scripts/restore-firestore.ts
```
Verifies 100% document ID matches and integrity hash.

---

## 3. Incident Response Playbooks

### Incident 1: Operator Reached Rate Limit (HTTP 429)
- **Symptom:** Client receives `"Too many requests. Rate limit exceeded."`
- **Mitigation:**
  - Headers `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` indicate seconds until bucket reset.
  - Temporary rate limit adjustment in `apps/api/src/server.ts` if high concurrent POS terminals are active on a single NAT IP.

### Incident 2: Thermal Printer Format Misalignment
- **Symptom:** Receipt content clipped or page break issues on 80mm roll.
- **Mitigation:**
  - Standard thermal receipt layout uses `@media print` rules in `Receipt80mmTemplate.tsx`.
  - Ensure browser print dialog margins are set to **"None"** and paper size set to **"80mm"** or **"Roll Paper"**.

### Incident 3: Refund OTP Lockout (3 Failed Attempts)
- **Symptom:** Cashier enters incorrect OTP 3 times; system returns `"Maximum verification attempts exceeded. Request locked."`
- **Mitigation:**
  - Locked requests cannot be unlocked (forensic security invariant).
  - Operator must click **"Request Refund"** again to issue a fresh OTP to the Super Admin.

---

## 4. Environment Variables Reference

| Variable | Description | Production Rule |
| :--- | :--- | :--- |
| `NODE_ENV` | Runtime environment (`production`, `staging`, `development`) | Must be `production` |
| `FIREBASE_PROJECT_ID` | GCP Project ID | Must match `pulseclinic-prod` |
| `HMAC_SECRET` | Secret key for 8-char OTP hashing | Non-default, $\ge 16$ characters |
| `OUTBOX_ENCRYPTION_KEY` | AES-256-GCM symmetric encryption key | Exactly 32 bytes (256-bit) |
| `CRON_SECRET` | Secret key authenticating scheduled cron invocations | Strong secret, $\ge 16$ characters |
| `NEXT_PUBLIC_API_URL` | Express API gateway URL for Next.js frontend | Must use HTTPS custom domain |
