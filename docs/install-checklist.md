# On-Premise Installation Checklist

For the person actually standing this up in a hospital. Work top to bottom.
Every item is either **mandatory before patient data** or **strongly
recommended**.

**Record who signs off each section.** A checklist with no names against it
is not evidence of anything.

| Section | Owner | Date | Initials |
|---|---|---|---|
| 1. Host preparation | | | |
| 2. Disk encryption | | | |
| 3. Backups | | | |
| 4. Time synchronisation | | | |
| 5. Firewall | | | |
| 6. Naming a responsible person | | | |
| 7. Application install | | | |
| 8. First administrator | | | |
| 9. TLS | | | |
| 10. Acceptance test | | | |

---

## 1. Host preparation — mandatory

- [ ] A dedicated host or VM. Not a general-purpose file server.
- [ ] Disk sized for the database **plus** document uploads **plus** 3×
      working headroom. Uploaded documents are stored under `/data` and are
      not deduplicated.
- [ ] Host clock correct (see section 4).
- [ ] Host on the network segment approved for clinical systems.
- [ ] Outbound internet access **not required** for the app to run. If the
      host needs internet for updates, route it through the hospital proxy
      rather than allowing direct egress.
- [ ] Record the hostname and IP address; add DNS for the hostname (see
      [deployment-onprem.md](./deployment-onprem.md#hostname-and-ip)).

**Segment:** the host should be on a VLAN reachable by clinical workstations
but not by guest wireless or the public network. The application trusts its
local network for access control, so network placement is a security control,
not just an IT preference.

---

## 2. Full-disk encryption — mandatory before patient data

The application stores the SQLite database and all uploaded documents in
plaintext under `/data`. There is **no application-level encryption** — see
[security-posture.md](./security-posture.md). Disk encryption is the only
thing standing between a stolen drive and every patient record.

- [ ] Encrypt the host disk (LUKS/cryptsetup, BitLocker, or the hypervisor's
      equivalent).
- [ ] **Prefer also encrypting the `/data` volume separately** if it is a
      separate disk or network mount. This lets you re-provision the host
      without rewriting every patient record, and lets you verify encryption
      independently of the OS install.
- [ ] Record the recovery key in the hospital's key management system. A lost
      key means permanent data loss.
- [ ] Verify, do not assume:

```bash
# Should show "crypto_LUKS" (or the platform equivalent)
lsblk -f | grep -A1 crypt
findmnt /var/lib/docker

# Should show "crypt" as the source filesystem type
findmnt -no SOURCE,FSTYPE /var/lib/docker
```

If the output does not say `crypt`, **stop**. Do not proceed to install.

---

## 3. Backups — mandatory before patient data

The database is the only irreplaceable thing here; the container can be
rebuilt, the volume cannot.

- [ ] Backups go **off-host**. A backup on the same disk protects against
      nothing that matters.
- [ ] Backups are **encrypted**. The backup procedure writes an unencrypted
      tarball. Encrypt at the destination (encrypted volume, encrypted network
      share, or client-side `age`/`gpg`).
- [ ] Retention agreed with the compliance officer: a suggested starting point
      is daily for 30 days, weekly for 12 months, monthly per policy.
- [ ] Backups are access-controlled, because **a backup of patient data is
      itself patient data**.
- [ ] **A restore has been performed successfully on a separate machine.**
      An untested backup is not a backup. Record the date and who did it.
- [ ] Backup failure is monitored. A backup that silently stopped three weeks
      ago is worse than none, because it is trusted.

```bash
ls -lht /var/backups/hms/ | head                        # confirm it ran recently
tar tzf "$(ls -t /var/backups/hms/*.tar.gz | head -1)" # confirm restorable
```

---

## 4. Time synchronisation — mandatory

`audit_logs.created_at` is `CURRENT_TIMESTAMP` from SQLite and every log line
is stamped from the host clock. If the clock drifts, the audit trail cannot
correlate with anything else — including the hospital's own network and EMR
logs — which is most of its value.

- [ ] NTP (or chrony) configured against the hospital's time source, not a
      public pool.
- [ ] Timezone set deliberately. Timestamps are stored in UTC; document the
      local offset.

```bash
timedatectl status          # "System clock synchronized: yes"
chronyc tracking            # or: ntpq -p
```

---

## 5. Firewall — mandatory

- [ ] Inbound: 443/tcp and 443/udp from approved clinical subnets only.
- [ ] Inbound: 80/tcp only if using ACME (a public CA). Not required with an
      internal CA or a self-signed certificate.
- [ ] **Port 3000 must NOT be open to anything**, including the host's own
      LAN. It is deliberately unpublished in `docker-compose.yml`; the
      firewall is the second line of defence if someone adds `ports:`.
- [ ] Outbound: no requirement at runtime. Restrict to the hospital proxy.

```bash
ss -tulpn | grep -E ':(80|443|3000)\b'
ss -tulpn | grep 3000 || echo "OK: nothing listening on 3000"
```

---

## 6. Naming a responsible person — mandatory

This is the item most often skipped, and the one that determines whether any
of the above is still true in a year.

- [ ] **One named individual** is responsible for updates and backups. A
      person, not a department. "IT Operations" is not a person.
- [ ] A **deputy** named as well, for leave and holidays.
- [ ] Both have been briefed on the restore procedure.
- [ ] Their contact details are recorded somewhere the hospital will still
      have in three years.
- [ ] A recurring calendar reminder exists for checking upstream releases
      and security advisories.

**Record here:**

| Role | Name | Contact | Deputy |
|---|---|---|---|
| Updates & backups | | | |
| TLS certificates (expiry) | | | |

---

## 7. Application install — mandatory

- [ ] `.env` created from `.env.example`, with `JWT_SECRET` set to a
      generated value.
- [ ] `DEPLOYMENT_MODE=onprem`. The server **refuses to start** if
      `DEMO_QUICK_LOGIN` or `SEED_DEMO_DATA` are also set — that refusal is a
      safety net, not a problem to work around.
- [ ] `TRUST_PROXY` left **unset**. On a LAN the correct answer is to trust
      nothing.

```bash
cp .env.example .env
echo "JWT_SECRET=$(openssl rand -hex 32)" >> .env
chmod 600 .env
docker compose up -d --build
docker compose logs app | grep -E 'CONFIG|BOOTSTRAP'
```

Expected in the log:

```
[CONFIG] deployment mode: onprem
[CONFIG] trust proxy: disabled (no trusted proxies) (TRUST_PROXY=unset)
```

Anything else means the profile is wrong — stop and fix it before going
further.

---

## 8. First administrator — mandatory

- [ ] Created via `BOOTSTRAP_ADMIN_*` in `.env`, or the interactive endpoint.
- [ ] Username is **not** `admin`, `superadmin` or `root`; the bootstrap
      refuses these.
- [ ] Password is at least 12 characters and is not the username. Generate:
      `openssl rand -base64 18`.
- [ ] Password changed immediately after first sign-in.
- [ ] `BOOTSTRAP_ADMIN_*` **removed from `.env`** afterwards. The account is
      only created once, so leaving them there is harmless, but it leaves a
      credential on disk.

---

## 9. TLS — mandatory

- [ ] Certificate obtained: hospital internal CA (recommended), self-signed
      (evaluation only), or a public CA where the hospital has public DNS.
- [ ] **Understood that a public CA cannot issue for a raw IP or an
      `.internal` name.** See
      [deployment-onprem.md](./deployment-onprem.md#why-a-public-ca-wont-work).
- [ ] Certificate expiry date recorded, and a reminder set. An expired
      certificate looks like an outage to every user.
- [ ] Root CA distributed to clinical workstations so browsers trust it
      without a warning.

---

## 10. Acceptance test — mandatory

Run `scripts/onprem-smoke-test.sh` from a **clean VM**, and repeat the HTTPS
check from a **second device** on the LAN.

- [ ] `docker compose up` succeeds on a clean host.
- [ ] First administrator can be created.
- [ ] HTTPS works from a different device, with no browser warning.
- [ ] A backup is taken and **restored successfully**.
- [ ] An upgrade applies cleanly, and the rollback path is understood.

- [ ] Sign-off recorded: installed by / accepted by, with dates.

---

## If something is wrong

| Symptom | First check |
|---|---|
| Server refuses to start | Read the refusal message — it names the offending variable. |
| Browser certificate warning | Section 9; the root CA is not trusted on that machine. |
| Every API call 404s | `HMS_HOST` does not match DNS. |
| `429` for everyone at once | Expected with `TRUST_PROXY` unset; rate limiting is per-proxy. |
| Restore fails | Volume name is prefixed with the project name; check `docker volume ls`. |

More detail: [deployment-onprem.md](./deployment-onprem.md),
[security-posture.md](./security-posture.md).