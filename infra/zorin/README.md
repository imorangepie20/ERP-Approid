# Zorin demo deployment

Scope: an isolated **demo with example business data**, not certification for real accounting,
personal data, or production manufacturing. Existing prototype screens and documented ERP
functional limits still apply. Never import a local development database or its credentials.

## Host and boundaries

- SSH: `approid@192.168.219.174`, Zorin OS 18.1; existing trusted SSH key, no sudo required.
- Public URL: `https://erp.approid.team`.
- Server root: `/home/approid/erp-approid`; Compose project `erp-approid-demo`.
- Origin: **127.0.0.1:9082 only**. DB and Spring publish no host ports.
- Persistent volume: `erp-approid-demo-postgres-data`; database `erp_demo`.
- Cloudflare tunnel: `erp-approid-demo`, ID `c31f7f3f-17d5-4dec-bdbd-526b470eca8c`.
- Tunnel credentials are scoped to this tunnel. The account management certificate remains
  on the Windows operator machine and is NOT copied to the server.
- `deploy/` contains Compose, proxy/tunnel config and management/check scripts.
- `secrets/` is mode 700; `production.env`, `initial-admin.json`, `tunnel.json` are mode 600.
  None belongs in Git, logs, public files, source snapshots or Docker images.
- Images and backups are retained under `artifacts/` and `backups/`; no other project is stopped.

The proxy fixes the upstream HTTPS origin and does not trust client-supplied forwarded headers.
Do not change the loopback binding to `0.0.0.0`. Internal endpoints, actuator and Swagger are
blocked publicly. Login is aggregate-limited per origin peer (Cloudflare connector) to 5/minute
with burst 10. This is intentionally conservative for a single-administrator demo; a busy
multiuser deployment needs validated client-IP trust and per-user protections.

## Release identity and repeat deployments

The initial release `demo-20261004-0812` includes the previously verified **dirty working tree**
based on HEAD `15cf5a5`, including analytics and real Lot trace functionality. It is NOT a clean
HEAD release or evidence of remote CI. Spring reuses the verified image with ID
`sha256:c327fc66f04d42b4c0d854d774d259c797aefc80a766d16f3b2312bec2ec2405`.
Frontend is typechecked and built for the public absolute HTTPS core/analytics URLs. Its image
contains only `dist/`; the runtime proxy config is mounted read-only.

Images have unique release tags; PostgreSQL, Nginx and cloudflared base images use immutable
digests. Preserve the image archive, SHA-256, release manifest and the deployment configs before
any later rollout. Never overwrite a deployed release tag: use a new release identifier.

Before an update, back up the current DB, inspect Flyway history, and ensure the new migrations
are backwards compatible. Change only the ERP release image references. Do NOT run `down -v`,
prune volumes, clear business tables, reuse the initial seed bootstrap or remove other projects.
Capture running non-ERP container names/IDs immediately before each rollout in
`artifacts/<new-release>/existing-containers.txt` (exclude Compose project `erp-approid-demo`).
The verifier uses that release-specific baseline, never the historical first-release IDs:
other projects can legitimately change between ERP releases. Preserve the original baseline.

## First bootstrap (already performed; do not repeat)

1. Generate three independent random secrets plus the administrator handoff with `manage.py init`.
   Exclusive file creation prevents silently replacing credentials.
2. Start only PostgreSQL. Run Spring once without host ports, frontend or tunnel. Flyway seeds
   V1–V15. The prod administrator validator then **intentionally rejects** the development password.
   The expected startup rejection is retained in the private release `bootstrap.log`.
3. `manage.py bootstrap-admin` checks that the DB has only the untouched seed user and 15 successful
   migrations, then replaces its username/password with `approid` and a random bcrypt credential.
   No business seed records are deleted or rewritten. One-time completion marker prevents reuse.
4. Start Spring and frontend; verify health and proxy syntax before starting the tunnel or creating DNS.

Retrieve initial login credentials privately on the server:

```sh
cat /home/approid/erp-approid/secrets/initial-admin.json
```

Do not paste this output into chats or logs. Store the password in your password manager, keep
admin access restricted to the designated operator, and rotate via an approved admin procedure.
The default admin login is no longer valid. Authenticated tokens expire after 60 minutes.

## Commands on the server

```sh
cd /home/approid/erp-approid
alias erp-compose='docker compose --env-file secrets/production.env --env-file deploy/release.env -f deploy/compose.yml'
erp-compose --profile tunnel ps
erp-compose exec frontend nginx -t
python3 deploy/verify.py
python3 deploy/manage.py backup
python3 deploy/manage.py recovery
```

`verify.py` uses the identifiable `ERP-Approid-Deployment-Verify/1.0` User-Agent instead of Python's
default, which received Cloudflare edge 403 responses during the first verification attempt.
It does not change Cloudflare access rules or weaken expected HTTP status checks.
Reports go to `artifacts/<current backend image tag>/verification.json`; `--release <identifier>`
can select the retained release directory explicitly without overwriting the initial report.
Local regressions run with `python -m unittest discover -s infra/zorin -p test_verify.py`.
The same-origin OPTIONS check accepts absent or exactly matching ACAO, since forwarded public
HTTPS/Host makes it a same-origin request. It still rejects wildcard/foreign ACAO, tests actual
authenticated browser reads, and requires a foreign Origin to return 403 without ACAO. See
[Spring CorsUtils](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/web/cors/CorsUtils.html).

`verify.py` tests public TLS, actual bundle URLs, unauthenticated/authenticated endpoints, CORS,
hidden internal/docs routes and login rate limiting. Its final auth check temporarily limits
further login attempts through that connector; allow the bucket to refill before browser login.
It never logs JWTs/passwords or writes business documents. A JSON report is saved under the
release artifacts. Recovery uses a uniquely named temporary DB and drops only that DB afterwards.

## Recovery and rollback

Backups are custom-format binary `pg_dump` files with matching SHA-256. A restore drill checks
the restored item/Lot/migration counts and admin row against the source in a fresh temporary DB.
The original `erp_demo` database is never dropped by the helper.

For an application-only rollback, retain the old release images/config, first stop only the ERP
tunnel, select the old release image references, bring up the app, verify it, and restart the tunnel:

```sh
erp-compose --profile tunnel stop tunnel
# Restore previously retained deploy/release.env and configs after compatibility review.
erp-compose up -d --wait backend-spring frontend
erp-compose --profile tunnel up -d tunnel
```

This is the first ERP release: there is no previous ERP release to roll back to. On failure,
disable only its tunnel and preserve its images/DB/backups for repair; the existing HUD site and
other services are independent. Flyway migrations remain append-only. For a damaged DB, stop
ERP writes, verify a dump checksum, restore to a **new** database and switch the connection only
after validation and operator approval. Do not overwrite the original database automatically.

## Remaining operational/security limits

- 2026-10-04 production npm audit after compatible updates: **high/critical 0, moderate 2**
  (`react-router`/`react-router-dom` 6.30.6). Lodash is patched to 4.18.1 and router engine 1.23.4.
  Remaining advisories involve SSR hydration and untrusted backslash navigation. This is a static
  SPA (no SSR), `src/auth/routes.ts` rejects backslash/protocol-relative/control-character return
  paths, and business drill-downs use fixed internal route prefixes with encoded values. These
  are mitigation observations, NOT proof that all advisory paths are unreachable. Router 7
  migration/security review is follow-up; do not use sensitive production data before review.
  Sources: https://github.com/advisories/GHSA-337j-9hxr-rhxg and
  https://github.com/advisories/GHSA-wrjc-x8rr-h8h6.
- Build/test-only dependencies still have audit warnings and are not shipped in the static runtime.
  No comprehensive backend/base-image CVE scan has been performed by this deployment.
- Local backup/restore is verified, but no off-host encrypted backup retention or automated daily
  backup schedule is configured. The documented production RPO is NOT certified by a local dump.
- Container healthchecks, restart policies and bounded logs exist; centralized logs, alerts,
  uptime monitoring, HA and host reboot recovery have not been exercised.
- Host memory was about 4.2 GiB available with swap nearly full before deployment. ERP resource
  limits cap additional memory; monitor capacity before adding load.

References: [Cloudflare local tunnel setup](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/local-management/create-local-tunnel/),
[Nginx login rate limiting](https://nginx.org/en/docs/http/ngx_http_limit_req_module.html).
