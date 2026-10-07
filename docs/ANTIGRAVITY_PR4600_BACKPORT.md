# Antigravity PR #4600 — local backport / upstream reconciliation

Date: 2026-10-07. User authorized applying, testing and deploying this patch.
This is a **local backport**, not an official 9Router release. Package version remains 0.5.95.

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

## Existing local changes — kept separate and byte-for-byte preserved

These five uncommitted files existed before this backport:
- `open-sse/handlers/chatCore.js`
- `open-sse/utils/streamHandler.js`
- `src/app/api/v1/responses/compact/route.js`
- `src/app/api/v1beta/models/[...path]/route.js`
- `src/sse/handlers/chat.js`

They are not included in the dedicated backport commit, but are included in the
deployed working-tree source. Do not discard them when updating upstream.

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

## When an official version becomes available

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