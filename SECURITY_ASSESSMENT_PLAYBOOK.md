# Living Web Security Assessment Playbook

**Purpose:** A reusable method for assessing, defending, and safely exercising
any web application. Use it for Lorki or a new project by copying the
engagement template, defining the target, and retaining the evidence produced
at each stage.

**Version:** 1.0  
**Owner:** Security owner / engineering lead  
**Review cadence:** after every assessment, incident, material architecture
change, and at least quarterly.

This is a living playbook, not a claim that an application is "secure." It
defines repeatable work, safe boundaries, evidence, and a feedback loop so the
program improves as the application and threat landscape change.

## 1. The three disciplines

| Discipline | Question answered | Output |
| --- | --- | --- |
| Pentest | "Can a weakness be exploited in the approved scope?" | Reproducible findings, impact, and proof of fix |
| Blue team | "Can we prevent, detect, contain, and recover?" | Hardened controls, alerts, runbooks, exercises |
| Red team | "Would our people and defenses detect a realistic attacker path?" | Attack-path narrative, detection gaps, debrief |

They reinforce each other. A pentest finds a rate-limit bypass; the blue team
fixes it and adds an alert; a later red-team exercise verifies that attempted
abuse is detected and handled. Red teaming is **not** a bigger pentest: it is a
carefully authorized adversary simulation with operational safety constraints.

## 2. Non-negotiable authorization and safety gates

Never begin active testing until the engagement owner signs the rules of
engagement (RoE). Written approval is required for every environment and
external service in scope, including domains, APIs, cloud accounts, payment
providers, email providers, mobile apps, and third-party integrations.

### 2.1 Required RoE fields

Copy this block into every engagement record.

```text
Engagement name:
Business owner / technical owner:
Testing lead and contact:
Start/end time and timezone:
Approved targets (hostnames, IPs, repositories, cloud accounts):
Approved environments (local, dev, staging, production):
Explicitly excluded targets and integrations:
Allowed techniques:
  [ ] passive discovery     [ ] authenticated testing
  [ ] rate/concurrency tests [ ] file upload tests
  [ ] DAST scanning          [ ] social engineering
  [ ] cloud/config review    [ ] red-team simulation
Rate, concurrency, and time limits:
Test accounts and test payment data:
Data handling and retention rules:
Notification model (announced / partial knowledge / blind):
Emergency stop authority and contact:
Escalation contacts:
Approval signatures and date:
```

### 2.2 Default safety rules

- Start locally, then use staging. Test production only with explicit,
  time-bounded approval.
- Use synthetic identities, test cards, test webhooks, and disposable data.
- Prefer passive inspection and low-rate validation before active checks.
- Do not exfiltrate real secrets or personal data. Demonstrate access with the
  minimum evidence necessary, then stop.
- Do not run denial-of-service, destructive payloads, phishing, persistence,
  malware, or lateral-movement techniques unless explicitly approved in the
  RoE and supported by a rollback/incident plan.
- Stop immediately on unexpected customer impact, sensitive-data exposure,
  service degradation, or a request from the emergency contact.

## 3. Engagement lifecycle

```text
Authorize → map assets → model threats → test → validate impact
→ fix → retest → monitor → exercise → learn → update this playbook
```

Each arrow has an artifact: signed RoE, asset list, threat model, findings,
pull requests, regression tests, dashboards/alerts, exercise report, and
retrospective. No finding is considered closed merely because a scanner no
longer reports it; closure requires a verified control and regression proof.

## 4. Preparation and asset inventory

Before testing, record the target architecture. The same workflow works for a
Next.js app, a Rails application, an API-only service, or a static site; only
the concrete routes and tools differ.

### 4.1 Inventory checklist

- Domains, subdomains, IPs, ports, CDN/WAF, reverse proxies, load balancers.
- Web pages, APIs, GraphQL endpoints, WebSockets, mobile clients, admin areas.
- Identity model: roles, permissions, SSO, MFA, session/cookie/token design.
- Data stores, queues, object storage, uploads, caches, search indexes.
- Money or irreversible workflows: checkout, payouts, refunds, inventory,
  reservations, account deletion, privilege changes.
- Trust boundaries: third-party webhooks, OAuth callbacks, email links,
  external URLs, server-side fetches, CI/CD, cloud IAM, secrets.
- Observability: structured logs, audit records, alerts, uptime and error
  dashboards, backup/restore processes.

### 4.2 Lightweight threat model

For every high-value flow, document:

```text
Asset:             What must be protected?
Actor:             Customer, admin, employee, vendor, attacker?
Entry point:       Route, webhook, upload, queue, support tool?
Trust boundary:    What changes trust level or crosses systems?
Abuse case:        What happens if authorization/validation fails?
Control:           Prevention + detection + recovery control
Test:              How will the control be verified?
Owner:             Who fixes and monitors it?
```

Prioritize account takeover, administrative actions, funds, personal data,
secrets, inventory, and cross-tenant/ownership boundaries before cosmetic
issues.

## 5. Pentest workflow

Pentesting combines safe automated coverage with manual validation. Automated
tools create leads; a human confirms exploitability, scope, and business
impact.

### 5.1 Phase A — passive and low-impact baseline

| Check | Useful tools | Evidence to retain |
| --- | --- | --- |
| Exposed ports/services | Nmap | Commands, ports, service versions |
| HTTP headers/TLS/cookies | Burp, ZAP, browser devtools | Response headers/screenshots |
| Dependency advisories | npm audit, Dependabot, Snyk/OSV | Lockfile version and advisory IDs |
| Source patterns/secrets | Semgrep, CodeQL, Gitleaks | Rule version, sanitized finding |
| Route/API inventory | OpenAPI, Burp sitemap, ffuf (approved) | Endpoint and method inventory |
| Configuration review | IaC scanner, cloud console review | Approved configuration evidence |

Use Nmap to discover network exposure, not to judge application logic. Use
ZAP/Burp to inspect web behavior. Use source and dependency scanning because
many risks are invisible from HTTP alone.

### 5.2 Phase B — authentication and authorization

Create at least one test identity per role, plus disabled, unverified, and
recently changed-role identities where applicable.

- Test unauthenticated access to every protected page and API method.
- Test horizontal access: substitute another user's, tenant's, artist's, or
  organization's resource ID in GET, POST, PATCH, DELETE, export, and upload
  routes (IDOR/BOLA).
- Test vertical access: attempt low-role actions against staff/admin routes.
- Test role changes, logout, password reset, disabled accounts, and session
  invalidation. Existing sessions must not retain revoked privileges.
- Validate redirect parameters against open redirects and validate OAuth/state
  callback handling.
- Check cookie flags in production (`Secure`, `HttpOnly`, `SameSite`) and
  session rotation after login/privilege changes.

### 5.3 Phase C — input, browser, and API security

Use harmless markers first, such as a unique string or an inert HTML fragment.
Do not attempt payloads that could affect other users without permission.

- Stored, reflected, and DOM XSS in every editable text, rich-text, URL,
  image, email, and admin field. Confirm the rendering context, not merely
  input validation.
- SQL/ORM/NoSQL injection, command injection, template injection, path
  traversal, and deserialization risks where data reaches an interpreter.
- SSRF through URL fetchers, image importers, webhook targets, PDF generators,
  metadata previews, and cloud callbacks. In staging, use an approved
  controlled listener rather than internal addresses.
- CSRF for every state-changing browser route. Test Origin/Referer behavior,
  cookie settings, and non-browser API clients separately.
- CORS: verify exact allowed origins, methods, headers, credentials, and
  preflight behavior. Never treat `*` plus credentials as acceptable.
- Content Security Policy, clickjacking protection, MIME sniffing protection,
  referrer and permissions policies. Test the production build, not only dev.

### 5.4 Phase D — abuse, concurrency, and business logic

These tests frequently uncover the most important web-application bugs.

- Rate limits: sequential and concurrent attempts; separate identifiers, IPv4
  and IPv6, forwarded-header behavior, reset-window boundaries, and success
  versus failure paths.
- Idempotency: duplicate browser retries, duplicate webhook deliveries,
  missing keys, same key/different body, concurrent same-key requests, and
  guest versus authenticated scopes.
- Race conditions: checkout, reservation, inventory, refund, payout, coupon,
  signup, password-reset, and privilege-change workflows.
- State-machine violations: invoke actions out of sequence, replay old actions,
  retry failures, and test cancellation/refund/chargeback ordering.
- Numeric boundaries: zero, negative, huge values, rounding, currency units,
  integer overflow, timezone/expiry boundaries, and pagination limits.
- Error behavior: malformed JSON, duplicate requests, timeouts, provider
  outage, database failure, queue retry, partial success, and safe error text.

### 5.5 Phase E — uploads and integrations

- Upload size, extension, MIME type, magic bytes, polyglots, SVG/script
  content, image processing, filenames, traversal, storage ACLs, and download
  authorization.
- Verify uploads are served from a separate origin or with safe content types
  where possible. Scan and quarantine according to the application's risk.
- Webhooks: missing/invalid/expired signatures, replay, timestamp tolerance,
  duplicate event IDs, event ordering, secret rotation, and idempotent event
  handling.
- Payment systems: use provider test mode only; test valid and invalid signed
  events, double delivery, delayed events, partial refunds, and reconciliation.

## 6. Blue-team hardening and operations

Every confirmed pentest finding must receive prevention, detection, and
recovery consideration.

### 6.1 Prevention baseline

- Patch dependencies through reviewed, tested updates; use lockfiles and
  automated advisory monitoring.
- Enforce server-side authorization for every resource and transition.
- Validate and normalize input at the boundary; encode output for its context.
- Manage secrets outside source control; rotate on exposure or staff changes.
- Use least privilege for databases, object storage, CI/CD, and cloud IAM.
- Require trusted reverse proxies to overwrite forwarded headers; never trust
  client-supplied forwarding headers at a directly exposed app process.
- Apply secure headers, HTTPS, secure cookies, request limits, backups, and
  tested restoration procedures.

### 6.2 Detection baseline

- Structured application logs with request/correlation IDs; never log tokens,
  passwords, payment data, or unnecessary personal data.
- Immutable audit logs for role changes, refunds, payouts, settings, exports,
  and security-sensitive administration.
- Alerts for authentication failures, rate-limit spikes, authorization denials,
  unusual export/download volume, webhook failures/replays, payment mismatch,
  error spikes, and unexpected configuration changes.
- Dashboards for availability, latency, background jobs, provider callbacks,
  database saturation, and security alerts.

### 6.3 Response and recovery

Maintain application-specific incident runbooks, owners, communication paths,
secret-rotation procedures, backup restoration tests, and post-incident
review. Test runbooks with tabletop exercises; a runbook that has never been
used is an assumption, not a control.

## 7. Authorized red-team exercises

Red-team work starts only after pentest remediation and blue-team telemetry
exist. Its objective is to measure realistic detection and response, not to
cause disruption or "win."

### 7.1 Design an exercise

- Choose one or two business-relevant objectives, such as access to a test
  admin account, test customer export, test payout action, or staging secrets.
- Define exclusions: production customers, real payment actions, destructive
  changes, persistence, phishing, vendor systems, and physical access unless
  separately approved.
- Decide disclosure: fully announced, blue team knows a window only, or
  selected leadership only. Keep an emergency stop channel available.
- Use test accounts/data, explicit success criteria, timestamps, and an
  evidence recorder.
- Have the blue team independently triage alerts and follow the incident
  process. Do not conceal safety-critical information.

### 7.2 Red-team debrief

Document the attempted path, controls encountered, detection timestamps,
decision quality, containment time, communication quality, and concrete
remediation. Convert each gap into an owned backlog item and a future test.

## 8. Finding standard and severity

Every finding should be actionable without relying on private chat context.

```text
ID / title:
Date / environment / assessor:
Severity and rationale:
Affected asset and preconditions:
Description:
Minimal safe reproduction steps:
Observed result and sanitized evidence:
Business impact:
Root cause:
Recommended remediation:
Detection/monitoring recommendation:
Owner / target date:
Fix reference:
Retest date, method, and outcome:
```

Rate severity by realistic impact and likelihood in the approved environment:

- **Critical:** immediate material compromise of many accounts, secrets, funds,
  or core infrastructure; escalate immediately.
- **High:** practical unauthorized access, significant data exposure, payment
  abuse, or reliable bypass of an important control.
- **Medium:** meaningful weakness requiring preconditions, limited scope, or a
  defense-in-depth gap.
- **Low:** limited impact, hard-to-exploit issue, or improvement opportunity.
- **Informational:** observation with no demonstrated security impact.

## 9. Retesting and release gates

For every fix:

1. Add a regression test at the lowest useful level (unit, integration, or
   browser/API test).
2. Reproduce the original safe proof in the same environment.
3. Test nearby variants and failure paths; fixes often move a bug rather than
   eliminate it.
4. Review migrations, configuration, and deployment effects.
5. Record the evidence and close only after the owner accepts residual risk.

Minimum release gate for high-risk changes: code review, automated tests,
dependency audit, static analysis, secrets scan, security-header check, and
targeted authorization/business-logic regression coverage.

## 10. Keeping the playbook current

Security methods age. Treat this document like production code.

### 10.1 Update triggers

- A new vulnerability class, incident, near miss, or assessment finding.
- New framework, identity provider, cloud provider, payment provider, or data
  classification.
- A material change to architecture, deployment, threat model, or regulation.
- A new tool/rule/template that produces useful, validated findings.
- A false positive, unsafe test behavior, or process failure that needs a
  safer default.

### 10.2 Change process

1. Add the learning to the assessment retrospective.
2. Propose a small, dated update with rationale and owner.
3. Validate it in a local or staging exercise before making it mandatory.
4. Update checklists, tool versions, templates, and training together.
5. Record the version/date in the engagement report.

Avoid tool-driven theater: retain a tool or scanner only when its findings are
actionable, its rules are maintained, and its use fits the authorized scope.

## 11. Per-project assessment record template

```markdown
# [Project] security assessment — [date]

Playbook version:  
RoE approval:  
Scope and exclusions:  
Architecture / asset inventory:  
Threat-model priorities:  
Tools and versions:  
Tests performed and evidence location:  
Findings (open / fixed / accepted risk):  
Dependency and configuration results:  
Blue-team alerts/runbooks verified:  
Red-team exercise status (if authorized):  
Residual risks and next review date:  
```

## 12. Lorki starting references

- Current findings and local verification: `SECURITY_AUDIT_2026-09-21.md`
- Existing application hardening history: `AUDIT_AND_FIXES.md`
- Operational response procedures: `INCIDENT_RESPONSE_RUNBOOK.md`

For Lorki's next cycle, prioritize the remaining authorization/IDOR, upload,
payment/webhook replay, production-proxy, and production-build checks listed
in the current security audit before authorizing a red-team exercise.

---

# Appendix A — Beginner operator runbook

This appendix is written for an intern or new engineer working without an AI
assistant. Follow it in order. It intentionally uses low-impact methods and a
local/staging target. If any instruction conflicts with the signed RoE, the RoE
wins.

## A.1 What you need before starting

### Permission

You need all of the following in writing:

1. The target owner approves the work.
2. The exact URL/environment is named in the RoE.
3. You know the emergency contact and stop instruction.
4. You have test accounts for the relevant roles.
5. You know whether the target is local, staging, or production.

If any answer is missing, **do not test**. Ask the engagement owner. Never
assume a public-looking website is authorized just because you can reach it.

### Workstation tools

The examples below assume Linux, Docker, Git, a browser, and a shell. Install
tools through your organization's approved package process. Docker commands
are used where possible so tools do not need permanent host installation.

| Tool | Why it is used | Beginner-safe use in this playbook |
| --- | --- | --- |
| Browser + DevTools | Observe the normal application flow | Manual role and UI checks |
| Burp Suite Community | Inspect and replay approved HTTP requests | Manual validation through a local proxy |
| Nmap | Identify expected exposed ports | Explicit localhost or approved-host port scan |
| OWASP ZAP | Passive web baseline checks | Passive/baseline scan only unless active scan is approved |
| npm audit | Find known vulnerable Node dependencies | Read-only dependency advisory check |
| Semgrep | Find risky source-code patterns | Static scan of the checked-out repository |
| Git | Preserve evidence and review changes | Status, diff, commits; never commit secrets |

`curl`, `jq`, and `rg` are also useful. On Ubuntu/Debian systems, an
administrator can install common command-line prerequisites with their normal
managed-software process. Do not use a borrowed administrator password.

## A.2 Create an engagement folder and evidence log

From the project root, create a dated working folder. Do not store passwords,
session cookies, API keys, production exports, or unredacted personal data in
it.

```bash
mkdir -p security-evidence/$(date +%F)
printf '# Assessment notes\n\n' > security-evidence/$(date +%F)/NOTES.md
git status --short
```

Add this header to `NOTES.md` before running a tool:

```markdown
Target: http://127.0.0.1:3001
Environment: local disposable audit environment
RoE reference: [ticket or signed document]
Operator: [name]
Date/time/timezone: [value]
Emergency stop contact: [name and contact]
```

After every check, record: command, target, timestamp, result, screenshot or
sanitized output location, and whether it requires follow-up. This is what
makes the work reproducible.

## A.3 Start the target safely

Use the project's documented local setup. For a typical Node/Next.js project,
the shape is usually:

```bash
npm ci
# Configure a local or staging-only database URL; do not use production.
npm run dev -- --hostname 127.0.0.1 --port 3001
```

In a second terminal, confirm the application answers only on the intended
address:

```bash
curl --head http://127.0.0.1:3001/
```

Record the status code. If this is a project with a database, seed only
disposable test data and label all test accounts clearly (for example,
`security-test-user@local.test`).

## A.4 Step 1 — map intended network exposure with Nmap

Use a narrow scan first. Replace ports only with ports listed in the RoE. For a
local Docker-based Lorki setup, this is an example:

```bash
docker run --rm --network host instrumentisto/nmap:latest \
  -sT -n -Pn --max-retries 0 \
  -p 3001,54329,8080 127.0.0.1 \
  | tee security-evidence/$(date +%F)/nmap-local.txt
```

Expected result: the application port is open; a local proxy or disposable
database may also be open if you started them. Investigate unexpected ports
with the technical owner before proceeding. Do **not** broaden a scan to
private networks, cloud ranges, or the internet without written approval.

## A.5 Step 2 — collect HTTP security headers

Run this against the approved URL:

```bash
curl --silent --show-error --head http://127.0.0.1:3001/ \
  | tr -d '\r' \
  | tee security-evidence/$(date +%F)/headers.txt
```

Look for:

- `Content-Security-Policy`
- `X-Frame-Options` or CSP `frame-ancestors`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy`
- `Permissions-Policy`
- In production HTTPS only: `Strict-Transport-Security`
- On login responses: cookies marked `HttpOnly`, `Secure` (production), and
  an appropriate `SameSite` value.

Missing headers are not automatically vulnerabilities. Record the context and
ask the technical owner whether a framework, CDN, or reverse proxy adds them
in production.

## A.6 Step 3 — run dependency and source checks

For a Node project:

```bash
npm audit --omit=dev --json \
  > security-evidence/$(date +%F)/npm-audit.json
npm ls --all > security-evidence/$(date +%F)/dependency-tree.txt
```

Read the audit output carefully:

1. Record advisory IDs, severity, affected package, and dependency path.
2. Check whether the vulnerable code is actually used by the application.
3. Look for a supported upgrade path in the affected project's release notes.
4. Never run `npm audit fix --force` on a production branch without review;
   it can introduce breaking major upgrades or downgrades.
5. Create a normal dependency-update pull request, run tests, and retest the
   advisory afterward.

For Semgrep, use an organization-approved ruleset. A Docker example that scans
only the current checkout is:

```bash
docker run --rm -v "$PWD:/src:ro" semgrep/semgrep \
  semgrep scan --config p/owasp-top-ten /src \
  | tee security-evidence/$(date +%F)/semgrep-owasp.txt
```

The first run may download rules. Treat Semgrep output as leads, not proof:
open the indicated code, understand the data flow, and document why each result
is a true positive, false positive, or accepted risk.

## A.7 Step 4 — use Burp Suite Community safely

1. Open Burp Suite.
2. Choose **Temporary project** → **Use Burp defaults** → **Start Burp**.
3. In **Proxy → Proxy settings**, verify a listener is on `127.0.0.1:8080`.
4. In **Proxy → Intercept**, turn interception **off** for normal browsing.
   Turn it on only when you deliberately want to hold one request.
5. Configure a separate browser profile to use HTTP/HTTPS proxy
   `127.0.0.1:8080`. Do not proxy unrelated personal browsing.
6. Browse the approved app normally with each test account. Burp's **HTTP
   history** will record the requests.
7. Right-click one approved request and send it to **Repeater**. Change one
   harmless field at a time; document the original request and result.

Useful beginner checks:

- Without a session, request one protected API/page: expect denial or login
  redirect.
- With a low-privilege test account, request an admin-only API/page: expect
  denial.
- Submit a state-changing request with an untrusted `Origin`: expect CSRF
  rejection where the application uses cookie authentication.
- Send a malformed JSON body to a test endpoint: expect a safe 4xx response,
  not a stack trace or 500.
- Repeat a request that explicitly has an `Idempotency-Key`: expect the
  documented repeat behavior, not duplicate work.

Do not brute-force logins, change another user's data, resend payment webhooks,
or replay money-moving actions unless the RoE explicitly permits it and the
environment has synthetic data.

## A.8 Step 5 — run OWASP ZAP passive baseline

ZAP baseline mode spiders a small portion of the site and performs passive
checks. It is a starting point, not a complete test. With Docker and a local
target:

```bash
docker pull ghcr.io/zaproxy/zaproxy:stable
docker run --rm --network host ghcr.io/zaproxy/zaproxy:stable \
  zap-baseline.py -t http://127.0.0.1:3001 -m 2 -I \
  | tee security-evidence/$(date +%F)/zap-baseline.txt
```

For staging, replace the target only after the RoE approves it. `-m 2` limits
spider time. Do not switch to ZAP's active scan mode merely because baseline
works; active scanning can create records, trigger integrations, and degrade
service. Get a separate written approval and set rate/time limits first.

For every ZAP alert, record the URL, alert name, confidence, evidence, and
manual validation result. Close false positives with an explanation instead of
silently deleting them.

## A.9 Step 6 — manual role and workflow matrix

Make a table for each important route. Fill it in while testing.

| Route/action | Guest | Customer | Owner/artist | Admin | Expected result | Actual result |
| --- | --- | --- | --- | --- | --- | --- |
| View a private record | Deny | Own record only | Own record only | Allow | 401/403/404 as designed | |
| Edit a resource | Deny | Own resource only | Own resource only | Allow | Server-side ownership check | |
| Export data | Deny | Deny | Scoped only | Allow | Audit logged | |
| Refund/payout/settings | Deny | Deny | Scoped only | Allow | Correct state transition | |

For ownership tests, create two synthetic users (A and B) and one resource for
each. While logged in as A, change only B's resource identifier in an approved
request. The server must deny the request. Revert or delete every test record
when finished.

## A.10 Step 7 — edge-case checklist

Work through these only when they apply to the product and the RoE allows it.

### Authentication/session

- Logout, password change, role removal, account disable, and reset-token use
  invalidate or appropriately restrict old sessions.
- Password-reset tokens expire, cannot be used twice, and cannot be guessed.
- Login, reset, signup, and sensitive actions are rate-limited.

### Input and files

- Empty, malformed, too-long, duplicate, boundary, and unexpected values get
  a safe validation error.
- Stored text displays as text, not executable HTML/script.
- Uploads reject oversized, mismatched, or disallowed content; downloaded files
  enforce authorization.

### Money and irreversible actions

- Repeat submission, browser refresh, timeout retry, and duplicate webhook do
  not duplicate a charge, order, refund, payout, reservation, or email.
- Concurrent requests cannot exceed inventory or rate limits.
- State changes occur only in valid order and leave an audit trail.

### Deployment

- HTTPS and secure cookies work in production.
- The reverse proxy removes client-supplied forwarding headers and adds its
  own trusted values.
- Secrets are absent from logs, commits, browser bundles, and error messages.

## A.11 How to write and triage a finding

Create one Markdown file per confirmed finding in the evidence folder. Use:

```markdown
# [Severity] Short title

Date/time:
Target/environment:
RoE reference:
Affected route/component:
Preconditions:
Safe reproduction:
Expected result:
Actual result:
Impact:
Evidence file/screenshot:
Recommended fix:
Owner and due date:
Retest result:
```

Use precise wording. "A scanner reported it" is not a finding. "A guest can
submit 20 simultaneous requests; seven succeed despite a five-request limit"
is a reproducible finding with measurable impact.

## A.12 What to do when something looks serious

1. Stop the test that triggered it.
2. Preserve minimum sanitized evidence: time, route, role, request ID, and
   result. Do not collect extra customer data to make the case stronger.
3. Contact the emergency/security owner from the RoE.
4. Do not announce details in public chat, commit secrets, or share raw tokens.
5. Help the owner reproduce safely in staging/local, fix, add a regression
   test, and retest before closure.

## A.13 End-of-engagement checklist

- [ ] Stop local servers, proxies, scanners, and disposable containers.
- [ ] Delete or securely retain test data according to the RoE.
- [ ] Revoke test tokens/credentials and remove temporary access.
- [ ] Ensure evidence contains no secrets or unneeded personal data.
- [ ] Deliver findings, known limitations, and untested areas.
- [ ] Confirm fixes have tests and retest evidence.
- [ ] Hold a retrospective and update this playbook with useful lessons.
