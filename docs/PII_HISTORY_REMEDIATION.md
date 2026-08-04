# PII History Remediation Runbook

## Status

This document is a remediation plan based on a prior read-only audit. **No history rewrite was performed.** No sensitive value is reproduced here.

The known fixture content was sanitized by commit `9205d3faf3c7498e5b376516d2b9db5e1ca7faaf`. That commit corrected later snapshots; it did not remove the older Git objects, pull request diffs, clones, forks, caches, or backups.

## Confirmed Audit Scope

The audit identified a potentially real employee number in these commits:

- `2b520f9992aa730dd8a7f1e18ddaaaed6e463dd9`
- `0b013a386657a12580af8e01187d5c7d0da720a4`
- `138109021249684ac5e3ceac84c25c0b6c50af3f`
- `4edab50db68c6e381809fdcf9ee159db7dc66777`
- `005db58d6ccd154c48d5e13ff543ae67f45d5ffb`
- `37c3d8b398e88c177786aacc22b703d545935fa0b`
- `ab99eb03ef823f23d320906e34708a3cf12c2b8d`
- `18bc7e7cf83b1ba145a528f806e2c0d4b41cfa0b`

The affected paths are:

- `src/features/tarjeton/__tests__/tarjeton-parsers.test.ts`
- `src/features/tarjeton/__tests__/fixtures/imss-positioned-text.ts`

A linked employment date was also present in the last three affected commits:

- `37c3d8b398e88c177786aacc22b703d545935fa0b`
- `ab99eb03ef823f23d320906e34708a3cf12c2b8d`
- `18bc7e7cf83b1ba145a528f806e2c0d4b41cfa0b`

The affected GitHub pull requests are `#4` and `#5`.

These findings are the minimum known scope, not proof that no additional refs or GitHub surfaces contain the data. The rewrite operator must scan every reachable ref and inspect non-Git surfaces before proceeding.

## Handling Rules

- Never place either sensitive value in this repository, an issue, a pull request, a support ticket, a chat message, a command-line argument, shell history, CI output, or an ordinary log.
- Store exact-match patterns and replacement rules in an access-controlled, encrypted location outside every repository clone and outside cloud-synced folders.
- Configure scanners to suppress matched content. Reports may contain object IDs and paths, but not matching lines or values.
- Use approved synthetic values that retain the fixture format and parser behavior. Prefer the sanitized fixture values already introduced by `9205d3faf3c7498e5b376516d2b9db5e1ca7faaf`.
- Match the employment date only with enough field context to distinguish the linked fixture field. Do not globally replace a standalone date that may legitimately occur elsewhere.
- Treat terminal transcripts, screenshots, generated diffs, replacement maps, temporary files, and backups as sensitive until reviewed or destroyed.
- Perform the operation on an isolated trusted workstation. Disable automatic terminal recording, AI shell integrations, and cloud backup for the working and secure temporary directories.

## Owners

Assign named people before scheduling the rewrite.

| Role | Responsibility | Assigned owner |
| --- | --- | --- |
| Incident owner | Authorizes scope, maintenance window, and final closure | Unassigned |
| Privacy/security reviewer | Confirms classification, handling, retention, and acceptance criteria | Unassigned |
| Rewrite operator | Builds the replacement map, runs `git filter-repo`, and records evidence | Unassigned |
| Independent verifier | Repeats the scans and validates the rewritten repository | Unassigned |
| GitHub repository administrator | Manages branch protections, force push, PR cleanup, and Support request | Unassigned |
| Backup custodian | Controls the encrypted pre-rewrite backup and its destruction date | Unassigned |
| Contributor/fork coordinator | Freezes writes and obtains re-clone or fork-cleanup attestations | Unassigned |
| PR owners | Review and sanitize the descriptions and related surfaces for `#4` and `#5` | Unassigned |

The rewrite operator and independent verifier should be different people.

## Stop Conditions

Stop before force-pushing if any of these conditions applies:

- The incident owner and privacy/security reviewer have not approved the scope and maintenance window.
- A legal hold or retention requirement conflicts with deleting or retaining the affected history.
- The exact source bytes or approved synthetic replacements cannot be handled without exposing them in output or logs.
- A fresh scan finds additional values, paths, commits, branches, tags, pull requests, or forks that are not yet included in the plan.
- The remote changes after the write freeze or its current refs do not match the recorded manifest.
- A tested, encrypted backup is required but unavailable, or its access and destruction policy is not approved.
- `git filter-repo` asks for `--force`; create another fresh mirror instead of bypassing its fresh-clone safety check.
- The replacement affects unrelated dates, files, or fields, deletes either test file, or changes a sanitized branch-tip tree unexpectedly.
- Build, lint, tests, object integrity checks, or either independent PII scan fails.
- Required force-push permission, branch-protection changes, GitHub administrator access, or a GitHub Support escalation path is unavailable.
- Contributors, automation, mirrors, or fork owners can still push old history during the maintenance window.
- The local rewrite is correct but the push would update only part of the reviewed branch/tag set without an approved recovery decision.

If a sensitive value is accidentally exposed during remediation, stop, secure the new exposure, and extend the incident scope before continuing.

## Coordinated Rewrite Plan

### 1. Authorize and freeze

1. Open a private incident record with no sensitive values in its title or body.
2. Obtain approval from the incident owner, privacy/security reviewer, repository administrator, and any required legal or HR owner.
3. Schedule a maintenance window and announce a write freeze for the canonical repository, forks, bots, release jobs, and deployment jobs.
4. Block merges and ordinary pushes. Pause automation that can push commits or tags.
5. Record the canonical repository URL, default branch, every advertised branch and tag, custom refs, releases, open pull requests, deployed commit IDs, and known forks in the private incident record.
6. Record each branch and tag tip plus each sanitized tip's tree ID. A history-only cleanup should preserve the final sanitized tree IDs.
7. Record the versions of Git, GitHub CLI, and `git filter-repo`. Use a current `git filter-repo` release that supports `--sensitive-data-removal`.
8. Immediately before the push, compare the remote refs with this manifest. Any drift triggers a stop and a new freeze/snapshot.

### 2. Create a controlled backup and local tag

An exact pre-rewrite backup also contains the PII. Create one only when the incident owner and privacy/security reviewer approve its purpose, access list, encryption, retention period, and destruction date.

Use a separate encrypted location to create and validate a sealed mirror:

```text
git clone --mirror <canonical-repository-url> <sealed-backup-directory>
git -C <sealed-backup-directory> fsck --full
git -C <sealed-backup-directory> tag pii-remediation-pre-rewrite-YYYYMMDD <recorded-default-branch-tip>
```

- The backup tag exists only in the sealed backup. Never create or push a pre-rewrite tag to GitHub because it would keep the affected objects reachable.
- Record a checksum and perform a restore/read test without displaying affected blobs.
- Keep the backup offline or access-controlled and read-only during the rewrite.
- Set a short, explicit destruction date. A permanent backup defeats the deletion objective unless retention is legally required.
- Never use the backup for routine recovery. Restoring it would re-expose the affected history and requires new incident-owner and privacy approval.

### 3. Build the replacement rules privately

1. Create a `git filter-repo --replace-text` rules file outside the clone using the privately held exact bytes.
2. Use an exact, format-preserving replacement for the employee number.
3. Use a context-bounded rule for the linked employment-date field, limited to the known fixture representation rather than the date alone.
4. Ensure the synthetic replacements match the sanitized result from commit `9205d3faf3c7498e5b376516d2b9db5e1ca7faaf`.
5. Have the privacy/security reviewer inspect the rules without copying their contents into the incident record.
6. Securely delete temporary rule-building files when the verified rewrite and approved retention window are complete.

Conceptually, the private file contains rules of this form; the placeholders below are not usable rules and contain no values:

```text
literal:<private exact employee-number bytes>==><approved synthetic bytes>
regex:<private context-bounded employment-date expression>==><approved synthetic field and value>
```

Do not use a broad standalone date expression. Do not use path deletion or `--invert-paths`: the test files should remain in history with synthetic fixture data.

### 4. Establish the pre-rewrite baseline

In a disposable mirror, run an approved history scanner that reads patterns from the private file and reports only object IDs and paths.

The baseline must establish:

- The potentially real employee number is accounted for in at least the eight audited commits listed above.
- The linked employment-date context is accounted for in the three audited commits listed above.
- Matches are confined to the two audited paths, unless the plan is formally expanded.
- All local branches, tags, custom refs, and fetchable pull-request refs were scanned.
- The current intended branch tips contain only approved synthetic fixture data.
- Pull request bodies, comments, reviews, quoted diffs, attachments, Actions logs/artifacts, releases, Pages output, and package artifacts were separately inspected because Git filtering cannot change them.

Do not run commands that embed a value, such as `git log -S<value>`. The scanner must accept a protected pattern file and suppress matching content. If it cannot, stop and select a safer scanner.

### 5. Rewrite a fresh mirror

Create a second fresh mirror for the rewrite. Do not rewrite the sealed backup or an everyday developer clone.

```text
git clone --mirror <canonical-repository-url> <rewrite-mirror-directory>
git -C <rewrite-mirror-directory> fsck --full
git -C <rewrite-mirror-directory> filter-repo --sensitive-data-removal --replace-text <absolute-path-to-private-rules-file>
```

Requirements:

- Rewrite every reviewed local branch, tag, and custom ref containing affected ancestry, not only the default branch.
- Preserve both test files and replace only the approved fixture fields.
- Capture the `git filter-repo` commit map and first-changed-commit report in the private incident record. Do not commit these artifacts.
- Expect commit IDs for affected commits and all descendants to change, including the old ID of the sanitizing commit.
- Expect rewritten signed commits and signed tags to lose valid signatures. Document this consequence and arrange replacement attestations if policy requires them.
- If a rule has ambiguous or unrelated matches, stop and narrow it. Do not accept a broad replacement merely to finish the rewrite.

`git filter-repo` commonly removes the `origin` remote as a safety measure. Restore it only after local verification and confirm its URL before any push.

### 6. Verify locally before any push

The rewrite operator and independent verifier must each complete a scan. Neither scan may emit matching content.

Required checks:

- No protected pattern or linked-field context matches any reachable commit on any rewritten branch, tag, or custom ref.
- No affected pre-rewrite object remains reachable. After reflog expiration and garbage collection in the disposable rewrite mirror, the known old commit IDs should not resolve there.
- `git fsck --full` succeeds.
- The rewritten changes are limited to the two expected paths and approved fixture fields in historical snapshots.
- The files were not deleted or renamed by the rewrite.
- Every branch tip that was already sanitized has the same tree ID recorded before the rewrite.
- Tags and releases resolve to the intended rewritten commits.
- The commit map accounts for all audited commits and the sanitizing commit.
- A fresh non-bare checkout from the rewritten mirror passes `npm run build`, `npm run lint`, and `npx vitest run`.
- Tarjeton parser tests still exercise the same behavior with synthetic fixture data.

Any unexpected tree change, extra match, missing ref, or failed check is a stop condition. Correct the rules and restart from a fresh mirror; do not patch an uncertain rewrite in place.

### 7. Force-push during the maintenance window

1. Confirm the write freeze is still in effect and remote refs exactly match the baseline manifest.
2. Record branch protection, ruleset, required-check, and force-push settings so they can be restored exactly.
3. Temporarily authorize only the designated repository administrator and rewrite operator to force-push.
4. Restore and validate the canonical `origin` URL if `git filter-repo` removed it.
5. Dry-run the reviewed branch and tag refspecs.
6. Force-push all reviewed branches, then tags and any approved custom refs.
7. Do not blindly push private backup refs, `refs/original/*`, or the sealed backup tag.
8. Treat any partial rejection as an active maintenance incident. Keep writes frozen and have the incident owner choose completion or an approved recovery path; do not casually restore contaminated history.

Illustrative refspecs are shown below. The operator must adapt them to the inventoried refs and review the dry-run output first.

```text
git -C <rewrite-mirror-directory> push --dry-run --force origin "refs/heads/*:refs/heads/*"
git -C <rewrite-mirror-directory> push --force --prune origin "refs/heads/*:refs/heads/*"
git -C <rewrite-mirror-directory> push --force --prune origin "refs/tags/*:refs/tags/*"
```

GitHub-owned hidden refs such as `refs/pull/*` generally cannot be force-pushed by repository administrators. A rejected hidden ref is not permission to ignore it; include it in the GitHub Support request.

### 8. Clean GitHub pull requests and hosted copies

Pull request text and GitHub's stored diffs are not changed by `git filter-repo`.

For both `#4` and `#5`:

1. Have an authorized PR owner inspect the title, description, comments, review comments, quoted code, attachments, checks, and linked artifacts without copying sensitive content elsewhere.
2. Edit the description to remove quoted fixture content, obsolete old-commit links, or any other sensitive reference.
3. Use the GitHub web editor or `gh pr edit --body-file <sanitized-file-outside-the-repository>`. Do not pass a body containing sensitive content directly on the command line.
4. Ask each comment/review author to edit removable content. Escalate content the repository owner cannot edit to GitHub Support.
5. After remote verification, add a neutral notice such as:

```text
Security maintenance: repository history was rewritten to remove personal data from historical test fixtures. Pre-rewrite commit IDs and diffs are obsolete and must not be restored or quoted.
```

Do not claim completion in either PR until post-push verification passes. Editing a description does not guarantee deletion of its prior revisions, cached diff, review data, or backend copies.

Open a private GitHub Support request following GitHub's sensitive-data-removal process. Include the repository, affected PR numbers `#4` and `#5`, audited old commit IDs, first changed commit information, rewrite time, and the requested cache/pull-ref cleanup. Describe the data category but never include either sensitive value. Ask GitHub to:

- Remove or dereference affected pull-request refs and cached commit/diff views where supported.
- Purge repository network caches and search/indexed copies where supported.
- Identify any remaining hosted references that repository administrators cannot remove.
- Confirm completion or document platform retention limitations.

Also delete or expire affected Actions artifacts/logs/caches, Pages deployments, release assets, and other GitHub-hosted generated copies if the audit finds any. Preserve only sanitized evidence required by policy.

Reference: [GitHub - Removing sensitive data from a repository](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository).

### 9. Verify the canonical remote

Verification must use a brand-new clone from the canonical URL, not the rewrite mirror.

- Confirm all advertised branch and tag tips match the approved post-rewrite manifest.
- Repeat the protected, no-content-output scan across every advertised ref.
- Confirm the two test paths contain only approved synthetic data at current tips.
- Confirm the known old commit IDs are not reachable through advertised Git refs.
- Run `git fsck --full`, `npm run build`, `npm run lint`, and `npx vitest run` in the fresh checkout.
- Verify branch protections, rulesets, required checks, deployment settings, and automation permissions were restored.
- Verify PR `#4` and `#5` descriptions are sanitized and their affected diff/cache surfaces are covered by the Support request.
- After GitHub Support completes its work, test old commit and PR-diff URLs without sharing those URLs publicly and record only pass/fail evidence.
- Obtain independent-verifier approval before lifting the write freeze.

## Force-Push Risks

- Every affected commit and descendant receives a new ID. Existing commit links, pinned deployment SHAs, release notes, status records, and local branch bases may become stale.
- Commit and tag signatures on rewritten objects no longer validate. A separate signed incident attestation may be preferable to attempting to recreate every signature.
- Open pull requests may show confusing diffs, lose review continuity, or close. GitHub-owned pull refs can preserve old objects until GitHub removes them.
- A stale clone, fork, bot workspace, or mirror can reintroduce the old history with one push.
- Branch protection changes create a temporary control gap. Restrict the bypass to named operators and restore protections immediately.
- Pushing branches and tags is not atomic. A network or permission failure can leave a mixed state; keep the repository frozen until every ref is reconciled.
- Rewritten tags can affect releases and consumers pinned to them. Notify downstream users and republish only reviewed tags or release metadata.
- CI and deployments will rerun under new commit IDs. Confirm that no job republishes an old source archive or cache.

## Fork, Cache, Clone, and Backup Limitations

A successful canonical force-push makes old objects unreachable from normal branch and tag traversal; it is not proof of universal deletion.

- Forks are separate repositories. Coordinate with every known fork owner to rewrite or delete and recreate the fork. The canonical repository owner generally cannot force-push another user's fork.
- GitHub pull refs, cached diffs, commit pages, search indexes, Actions data, and backend backups may persist under platform retention rules. GitHub Support is required for what administrators cannot remove.
- Existing local clones, worktrees, stashes, reflogs, bundles, mirrors, IDE local history, filesystem snapshots, CI workspaces, and developer backups retain old objects until explicitly cleaned or destroyed.
- Search engines, archives, package registries, chat uploads, screenshots, and third-party mirrors are outside Git history. Track each known copy separately and request deletion from its owner or provider.
- A pre-rewrite backup intentionally retains the affected data. Quarantine it, never reconnect it as a push source, and destroy it on the approved date unless a documented legal hold applies.
- Git garbage collection and cache expiration are asynchronous. Record provider confirmation and residual limitations rather than promising absolute erasure.

## Secret Rotation Is Separate

An employee number and employment date are PII, but they are not automatically credentials. Rewriting history does not rotate, revoke, or invalidate anything.

- If the employee number is used for login, recovery, identity verification, payroll access, or another security decision, the responsible HR/identity system owner must assess reissuance, control changes, and account monitoring.
- An employment date generally cannot be rotated. Reduce its exposure and assess social-engineering or identity-verification risks instead.
- If the expanded audit discovers an API key, password, token, signing key, session credential, or other actual secret, revoke or rotate it immediately before waiting for the history rewrite. Then remove it from history as a separate tracked action.
- Do not mark PII remediation complete merely because credentials were rotated, and do not mark secret remediation complete merely because Git history was rewritten.

## Mandatory Re-clone Instructions

After the canonical push is independently verified, send contributors and automation owners the new default-branch tip and a deadline for attestation.

1. Stop using the old clone immediately. Disable or remove its push remote so it cannot reintroduce old objects.
2. Preserve unpushed work only after a no-content-output scan. Export the minimum reviewed clean patch to an approved encrypted location; do not preserve the old `.git` directory as a convenience backup.
3. Clone the canonical repository into a new empty directory.
4. Verify the canonical remote URL and announced default-branch tip.
5. Reapply only reviewed clean patches or cherry-pick individually reviewed clean changes. Never merge, rebase, or push an old branch wholesale.
6. Recreate local branches from rewritten remote branches. Do not copy old tags, stashes, reflogs, bundles, or Git objects.
7. Delete the old clone, all linked worktrees, temporary patches, and IDE local-history copies after the approved retention check. If policy requires retention, quarantine them encrypted with no remote instead.
8. Wipe and freshly clone CI runners, deployment workspaces, bots, mirrors, and scheduled-job checkouts. Invalidate source caches that can contain `.git` objects or affected files.
9. Fork owners must rewrite their fork or delete and recreate it, then confirm that no old branch/tag remains. Merely syncing the default branch is insufficient.

Do not advise `git pull`, `git reset`, or garbage collection as a substitute for a fresh clone. Those approaches can leave affected objects locally and increase the chance of reintroduction.

## Completion Checklist

- [ ] Incident owner and privacy/security reviewer approved scope, handling, retention, and maintenance timing.
- [ ] Named owners were assigned for every role.
- [ ] Writes, merges, releases, deployments, bots, mirrors, and fork synchronization were frozen.
- [ ] All remote refs, current tree IDs, PRs, forks, releases, and generated surfaces were inventoried.
- [ ] A sealed backup was approved, encrypted, tested, locally tagged, and given a destruction date, or the decision not to retain one was documented.
- [ ] The private replacement map uses a context-bounded employment-date rule and approved synthetic values.
- [ ] The rewrite was performed only in a fresh mirror with `git filter-repo --sensitive-data-removal`.
- [ ] Operator and independent-verifier scans found no match on any rewritten ref and emitted no sensitive content.
- [ ] Historical changes were limited to the two expected paths and fields; sanitized branch-tip tree IDs were unchanged.
- [ ] `git fsck --full`, build, lint, and all tests passed before push.
- [ ] Reviewed branches, tags, and custom refs were force-pushed without unresolved partial failures.
- [ ] Branch protections, rulesets, required checks, and automation controls were restored.
- [ ] PR descriptions and related surfaces for `#4` and `#5` were reviewed and sanitized.
- [ ] GitHub Support was asked to clean affected pull refs/caches and documented its result or limitations.
- [ ] A fresh canonical clone passed the independent ref scan, integrity checks, build, lint, and tests.
- [ ] Contributors, CI owners, mirror owners, and fork owners re-cloned or completed equivalent cleanup and attested that stale history cannot be pushed.
- [ ] Credential rotation or identity-system risk review was completed separately where applicable.
- [ ] The sealed backup and private replacement files were destroyed on schedule, or continued retention has documented legal approval.
- [ ] The incident owner and independent verifier signed off before closure.

## Current Outcome

This runbook documents the required future procedure only. **No repository history rewrite, force-push, GitHub PR edit, cache purge, fork cleanup, secret rotation, or re-clone operation was performed as part of creating this file.**
