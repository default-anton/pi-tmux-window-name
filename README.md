# pi-tmux-window-name

Auto-name tmux windows and session titles for [pi](https://github.com/badlogic/pi-mono) coding sessions.

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
- Generates two names from the prompt:
  - **tmux window title**: concise 3–4 words.
  - **pi session name**: longer 8–12 word summary for `/resume` scanning.
- Persists the session name with `pi.setSessionName(...)`.
- Persists the short tmux title in a custom session entry for reliable restore.
- Renames the current tmux window (when running inside tmux).
- Adds `/rename` to recompute names from the current branch conversation so far.
- If generation fails or output is invalid, leaves session/tmux names unchanged.

## Extension behavior

- Names are generated once per session, then reused when switching/resuming sessions.
- `/rename` takes no arguments and rebuilds the name from user and assistant message text in the current branch.
- `/rename` ignores reasoning blocks, tool calls/results, and images.
- On `session_start` / `session_switch`, tmux restore prefers the stored short title and falls back to a compacted session name.
- Name normalization strips punctuation and keeps alphanumeric words.

## Development

```bash
npm run pack:check
```

## License

Apache-2.0
