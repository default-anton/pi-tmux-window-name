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
