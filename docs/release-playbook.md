# Release runbook

This is the canonical publish procedure for `pi-tmux-window-name`.

## Scope

- Release channel: **latest** only (stable tags `vX.Y.Z`).
- Publish target: npm package **`pi-tmux-window-name`**.

## Changelog format (required)

`CHANGELOG.md` must always contain:

- `## [Unreleased]`
- Version sections formatted as `## [X.Y.Z] - YYYY-MM-DD`
- Structured subsections (`Added`, `Changed`, `Fixed`, optional `Removed`/`Security`)

## First release (manual)

For the first npm release, publish manually from a clean checkout:

1. `npm run release:gate`
2. `npm publish --access public --otp <code>`

After first publish, tag-driven GitHub Actions release can be used.

## Release steps

1. **Prepare release commit**
   - Move completed entries from `## [Unreleased]` into a new section:
     - `## [X.Y.Z] - YYYY-MM-DD`
   - Reset `## [Unreleased]` back to placeholders.
   - Bump package version in `package.json` to `X.Y.Z`.

2. **Validate locally**
   - Run: `npm run release:gate`

3. **Commit + merge to main**
   - Commit changelog/version/docs/workflow updates.
   - Merge PR to `main`.

4. **Tag release**
   - `git tag -a vX.Y.Z -m "release: vX.Y.Z"`
   - `git push origin vX.Y.Z`

5. **Automated publish**
   - Push `vX.Y.Z` tag; GitHub Actions `release` workflow handles the rest.
   - It validates release metadata, runs `npm run release:gate`, publishes to npm, and creates/updates GitHub release notes from `CHANGELOG.md`.

6. **Post-release verification**
   - `npm view pi-tmux-window-name version dist-tags --json`
   - `npm view` may lag due cache. Verify with registry data:
     ```bash
     curl -s https://registry.npmjs.org/pi-tmux-window-name \
       | jq -r '."dist-tags".latest, (.versions | keys | .[-1])'
     ```

## Failure + rollback

- Auth errors (`gh`/`npm`): authenticate, then retry.
- Version already exists: bump version and repeat release steps.
- If publish fails before npm upload: fix and re-run workflow.
- If a bad version is published:
  1. Deprecate bad version:
     - `npm deprecate pi-tmux-window-name@X.Y.Z "broken release; upgrade to >=X.Y.Z+1"`
  2. Cut hotfix `X.Y.Z+1` via same runbook.
- Do **not** unpublish stable versions except for exceptional legal/security cases.
