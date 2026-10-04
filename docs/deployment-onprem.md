# On-Premise Deployment

Running the HMS on a hospital LAN, behind the hospital's own DNS and
certificates. The public demo on Render is not the target here -- see
[Deployment profiles](#deployment-profiles) for how the two differ.

---

## Ports

| Port | Bound to | Purpose |
|---|---|---|
| 443/tcp, 443/udp | LAN interface | HTTPS. Caddy. The only port users need. |
| 80/tcp | LAN interface | HTTP, redirected to HTTPS. Needed for ACME if ever using a public CA. |
| 3000/tcp | **nothing** | The app. Not published to the host. Reachable only from Caddy over the internal compose network. |

The app port is intentionally not in `docker-compose.yml`. That is the single
most important line in the file: it means TLS is terminated in exactly one
place and there is no way to bypass it.

If you need to reach the app directly during commissioning — for a health
check from another host, say — port-forward temporarily rather than adding
`ports:` to the compose file:

```bash
ssh -L 3000:127.0.0.1:3000 deploy-host   # then http://localhost:3000
```

---

## Hostname and IP

The app does not care what it is called; it reads nothing from the
environment about its own address. Two things do need to agree:

1. `HMS_HOST` in your `.env` — the name Caddy issues the certificate for.
2. DNS — that name must resolve to the deploy host's LAN address.

```bash
# .env
HMS_HOST=hms.hospital.internal
```

Add a matching DNS record on the hospital's own resolver. If the hospital has
no DNS at all, the hosts file on each workstation works but does not scale
past a handful of machines.

**Reaching it by raw IP** works and needs no configuration, but note that a
certificate cannot be issued for it (below). Browsers will warn on every
machine unless the certificate covers the address, which public CAs will not
do.

### CORS

Same-origin in production — Caddy serves the frontend and proxies the API,
so both are `https://$HMS_HOST`. No `CORS_ORIGINS` needed. Set it only if you
split the frontend onto a separate host:

```bash
CORS_ORIGINS=https://ui.hospital.internal
```

---

## TLS certificates

Pick one. They are mutually exclusive; uncomment one block in
`deploy/Caddyfile`.

### 1. Hospital internal CA — recommended

Most hospitals already run one for AD, wi-Fi and the EMR. Every workstation
trusts it, so there are **zero browser warnings anywhere**.

Ask IT for:

- a **leaf certificate + key** for `hms.hospital.internal`, and
- the **CA root certificate** in PEM form (to distribute to workstations if
  it is not already).

```bash
mkdir -p deploy/certs
# place them, and keep the key readable only by the container user:
cp hospital-hms.pem deploy/certs/hms.pem
cp hospital-hms.key deploy/certs/hms.key
chmod 600 deploy/certs/hms.key
```

Then in `deploy/Caddyfile`:

```
tls /certs/hms.pem /certs/hms.key
```

`deploy/certs/` is git-ignored — a CA private key must never be committed.

If your hospital has **no** CA and no IT department to run one, a small
internal CA is about ten minutes' work and is the right long-term answer. It
is a genuinely better fit than self-signing across 500 workstations.

### 2. Self-signed — for evaluation

```bash
# in deploy/Caddyfile:
tls internal
```

Caddy generates the certificate on first boot and stores it in the `caddy-data`
volume. Every browser will warn until a human trusts it:

| Browser | How |
|---|---|
| Chrome / Edge | Visit the site → Advanced → Proceed. For permanent trust, import the CA under Settings → Privacy and security → Security → Manage certificates. |
| Firefox | Advanced → Accept the Risk and Continue. For permanent trust: Settings → Privacy & Security → Certificates → Import. |
| macOS Safari | Usually follows the system keychain — trust the CA in Keychain Access → System → login keychain → Certificates, set to Always Trust. |
| Windows + Edge | Double-click the CA `.pem` → Install Certificate → Local Machine → Trusted Root Certification Authorities. |

This is fine to evaluate the system. On a real hospital network it becomes an
IT ticket every time a machine is reimaged.

### 3. Plain HTTP — commissioning only

Comment out every `tls` line. Usable on an isolated segment during install.
Do **not** carry real patient data over it, even on a LAN — VLAN boundaries
are misconfigured regularly, and "it's only internal" is how breaches happen.

### Why a public CA won't work

Let's Encrypt, DigiCert and friends will **not** issue a certificate for a raw
IP address or an `.internal` / `.local` hostname. Their policies require a
publicly resolvable DNS name that their own validation servers can reach on
port 443. A hospital LAN generally has neither — private address space, and no
inbound internet.

This is the most common reason an on-prem TLS setup stalls, so: **use the
hospital's internal CA.** If the hospital genuinely has a public DNS name and
inbound access, uncomment the ACME option in the Caddyfile and set
`ACME_EMAIL` in `.env`; Caddy then issues and renews automatically.

---

## Deployment profiles

The same image runs in two modes. `DEPLOYMENT_MODE` selects.

| | `demo` (Render) | `onprem` (hospital) |
|---|---|---|
| Default | `render.yaml` sets it | unset, or set explicitly |
| `DEMO_QUICK_LOGIN` | enabled | **refused at startup** |
| `SEED_DEMO_DATA` | enabled | **refused at startup** |
| `TRUST_PROXY` | `3` (Cloudflare → Render) | unset — trust nothing |
| `PROXY_IP_WARN` | `true` | off |

Outside `demo`, enabling `DEMO_QUICK_LOGIN` or `SEED_DEMO_DATA` **stops the
server from booting** and names the offending variable. That is deliberate:
`DEMO_QUICK_LOGIN` hands a logged-in session — including SuperAdmin — to
anyone who can reach the URL, with no password.

```bash
# What a refusal looks like
$ DEPLOYMENT_MODE=onprem DEMO_QUICK_LOGIN=true npm start
Refusing to start: DEMO_QUICK_LOGIN is enabled but DEPLOYMENT_MODE is "onprem".
...
Fix: set DEMO_QUICK_LOGIN to false, or remove it. For a public demo, set DEPLOYMENT_MODE=demo instead.
```

### TRUST_PROXY on a LAN

Left unset, `req.ip` is the TCP peer — Caddy's container address. That sounds
wrong and is not:

- A client on the LAN **cannot** forge `X-Forwarded-For`, because the header
  is ignored outright. Nobody can put a false address in the audit trail or
  mint a fresh rate-limit bucket by setting a header.
- The cost is that rate limiting is per-proxy rather than per-user. On a
  single-tenant LAN behind one proxy that is the correct trade: the trade you'd
  make the other way round is a forgeable audit identity.

If you put a second proxy in front of Caddy, set `TRUST_PROXY` to the number
of proxies between the browser and the app — `1` for a single extra hop.

---

## First run

```bash
cp .env.example .env
openssl rand -hex 32            # -> JWT_SECRET in .env
# either bootstrap unattended:
#   BOOTSTRAP_ADMIN_USERNAME=hms.admin
#   BOOTSTRAP_ADMIN_PASSWORD=<openssl rand -base64 18>
docker compose up -d --build
docker compose logs -f app
```

Then create the first administrator — either way:

**From the environment** (set both in `.env` before first boot):

```bash
docker compose up -d
docker compose logs app | grep BOOTSTRAP
```

**Interactively**, if you would rather not keep the password in a file:

```bash
curl -k -X POST https://hms.hospital.internal/api/setup/bootstrap-admin \
  -H 'Content-Type: application/json' \
  -d '{"username":"hms.admin","password":"<a strong password>"}'
```

Either route works **once**. As soon as an administrator exists the endpoint
returns `409 BOOTSTRAP_ALREADY_DONE` and the env vars are ignored — a redeploy
can never silently reset a password you have since rotated.

Sign in, **change the password immediately**, then remove
`BOOTSTRAP_ADMIN_*` from `.env`.

Sanity check:

```bash
curl -k https://hms.hospital.internal/api/health
{"status":"operational","db":"connected"}
```

---

## Backup and restore

Everything worth backing up is in the `hms-data` volume: `hospital.db` plus
`uploads/documents`. The container is disposable; the volume is not.

### Backup

Stop the app first. SQLite does not tolerate a copy taken mid-write, and
`-wal` / `-shm` sidecars must be captured together with the database.

```bash
docker compose stop app

BACKUP=/var/backups/hms/$(date +%F-%H%M%S)
mkdir -p "$BACKUP"

# The database and its write-ahead log, copied together.
docker run --rm \
  -v hms-onprem_hms-data:/data:ro \
  -v "$BACKUP":/backup \
  alpine tar czf /backup/hospital-data.tar.gz -C /data .

docker compose start app
```

Verify before you rely on it:

```bash
tar tzf "$BACKUP/hospital-data.tar.gz"
# expect hospital.db, and hospital.db-wal / -shm if they exist
```

### Restore

```bash
docker compose down
docker volume rm hms-onprem_hms-data

docker volume create hms-onprem_hms-data
docker run --rm \
  -v hms-onprem_hms-data:/data \
  -v "$BACKUP":/backup:ro \
  alpine sh -c "cd /data && tar xzf /backup/hospital-data.tar.gz"

docker compose up -d
curl -k https://hms.hospital.internal/api/health
```

> The volume name is prefixed with the compose project name (`hms-onprem`).
> Confirm yours with `docker volume ls | grep hms-data` — it changes if the
> project name does.

**Test a restore before you need one.** An untested backup is a rumour.

### Retention

Keep daily, weekly and monthly. Note that this database contains patient
records, so backups are themselves protected health information — encrypt them
at rest, restrict access, and have a documented retention and disposal policy.
That policy is the hospital's to set with its compliance officer, not
something this application can enforce.

---

## Upgrades and migrations

Migrations run automatically on every boot (`runMigrations()` in
`src/server.js`) and are tracked in `src/config/migrations/` — each file runs
once, recorded in a `migrations` table.

```bash
cd /path/to/hms

# 1. Back up first. Always. See above.
docker compose exec app node -e "console.log('pre-flight ok')"

# 2. Back up the data volume (same command as the backup section above).

# 3. Pull the new code.
git pull

# 4. Rebuild and restart. Migrations run on start.
docker compose up -d --build

# 5. Watch the migration run.
docker compose logs -f app
```

A healthy boot prints:

```
[CONFIG] deployment mode: onprem
[CONFIG] trust proxy: disabled (no trusted proxies) (TRUST_PROXY=unset)
[CONFIG] req.ip resolves to the direct TCP peer; X-Forwarded-For is ignored.
Hospital Management System running on port 3000
```

**These `[CONFIG]` lines are your tripwire.** If the demo is ever started in
on-prem mode by mistake, or `TRUST_PROXY` is wrong, it shows up here rather
than as a quiet audit-trail error months later.

Migrations are forward-only. There is no automated down-migration; rolling
back means restoring the backup taken in step 2. Practically: always take a
backup before an upgrade, and read the migration diff before applying it to a
database holding patient records.

### Rolling back

```bash
git checkout <previous-tag>
docker compose up -d --build
```

Only valid if no migration has since run against the data. If one has,
restore the backup instead — the old code will not understand the new schema.

---

## Troubleshooting

| Symptom | Cause |
|---|---|
| Browser warns about the certificate | Self-signed and not yet trusted. See the table above. |
| `Refusing to start: DEMO_QUICK_LOGIN …` | A demo flag is set in the on-prem profile. Remove it. |
| `TRUST_PROXY="x" is not a value I understand` | Typo. Leave it unset unless you have a proxy chain to count. |
| `JWT_SECRET must be set when NODE_ENV=production` | `.env` not read by compose, or the variable is missing. |
| `BOOTSTRAP_ADMIN_PASSWORD must be at least 12 characters` | Bootstrap refused a weak password. This is intended. |
| Site loads but every API call 404s | `HMS_HOST` does not match DNS, so Caddy is serving for a different name. |
| `429` for everyone at once | Rate limiting is per-proxy. Expected with `TRUST_PROXY` unset; see above. |