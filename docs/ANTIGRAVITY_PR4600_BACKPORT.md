# Antigravity PR #4600 — local backport / upstream reconciliation

Date: 2026-10-07. User authorized applying, testing and deploying this patch.
Historical deployment: **local v0.5.95 backport**, not an official release.
Local source was reconciled with official **v0.5.99** (2026-10-09) and subsequently
**deployed with separate user approval**. See the reconciliation and v0.5.99
deployment sections below. No test suite or model/provider probe ran for that update.
Latest source is reconciled with **v0.5.104** (2026-10-16) and was subsequently
**deployed with separate user approval**. Production now runs v0.5.104 from
`de0d655e`; see the deployment record below. No test suite or model/provider
probe was initiated by the deployment procedure.

## Source pinned at application time

- Issue: https://github.com/decolua/9router/issues/4555
- PR: https://github.com/decolua/9router/pull/4600 (open/unmerged when inspected).
- Related alternative PR: https://github.com/decolua/9router/pull/4566.
- Base: `a99cf57239ff778b61e434c2786009d5ed1c412c`.
- PR commits:
  - `d0a05e5fdb926c15a7534ff90dd36657aeedcbda`: model support.
  - `c4517b3f27b1a1af1149a2b2f2783a67053fa854`: shared session/weekly quota routing.
- Exact imported head: `c4517b3f27b1a1af1149a2b2f2783a67053fa854`.
- Locally fetched ref: `refs/remotes/origin/pr-4600`.
- Applied the complete base-to-head diff, **without runtime adaptations**.
- Added local `tests/unit/antigravity-quota-error-details.test.js` (9 cases).

## Changed files from PR (14)

1. `cli/src/cli/menus/providers.js`
2. `open-sse/executors/antigravity.js`
3. `open-sse/providers/capabilities.js`
4. `open-sse/providers/pricing.js`
5. `open-sse/providers/registry/antigravity.js`
6. `open-sse/services/usage/google.js`
7. `open-sse/translator/concerns/thinkingUnified.js`
8. `src/mitm/config.js`
9. `src/shared/constants/cliTools.js`
10. `src/sse/services/antigravityQuota.js`
11. `src/sse/services/auth.js`
12. `tests/unit/antigravity-claude-5-5.test.js`
13. `tests/unit/antigravity-quota-routing.test.js`
14. `tests/unit/claude-opus-5-5.test.js`

The base/low/medium/high model variants use the `ag/` prefix. Base Sonnet/Opus 5.5
maps to the high upstream tier. Registry upstream IDs include `(high)`, `(medium)`,
or `(low)` suffixes, which the existing thinking pipeline strips before dispatch.

Includes model catalogs, CLI/MITM aliases, capabilities, pricing, and paid-model
usage allowlist. Opus 5.5 capability changes affect Claude translation too.
Quota handling resolves model + shared Claude/GPT or Gemini session/weekly limits
and extracts reset timestamps or RetryInfo durations from HTTP 409/429 details.

## Existing local changes — preserved separately

These five files had uncommitted changes before the original backport:
- `open-sse/handlers/chatCore.js`
- `open-sse/utils/streamHandler.js`
- `src/app/api/v1/responses/compact/route.js`
- `src/app/api/v1beta/models/[...path]/route.js`
- `src/sse/handlers/chat.js`

They are not included in the dedicated backport commit, but are included in the
deployed working-tree source. Before the v0.5.99 merge, their exact diff was
checkpointed separately in commit `5e93e657`. Their abort behavior is retained
alongside newer upstream changes; entire file contents need not remain identical.
Do not discard them when updating upstream.

## Verification and limitations

- Before full unit run: 2527 passed, 89 failed, 2641 total.
- After full unit run: 2560 passed, 89 failed, 2674 total.
- Compared assertions by file + full test name: **zero pass-to-fail regressions**;
  zero new suite-level failures. Full suite is NOT green.
- Focused extended run initially had the existing Muse Spark failure; it failed
  before the PR too. New PR tests and 9 local quota-details tests passed.
- Focused deployment gate excluding that confirmed existing failure: exit 0,
  259 tests passed, zero failed (some existing skipped/todo cases).
- Alias baseline: pass. OAuth URL baseline: pass.
- Provider snapshot: fails before AND after with the same existing Codex header
  drift, `0.155.0` vs `0.159.0`; not caused by this patch.
- `node --check` on changed tracked JS files and `git diff --check`: pass.
- LSP checks returned no errors but were inconclusive (silent-on-clean server);
  do not treat that as independently verified clean.
- Existing pricing dynamic-RegExp audit warning is outside this patch.
- Windows test install needed `npm install --legacy-peer-deps --no-audit --no-fund --package-lock=false`.
- Full tests include pre-existing failures, missing cloud/lowdb, platform-specific
  SQLite cleanup errors, and live-provider cases. No claim of a live successful
  Claude 5.5 generation is made by the unit tests.

## Security / operational notes

No OAuth endpoint, secret storage, incoming authentication, forwarding-header
trust, or upstream destination changes are introduced by this PR. Authentication
must remain enabled. Antigravity's existing `RISK_NOTICE` remains: adding model
support does not remove account restrictions, ban risk, or genuine quota limits.
Pricing is from the PR, not independently verified billing.

Do not put provider tokens/API keys or database dumps in git or this document.
Protect deployment backups (they contain credentials). Journald logs may contain
account identifiers/request metadata; redact before sharing.

Target service: `root@169.58.140.179`, `9router.service`, port 20128.
Keep its existing `--log` and other ExecStart flags. Back up installed package,
service configuration and `/root/.9router` while the service is stopped, with
root-only permissions. Install only after Linux build succeeds. Restore the
saved package and state if smoke checks fail. Re-enable the tunnel via the local
CLI client after restart; fixed public URL is `https://rbt6e5d.abc-tunnel.us`.

## Deployment verified (2026-10-07)

- Source backport commit: `ad9adfd1` plus the five original uncommitted changes.
- Deployment ID: `pr4600-20261007-1791332692391`.
- Build: `/root/9router-build-pr4600-20261007-1791332692391`.
- Backup: `/root/9router-backup-pr4600-20261007-1791332692391` (root-only;
  `global-pkg`, stopped-service `state`, and `9router.service`).
- Backup pointer: `/root/9router-pr4600-backup-latest`.
- Artifact SHA256: `584780945d12167b94f8a6a9519d792ae859a1fdc6c1f8e00cfc4d8c3b3cde7c`.
- Installed provenance: `/usr/lib/node_modules/9router/local-backport-manifest.json`
  contains exact source hashes, PR head and source commit (no credentials).
- Linux focused gate: 259 passed, zero failed (existing skipped/todo cases).
- Root install first hit a network timeout; retry using npm cache succeeded.
  Linux Vitest install needed `--legacy-peer-deps` as on Windows.
- No committed lockfile: dependency resolution selected Next.js **16.4.0**,
  replacing the previous runtime's 16.3.8. Build-time lockfiles remain in the
  server build directory for reproducibility; they were not committed locally.
- Service active; local and fixed-public `/api/health` returned HTTP 200.
- Authenticated CLI catalog and authenticated `/v1/models` list all 8 new
  `ag/claude-{sonnet,opus}-5-5` base/low/medium/high IDs.
- Missing-key generation request returned 401 (`requireApiKey=true`), with no
  upstream generation sent. Existing `--log` retained.
- SQLite `PRAGMA quick_check`: OK. Entity counts matched stopped-service backup:
  providerConnections=9, apiKeys=1, combos=0.
- Tunnel restored at `https://rbt6e5d.abc-tunnel.us`; public health HTTP 200.
- **No live Claude 5.5 generation was performed**; upstream availability,
  account access and real quota still need a user generation test.
- Deployment succeeded without rollback. This documentation update is a
  subsequent documentation-only commit; it does not change the runtime artifact.

## Local reconciliation with official v0.5.99 (2026-10-09)

### Scope and provenance

The initial authorization covered **local merge and documentation only**. No tests,
provider requests, build, installation, push, SSH, deployment or restart occurred
in that merge step. The user subsequently authorized deployment separately,
recorded below. Historical v0.5.95 test results do not validate v0.5.99.

- Pinned upstream: `ce4460ef` (v0.5.99, 29 new commits from `a99cf572`).
- Maintainer integrated PR #4600 contents at `a07ed95b` and closed the PR;
  GitHub's PR API reports `merged:false`, so verify code, not just PR status.
- Core quota resolver, auth selection, executor error parsing, pricing and PR
  tests match the backport. Capabilities/thinking files also have newer upstream
  changes, notably Muse Responses transport, retained by the merge.
- Do **not** reapply or revert the original PR wholesale. History is retained;
  runtime follows official upstream, plus the five stream/abort changes.
- Extra local `tests/unit/antigravity-quota-error-details.test.js` is retained,
  but was not executed again during this merge.
- Backup branches: `backup/pre-v0599-local-20261009` (before stream checkpoint)
  and `backup/pre-v0599-stream-20261009` (checkpoint `5e93e657`).
- External local backup of the pre-merge dirty diff and file hashes:
  `C:\Users\PC\AppData\Local\Temp\9router-pre-v0599-z1RCTk`.

### Resolution choices

- `CHANGELOG.md`: retain upstream history and local backport/reconciliation notes.
- `open-sse/providers/registry/antigravity.js`: use exact v0.5.99 registry.
- `src/shared/constants/cliTools.js`: use exact v0.5.99 CLI/MITM configuration.
- Official `24034f69` updates default MITM to `gemini-3.8-flash-medium`, adds
  Gemini 3.1 Pro High and removes deprecated Gemini 3.5 / 3-flash catalog entries.
  Review existing combos/custom mappings before any future deployment; this
  local source merge does not migrate production settings.
- All five stream/abort files merged automatically once Git handled text line
  endings; initial temporary CRLF/LF simulation conflicts were false positives.
- Preserve both `clientSignal` / `request.signal` propagation and upstream
  API-key access checks, including Gemini native requests and fallback filtering.
- Local reconciliation does **not** implement a fix for Codex `terminated`.
  Upstream base executor/stream handler/streaming response code has no relevant
  socket fix; Codex changes preserve tool strict flags and image usage.

### Security and verification limits

- Static review/checks only; runtime compatibility and regressions are untested
  in this reconciliation. Do not reuse the historical 259-pass result as a gate.
- Static inspection found no remaining merge markers and confirmed all 14
  original PR files match official upstream after line-ending normalization.
- LSP probes were inconclusive for six files. Auxiliary static rules flagged
  two unchecked `new URL(request.url)` calls in `src/sse/handlers/chat.js`;
  both statements are identical in upstream and were not introduced by the
  local abort changes. They remain existing hardening opportunities.
- `node --check` passed for 89 changed runtime JavaScript files without
  executing their modules. Stable patch-id of the five stream/abort changes
  matches the original checkpoint (`5c2e50df095764dc29accb03ce6885e0f07f3988`).
- Working-tree `git diff --check` passed. Staged/upstream diff has one inherited
  trailing blank-line warning at `tests/unit/gemini-contents-normalization.test.js:196`;
  the test file is kept byte-for-byte identical to upstream, not modified here.
- Deferred ESLint timed out after 30 seconds; no lint-clean claim is made.
  Syntax-only checks do not execute application modules or provider calls.
- Keep API-key authentication and new per-key allow-list enforcement intact.
  TCP-derived client IP handling in `custom-server.js` remains upstream unchanged.
- New optional Netlify relay accepts header-supplied destinations without visible
  relay authentication/destination allow-list in its generated function, and
  buffers SSE in full. **Do not deploy/enable this relay** without a separate
  security and streaming review. Merging its source does not create a relay.
- Antigravity account-risk notice remains; adding model support does not remove
  account restrictions. No credential values are included in these notes.
- Future deployment requires separate user approval; do not contact production
  or run provider probes while the current restriction remains in effect.

## v0.5.99 deployment (2026-10-09; operational verification only)

- User separately authorized deploying the merged source; the restriction on
  test suites and model/provider probes remained in effect.
- Deployed source: `6a809a148feacd9f7cfaa7079d80bc422b7eae96`, official upstream
  `ce4460ef79382bfddb4aa5fc0ff9f3cb0d5f95a8`, plus preserved stream/abort fixes.
- Deployment ID: `v0599-20261009-1791496703015`.
- Build directory: `/root/9router-build-v0599-20261009-1791496703015`.
- Build reused previous root/CLI lockfiles as dependency-resolution inputs;
  refreshed build lockfiles remain on the server, not committed locally.
  Next.js stayed at **16.4.0**, matching the previous deployed runtime.
- Build HOME/DATA_DIR were isolated from production credentials and DB.
- Artifact: `9router-0.5.99.tgz`; SHA256:
  `d8b3613e6e7ff862dbdd265dd592ec10379ec6aba3284f88ccc591c14fd658e1`.
- Backup: `/root/9router-backup-v0599-20261009-1791496703015`, mode `700`;
  old global package, CLI symlink, service config and state copied with service
  stopped. Pointer: `/root/9router-v0599-backup-latest`.
- Deployed at `2026-10-09T00:09:08+02:00`; installation and operational
  verification returned exit 0, without rollback.
- Installed provenance: `/usr/lib/node_modules/9router/local-backport-manifest.json`
  records source hashes, source commit and verification limitations.
- Service active; CLI and app package versions 0.5.99. Existing systemd ExecStart
  retained `--host 0.0.0.0 --port 20128 --no-browser --skip-update --log`.
- TCP/IP guard hash matches source. Local `/api/health`: 200 with `ok:true`.
- SQLite quick_check: OK. Entity counts match stopped-service backup:
  15 provider connections, 1 API key, 0 combos, 0 proxy pools.
- Existing password/auth/provider overrides/strategies/quota configuration
  preserved; effective `requireApiKey=true`, `requireLogin=true`. No credential
  values were printed or recorded in this document.
- Previously enabled tunnel restored with the same shortId `bt6e5d`;
  stable URL `https://rbt6e5d.abc-tunnel.us`, public health returned 200.
- **No test suite, model listing probe, generation request or provider test was
  run by the deployment procedure.** Health checks do not prove inference or
  absence of runtime regressions; historical 259-pass results are not a gate.
  Existing application background behavior was not reconfigured.
- No Netlify relay was created/enabled; there were zero proxy pools. Security
  concerns documented above remain. Codex `terminated` is not fixed by this update.
- This deployment record is a subsequent documentation-only commit; runtime
  artifact provenance continues to identify source `6a809a14`.

## Local reconciliation with v0.5.104 (2026-10-16; deployment authorized separately)

### Approval, provenance and preserved changes

- User reviewed the proposed changes and explicitly approved **local merge only**.
  No tests, provider requests, build, dependency installation, push, SSH, deployment
  or server restart are authorized by this approval or performed in this step.
- Pinned tag: `v0.5.104`, commit `87a74e1bda3677193c6f71a7e2100c90311f0689`.
  There are 38 upstream commits / 140 changed files since official v0.5.99.
- Pre-merge local HEAD: `21ccf59448eee07adc64ee8e3f4a6b53643b1938`.
  Recovery branch: `backup/pre-v05104-local-20261016`.
- Only `CHANGELOG.md` conflicted; retain both upstream release history and local
  backport/deployment/reconciliation notes. No upstream runtime file is manually
  replaced or reverted, and the generated provider-registry index is not hand-edited.
- Retain all five stream/abort changes checkpointed at `5e93e657`, plus unchanged
  local `tests/unit/antigravity-quota-error-details.test.js`. Do not reapply PR #4600.
- Historical test/deployment results in this document do not validate v0.5.104.
  Production remains the last recorded v0.5.99 deployment; no server was contacted
  during this review/merge to re-check its current state.

### Reviewed behavior changes and security caveats

- Antigravity IDE fingerprint changes from 2.11.0 to 2.22.0, adds
  `gemini-4-argon-high`, and supplies the model to Gemini contents normalization.
  Claude 5.5 mappings and the existing shared-family quota resolver are retained.
- Codex removes `gpt-5.5`, `gpt-5.5-review`, `gpt-5.5-image` and `gpt-5.3-image`
  from the catalog. CLI preset/default auto-ping model changes to `gpt-6.1-sol`.
  Review saved client/model/combo settings before a future deployment; do not
  silently migrate accounts or production preferences as part of a source merge.
- Codex executor, base executor and streaming handler have no relevant socket fix.
  This merge does **not** establish a fix for the observed `terminated` failure.
- Forced-SSE non-stream Claude requests now produce Claude-shaped JSON. Combo
  fallback detects unusable JSON 2xx responses on non-final model seats, not
  partial SSE replay; fallback can still incur additional upstream calls.
- Cursor's strict-proxy HTTP/2 guard fails closed if the transport cannot honor
  required proxying. Long-history empty-turn recovery defaults to one tail-only
  retry at 80 messages; reduced history can change context available to the model.
- Auto-ping schedules are opt-in (`enabled:true`); schedules independently start
  the scheduler, support timezone/DST, and have a 30-minute catch-up window.
  Review existing reactive ping settings and explicit schedule timezone before
  deployment. No schedule/provider is enabled by this merge.
- The auto-ping path still sets `strictProxy:false` as in v0.5.99; the Cursor
  proxy fix is not a guarantee that every background path obeys strict proxying.
- The per-key token-quota / pattern-access feature was added then reverted before
  the tag. No net changes to the reviewed key ACL/API-key repo/schema migrations;
  do not advertise those reverted features as available in this release.
- New optional Nous OAuth uses fixed HTTPS portal/inference endpoints and stores
  refreshed agent API keys. Its warning paths include upstream error text: review
  redaction before enabling it; this is a possible sensitive-log risk, not proof
  of an observed credential leak. No new provider was configured in this merge.
- Authentication/TCP client-IP guard and existing ACL behavior are preserved.
  Netlify relay concerns above remain; no relay is created/enabled by merging code.
- Dependency declarations are unchanged except package versions; no packages were
  installed. Local installed dependencies may therefore lag source requirements.

### Static verification of this merge

- `node --check` passed for 75 changed runtime JavaScript files; it parses only,
  without executing application modules, tests or provider requests.
- No merge markers remain. Working-tree and staged `git diff --check` passed.
- Stable patch-id of the retained five-file stream/abort delta matches the original
  checkpoint: `5c2e50df095764dc29accb03ce6885e0f07f3988`.
- The only local differences from the approved tag are those five files,
  `CHANGELOG.md`, this document and the unchanged local quota-error-details test.
- Both root and CLI package versions are 0.5.104.
- Active LSP probes did not establish a clean result for six files. Auxiliary
  static rules reported two unchecked `new URL(url)` calls in Cursor at lines
  487 and 547; both calls existed in v0.5.99 and the merged Cursor file is exactly
  the approved upstream version. No unrelated hardening patch was introduced.
- Verification is static only; no inference, runtime or regression-clean claim.
  Future deployment and any change to testing restrictions require separate approval.

## v0.5.104 deployment (2026-10-16; operational verification only)

- After approving the local merge, the user separately authorized deployment.
  The no-test-suite / no-model-provider-probe restriction remained in effect.
- Deployed source: `de0d655e4c3160461d79e33b4ed72fb5f3ce3a6c` (approved upstream
  `87a74e1bda3677193c6f71a7e2100c90311f0689` plus preserved local stream changes).
- Deployment/build ID: `v05104-20261016-1792100515418`.
  Build directory: `/root/9router-build-v05104-20261016-1792100515418`.
- Previous v0.5.99 root/CLI lockfiles were reused as resolution inputs;
  refreshed lockfiles remain in the server build directory. Next.js stayed at
  **16.4.0**. Build HOME/DATA_DIR were isolated from production state/credentials.
- Artifact: `9router-0.5.104.tgz`, SHA256:
  `3494f5d034c4770d8d17392bf926fd85f9c37bb097e4b462bc6da960cc3d5191`.
- Preflight found one previously opted-in Codex reactive auto-ping account,
  zero enabled schedules, zero proxy pools, and no exact retired Codex model
  references in the settings/combos/connections/pools examined. External client
  configurations were not inspected. No auto-ping preference was changed.
- First attempt passed version/local-health/DB/config checks but rolled back
  to v0.5.99 after the tunnel-enable CLI call failed its readiness gate. The
  previous service and public health were verified recovered before retry.
- The CLI client has a 30-second request timeout. On retry, enable again returned
  a timeout, but bounded tunnel-status/public-health polling confirmed the same
  stable tunnel became healthy. Only temporary deployment-helper scripts changed;
  no application source was patched to handle this operational wait.
- Second attempt used the **same artifact**, with a fresh stopped-state backup:
  `/root/9router-backup-v05104-20261016-1792100515418-retry2`, mode `700`.
  It includes old package, CLI symlink, service unit and state copied after stop.
  Pointer: `/root/9router-v05104-backup-latest`.
- Initial attempt/rollback evidence remains in
  `/root/9router-backup-v05104-20261016-1792100515418` and corresponding install log.
- Successful completion: `2026-10-15T23:53:47+02:00` (2026-10-16 in local UTC+7).
  Retry install exited 0; service active, MainPID `2214463` at verification.
- CLI/app versions 0.5.104; installed provenance at
  `/usr/lib/node_modules/9router/local-backport-manifest.json` records source
  hashes, commit and verification limits. TCP-derived client-IP guard hash matches.
- Existing ExecStart is unchanged:
  `--host 0.0.0.0 --port 20128 --no-browser --skip-update --log`.
- SQLite quick_check OK. Entity identities matched the retry stopped backup:
  20 provider connections, 2 API keys, 0 combos and 0 proxy pools. API-key/combo/
  proxy-pool rows and all existing settings (except ephemeral tunnelUrl) matched.
- Effective `requireApiKey=true` and `requireLogin=true` preserved. No credential
  values are recorded here. A second API key appeared before the stopped backup;
  comparisons use the actual stopped snapshot, not the earlier preflight count.
- Local and fixed-public `/api/health` returned 200 with `ok:true`. Previously
  enabled tunnel restored at `https://rbt6e5d.abc-tunnel.us`, same shortId `bt6e5d`.
- **No test suite, model-list probe, generation request or provider test was
  initiated by the deployment procedure.** Existing application background behavior
  and user traffic continued; token-refresh warnings observed in logs are not
  provider probes initiated by this procedure. No new schedule/provider/relay
  was configured or enabled.
- Health/config checks do not establish inference success or no regressions.
  Codex `terminated`, existing auto-ping strictProxy and Nous/Netlify security
  caveats remain as documented above.
- This subsequent documentation-only update is not part of the runtime artifact;
  deployed source provenance remains `de0d655e`.

## Checklist for a future upstream update

1. Preserve ALL remaining local changes and record the current deployed source
   before updating. Do not blindly stash/pop or overwrite the working tree.
2. Fetch official upstream and inspect the actual released implementation.
   A squash/reimplementation may not contain the PR's original commit IDs.
3. Inspect the dedicated backport commit:
   `git log --all --oneline --grep='backport PR #4600'`
4. Compare upstream with the 14-file checklist above: registry/upstream tiers,
   MITM aliases, Opus thinking/tool-choice, pricing, quota family/session/weekly
   resolver, resetAt parsing. Use `git diff` and, for equivalent patches,
   `git patch-id --stable`; ancestry alone is not sufficient.
5. If upstream implements the fix, resolve merge conflicts in favor of the
   reviewed official implementation and remove duplicate local logic. Do not
   blindly reapply this patch or blindly revert it on top of equivalent upstream.
   Review #4566 too if that is the implementation ultimately merged.
6. Retain the extra quota-details tests where still applicable. Keep the five
   original stream/abort changes unless upstream demonstrably supersedes them.
7. Rerun focused Antigravity, capabilities, thinking, MITM, usage/quota tests,
   alias/OAuth/provider snapshots and a before/after regression comparison.
8. Build Linux artifact, backup state, deploy, restore tunnel and verify health
   + authenticated model listing. Confirm upstream IDs against the account's
   live available-model catalog before claiming generation works.
9. Update this document with the official version/commit, what local changes
   were removed or retained, checks and deployment backup location.