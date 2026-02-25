# pi-tmux-window-name

Auto-name tmux windows for [pi](https://github.com/badlogic/pi-mono) coding sessions.

## Installation

From npm (after publish):

```bash
pi install npm:pi-tmux-window-name
```

From git:

```bash
pi install git:github.com/default-anton/pi-tmux-window-name
```

Or run without installing:

```bash
pi -e npm:pi-tmux-window-name
# or
pi -e git:github.com/default-anton/pi-tmux-window-name
```

## What it does

- Watches session lifecycle and the first user prompt.
- Generates a short 1–2 word title from the prompt.
- Persists the generated session name with `pi.setSessionName(...)`.
- Renames the current tmux window (when running inside tmux).
- Keeps final names capped at 24 characters.
- Falls back to deterministic local naming when model or API key is unavailable.

## Extension behavior

- Names are generated once per session, then reused when switching/resuming sessions.
- Existing session names are restored to tmux window names on `session_start` and `session_switch`.
- Name normalization strips punctuation and keeps alphanumeric words.

## Development

```bash
npm run pack:check
```

## License

Apache-2.0
