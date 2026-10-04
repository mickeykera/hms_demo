# Security Posture

What this system does and does not do about security, as of the current
commit. Written so a hospital's IT and compliance staff can assess it
without relying on vendor claims.

**This document makes no compliance claim.** Nothing here asserts HIPAA,
GDPR, SOC 2, ISO 27001 or FedRAMP conformance, and passing the test suite
does not establish any of them. Compliance is an organizational outcome
covering risk analysis, policy, staff training, access control, vendor
management and incident response — most of which lives outside this
codebase. See "What you still need to provide" below.

Every claim below was verified against the code or by executing it. Where
something is absent, it is listed as absent.

---

## What exists today

### Authentication and access control

| Control | Where | Notes |
|---|---|---|
| Password hashing | `src/config/bootstrapAdmin.js:130`, `src/config/seed.js:332` | bcrypt, cost factor 10. Comparison in `src/server.js:195`. |
| Role-based access control | `src/middleware/rbac.js` | Roles: SuperAdmin, Admin, DepartmentAdmin, Doctor, Nurse, LabTech, Pharmacy, Radiology, OperatingRoom, WardStaff, Billing, Receptionist, HR, Finance, Inventory, Emergency, Patient. |
| Per-permission granularity | `src/config/seed.js` | 44 named permissions (`PATIENT_VIEW`, `AUDIT_LOG_VIEW`, `USER_CREATE`, …) assigned per role, not just per-role booleans. |
| Route-level authorization | module route files | `authorize('Admin','SuperAdmin')` guards on individual routes, e.g. the audit export at `src/modules/audit/routes.js:187`. |
| Account status flag | `users.active` | Set on the users table; disabled accounts exist as a concept. |

### Audit trail

| Control | Where | Notes |
|---|---|---|
| Audit log table | `audit_logs` in `src/config/schema.sql:420` | Records `actor_id`, `action`, `resource_type`, `resource_id`, `details`, `ip_address`, `created_at`. |
| Write middleware | `src/middleware/auditLog.js:28` | `logResourceAction()` records the actor and source IP on any successful (status < 400) mutation. |
| Request log | `src/middleware/logger.js` | Every request logs request ID, resolved IP, user agent, user, and query. |
| Credential redaction in request log | `src/middleware/logger.js:123` | `password`, `password_hash`, `token`, `authorization`, `secret`, `api_key` are replaced with `[REDACTED]`. |
| Audit export | `GET /api/audit/export` | Restricted to Admin/SuperAdmin. |

### Transport

| Control | Where | Notes |
|---|---|---|
| TLS termination | `deploy/Caddyfile` | Caddy terminates TLS; the app port is not published to the host. |
| HSTS, nosniff, frame-deny | `deploy/Caddyfile` | Set as response headers. |
| App unreachable except via Caddy | `docker-compose.yml` | The app service has no `ports:` entry. |

### Deployment safety

| Control | Where | Notes |
|---|---|---|
| Demo features refused on-prem | `src/config/deploymentMode.js` | `DEMO_QUICK_LOGIN` / `SEED_DEMO_DATA` stop the server booting outside `DEPLOYMENT_MODE=demo`. |
| Spoof-resistant client IP | `src/config/trustProxy.js` | Defaults to trusting no proxies; `X-Forwarded-For` is ignored, so a client cannot forge its audit identity. |
| First-run admin | `src/config/bootstrapAdmin.js` | Creates one SuperAdmin once; refuses weak passwords and well-known usernames. |
| JWT secret required in production | `src/server.js:79` | Refuses to boot without it. |
| SQL parameterisation | throughout | Prepared statements with bound parameters. |

### Frontend

No external network requests. No analytics, no telemetry, no CDN, no webfonts.
Verified against the built bundle — see the frontend audit in
[deployment-onprem.md](./deployment-onprem.md#frontend-network-audit). The UI
works on an air-gapped LAN.

---

## What does NOT exist

These are gaps, not oversights to be waved away. Each needs an operational
answer before the system handles real patient data.

### Encryption at rest — absent

The SQLite database is **plaintext on disk**. There is no SQLCipher, no
`PRAGMA key`, no application-level field encryption.

Anyone who obtains `hospital.db` — a stolen laptop, a backup tape, a
misconfigured file share — reads every patient record directly. Backups and
snapshots inherit the same exposure.

*Mitigation is operational:* full-disk encryption on the host, encrypted
volume for `/data`, and physical control of the backup media.

### Backup encryption — absent

The backup procedure in [deployment-onprem.md](./deployment-onprem.md#backup-and-restore)
produces an **unencrypted tarball**. Backups of patient data are themselves
protected health information and need encryption at rest and in transit.

*Mitigation is operational:* encrypt the backup destination (dm-crypt, LUKS,
encrypted network share) and restrict access to backup operators.

### Audit retention policy — absent

The `audit_logs` table grows without bound and is **never purged or rotated**.
There is no retention period, no archival, and no tamper evidence — an
administrator with database access can edit or delete audit rows, and nothing
in the schema or code detects that.

Note also that `details` stores the full serialised request body. It is not
redacted (unlike the request logger), so it will capture whatever a route
sends. No route currently sends a password field through
`logResourceAction`, but that is a property of today's routes rather than a
guarantee enforced by the middleware.

*What you still need:* a retention period set by your compliance officer, a
mechanism to enforce it, and somewhere tamper-evident to keep audit records.

### Session timeout — partially closed

Tokens carry `expiresIn: '8h'` (`src/server.js`). An **idle** timeout of 15
minutes now signs the user out of the browser (`frontend/src/utils/idleSession.js`),
which covers the realistic ward risk: a clinician who walks away from a shared
workstation.

What is still absent, and it is the more serious half:

- **The token is not invalidated server-side.** The idle timer is client-side
  only, so a stolen token remains valid until its 8h expiry.
- **Closing a laptop lid without signing out leaves a still-authenticated
  browser.** A restored tab keeps its token in `localStorage`.
- **No absolute session limit** independent of the token's fixed expiry.

Server-side idle enforcement (short-lived activity claim, re-issued on
activity) is the remaining work and was deliberately deferred: it changes what
the auth middleware trusts and how long tokens live, which warrants its own
review rather than being folded into a timeout ticket.

### Login lockout — present

Five consecutive failures locks an account for fifteen minutes, persisted in
`login_attempts` (`src/config/loginLockout.js`). An in-memory counter would be
cleared by a restart, which on Render's free tier is routine.

The lockout response is byte-identical to a wrong password. That is deliberate:
lockout is a denial-of-service vector, and anyone who knows a colleague's
username could otherwise lock them out of a clinical system at will. A
SuperAdmin-only route clears a lock.

Not covered: no lockout by IP for a nonexistent username, so username
guessing is bounded per-account but not globally.

### Forced password change — present

`must_change_password` blocks every endpoint except four allow-listed routes
(`src/middleware/rbac.js`). Set on first-run bootstrap and on admin reset;
defaults to 0 so upgrading a live install does not lock out existing users.

A user can now change their own password (`POST /api/auth/change-password`),
which did not exist before — the feature was unimplementable without it.

Not covered: no password expiry for accounts created through the UI, and no
password policy applied to accounts created after the bootstrap admin.

### Other gaps worth knowing

| Gap | Detail |
|---|---|
| No MFA / second factor | Single password per account. |
| No global brute-force bound | Per-account lockout exists; there is no IP-level throttle on `/api/auth/login`, so username enumeration across many accounts is not bounded globally. |
| No password expiry or complexity policy for users | Only the bootstrap admin is validated; accounts created later are not subject to the same rules. |
| No CSRF protection | The API is JWT-in-header rather than cookie-based, which limits the exposure, but there is no explicit CSRF token. |
| No file-upload content validation | Documents are stored under `UPLOAD_DIR`; treat that volume as untrusted input. |
| No vulnerability scanning in CI | No SAST, dependency audit or image scan is wired up. |
| No TLS on the app itself | Plain HTTP inside the compose network. Acceptable only because the app is not exposed; if someone publishes port 3000, traffic is unencrypted. |

---

## What you still need to provide

Compliance is mostly not software. Before handling real patient data, a
hospital needs, at minimum, and independently of this application:

1. A **risk analysis** covering the system in its actual environment.
2. **Policies** for access control, password standards, device use and
   physical security, agreed with the compliance officer.
3. **Staff training**, including shared-workstation handling.
4. An **incident response plan** with a named owner and contact path.
5. **Backup, retention and disposal policies** for both data and backups,
   including the encryption the application does not provide.
6. **Vendor and third-party review** of anything this system connects to.
7. **Business associate agreements** where required.
8. A **configuration baseline** — which `DEPLOYMENT_MODE`, which
   `TRUST_PROXY`, which ports published — recorded and re-checked on upgrade.

The application's own configuration is one input to all of this. Setting it
correctly is necessary but not sufficient.

---

## Verifying this document

The "what exists" claims are checkable:

```bash
# bcrypt cost factor
grep -rn 'hashSync' src/ --include=*.js

# RBAC surface
grep -c 'name:' src/config/seed.js        # permissions + roles + departments

# redaction list
grep -n 'sensitiveFields' src/middleware/logger.js

# audit table shape
grep -nA12 'CREATE TABLE IF NOT EXISTS audit_logs' src/config/schema.sql

# token lifetime
grep -rn 'expiresIn' src/server.js

# the absences
grep -rniE 'sqlcipher|pragma key' src/ || echo 'no encryption at rest'
grep -rniE 'blacklist|revoke' src/   || echo 'no token revocation'
grep -rniE 'retention|purge' src/modules/audit/ || echo 'no audit retention'
```