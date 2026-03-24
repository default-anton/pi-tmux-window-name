import test from "node:test";
import assert from "node:assert/strict";

import { buildRenameWindowArgs, resolveTmuxWindowTarget } from "../extensions/tmux-window-target.ts";

test("buildRenameWindowArgs targets a captured window when available", () => {
  assert.deepEqual(buildRenameWindowArgs("Fix auth flow", "@7"), ["rename-window", "-t", "@7", "Fix auth flow"]);
});

test("buildRenameWindowArgs falls back to current window without a target", () => {
  assert.deepEqual(buildRenameWindowArgs("Fix auth flow"), ["rename-window", "Fix auth flow"]);
});

test("resolveTmuxWindowTarget uses TMUX_PANE and trims the returned window id", async () => {
  const calls: Array<{ command: string; args: string[] }> = [];
  const target = await resolveTmuxWindowTarget(
    async (command, args) => {
      calls.push({ command, args });
      return { code: 0, stdout: "@12\n" };
    },
    { TMUX: "/tmp/tmux-1000/default,123,0", TMUX_PANE: "%42" },
  );

  assert.equal(target, "@12");
  assert.deepEqual(calls, [
    {
      command: "tmux",
      args: ["display-message", "-p", "-t", "%42", "#{window_id}"],
    },
  ]);
});

test("resolveTmuxWindowTarget returns undefined outside tmux or when tmux fails", async () => {
  const outsideTmux = await resolveTmuxWindowTarget(async () => {
    throw new Error("should not run");
  }, {});
  assert.equal(outsideTmux, undefined);

  const failed = await resolveTmuxWindowTarget(
    async () => ({ code: 1, stdout: "" }),
    { TMUX: "/tmp/tmux-1000/default,123,0", TMUX_PANE: "%42" },
  );
  assert.equal(failed, undefined);
});
