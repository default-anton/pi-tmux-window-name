# Changelog

All notable changes to `pi-tmux-window-name` are documented here.

## Format

- Keep `## [Unreleased]` at the top.
- Use release headers as `## [X.Y.Z] - YYYY-MM-DD`.
- Group entries under `### Added`, `### Changed`, `### Fixed` (optionally `### Removed` / `### Security`).
- Keep entries short and operator/user-facing.

## [Unreleased]

### Added

- None.

### Changed

- None.

### Fixed

- None.

## [0.4.4] - 2026-04-21

### Added

- None.

### Changed

- Updated `@mariozechner/pi-ai` and `@mariozechner/pi-coding-agent` in peer and dev dependencies to `^0.68.0` for pi 0.68.0 compatibility.

### Fixed

- None.

## [0.4.3] - 2026-04-03

### Added

- None.

### Changed

- Updated `@mariozechner/pi-ai` and `@mariozechner/pi-coding-agent` in peer and dev dependencies to `^0.65.0`.
- Updated restore-flow docs to reflect pi 0.65.0 `session_start` handling.

### Fixed

- Removed the deprecated `session_switch` listener and now rely on `session_start` for pi 0.65.0 compatibility.

## [0.4.2] - 2026-03-27

### Added

- None.

### Changed

- Updated `@mariozechner/pi-ai` and `@mariozechner/pi-coding-agent` in peer and dev dependencies to `^0.63.1`.
- Added a TypeScript `check` script and included it in `release:gate` so future pi SDK/API changes fail fast before publish.

### Fixed

- Updated model-auth lookup to use pi's request-scoped auth API, so naming still works with dynamic model headers in pi `0.63.x`.

## [0.4.1] - 2026-03-24

### Added

- None.

### Changed

- None.

### Fixed

- Updated the release workflow to `actions/checkout@v6` and `actions/setup-node@v6` so releases no longer rely on the deprecated Node 20 GitHub Actions runtime.

## [0.4.0] - 2026-03-24

### Added

- Added `PI_TMUX_WINDOW_NAME_DISABLED=1` to disable tmux/session naming and the `/rename` command, which is useful for sub-agents.

### Changed

- None.

### Fixed

- None.

## [0.3.1] - 2026-03-24

### Added

- None.

### Changed

- None.

### Fixed

- Captured the tmux window target before async name generation so switching tmux windows mid-request no longer renames the wrong window.

## [0.3.0] - 2026-03-11

### Added

- Added `/rename` to recompute tmux/session names from user and assistant message text in the current branch.

### Changed

- None.

### Fixed

- Capped naming input length so auto naming and `/rename` do not send unbounded branch text to the model.

## [0.2.2] - 2026-02-26

### Added

- None.

### Changed

- None.

### Fixed

- Fixed name generation for OpenAI reasoning models by switching naming requests to `reasoning: "none"` so text output is returned and parsed.
- Ensured tmux/session naming completes in non-interactive runs (`pi -p`) by awaiting naming in `before_agent_start` when `ctx.hasUI` is false.

## [0.2.1] - 2026-02-25

### Added

- None.

### Changed

- Updated naming prompt/examples to request sentence case output (for example, `Logical commit push`).

### Fixed

- Removed JS title-case normalization so generated window/session casing is preserved as returned by the model.

## [0.2.0] - 2026-02-25

### Added

- None.

### Changed

- Switched tmux window naming from a 24-character cap to 3–4 word titles.
- Added separate longer 8–12 word session names for better `/resume` list scanning.
- Persisted short tmux titles in custom session entries so resumes restore concise window names even with long session titles.
- Removed fallback naming; on generation errors or invalid model output, existing names are preserved unchanged.

### Fixed

- None.

## [0.1.0] - 2026-02-25

### Added

- Initial release of `pi-tmux-window-name`.
- Packaged tmux window naming extension for pi with npm/git installation support.
- Added release automation scaffolding (verify tag, changelog release notes, GitHub release workflow).

### Changed

- Increased model completion `maxTokens` from 24 to 40 while preserving 24-character output cap and naming rules.

### Fixed

- None.
