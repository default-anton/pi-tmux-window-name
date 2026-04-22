import assert from "node:assert/strict";
import test from "node:test";

import {
	DISABLE_ENV_VAR,
	isTmuxWindowNameExtensionDisabled,
} from "../extensions/disable.ts";
import tmuxWindowNameExtension from "../extensions/index.ts";
import {
	buildRenameWindowArgs,
	resolveTmuxWindowTarget,
} from "../extensions/tmux-window-target.ts";

type RenameHarness = {
	run: (args: string) => Promise<void>;
	execCalls: Array<{ command: string; args: string[] }>;
	notifications: Array<{ message: string; level: string }>;
	setSessionNameCalls: string[];
	appendEntryCalls: Array<[string, unknown]>;
};

function createRenameHarness(): RenameHarness {
	const previousTmux = process.env.TMUX;
	const previousPane = process.env.TMUX_PANE;
	process.env.TMUX = "/tmp/tmux-1000/default,123,0";
	process.env.TMUX_PANE = "%42";

	const execCalls: Array<{ command: string; args: string[] }> = [];
	const notifications: Array<{ message: string; level: string }> = [];
	const setSessionNameCalls: string[] = [];
	const appendEntryCalls: Array<[string, unknown]> = [];
	let renameHandler: ((args: string, ctx: any) => Promise<void>) | undefined;

	tmuxWindowNameExtension({
		exec: async (command: string, args: string[]) => {
			execCalls.push({ command, args });
			return { code: 0, stdout: "@9\n" };
		},
		getSessionName: () => undefined,
		setSessionName: async (name: string) => {
			setSessionNameCalls.push(name);
		},
		appendEntry: async (type: string, data: unknown) => {
			appendEntryCalls.push([type, data]);
		},
		registerCommand(
			_name: string,
			spec: { handler: (args: string, ctx: any) => Promise<void> },
		) {
			renameHandler = spec.handler;
		},
		on() {},
	} as any);

	if (!renameHandler) throw new Error("rename handler was not registered");

	return {
		execCalls,
		notifications,
		setSessionNameCalls,
		appendEntryCalls,
		run: async (args: string) => {
			try {
				await renameHandler!(args, {
					hasUI: false,
					waitForIdle: async () => {},
					sessionManager: { getBranch: () => [] },
				});
			} finally {
				if (previousTmux === undefined) delete process.env.TMUX;
				else process.env.TMUX = previousTmux;
				if (previousPane === undefined) delete process.env.TMUX_PANE;
				else process.env.TMUX_PANE = previousPane;
			}
		},
	};
}

test("buildRenameWindowArgs targets a captured window when available", () => {
	assert.deepEqual(buildRenameWindowArgs("Fix auth flow", "@7"), [
		"rename-window",
		"-t",
		"@7",
		"Fix auth flow",
	]);
});

test("buildRenameWindowArgs falls back to current window without a target", () => {
	assert.deepEqual(buildRenameWindowArgs("Fix auth flow"), [
		"rename-window",
		"Fix auth flow",
	]);
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

test("isTmuxWindowNameExtensionDisabled accepts standard truthy env values", () => {
	for (const value of ["1", "true", "TRUE", " yes ", "on"]) {
		assert.equal(
			isTmuxWindowNameExtensionDisabled({ [DISABLE_ENV_VAR]: value }),
			true,
		);
	}
});

test("isTmuxWindowNameExtensionDisabled ignores empty and falsey-looking env values", () => {
	for (const value of [undefined, "", "0", "false", "no", "off", "disabled"]) {
		assert.equal(
			isTmuxWindowNameExtensionDisabled({ [DISABLE_ENV_VAR]: value }),
			false,
		);
	}
});

test("tmux extension registers rename and lifecycle hooks", () => {
	const previous = process.env[DISABLE_ENV_VAR];
	delete process.env[DISABLE_ENV_VAR];

	try {
		const events: string[] = [];
		const commands: string[] = [];

		tmuxWindowNameExtension({
			on(event: string) {
				events.push(event);
			},
			registerCommand(name: string) {
				commands.push(name);
			},
		} as any);

		assert.equal(events.includes("session_start"), true);
		assert.equal(events.includes("before_agent_start"), true);
		assert.equal(events.includes("session_switch"), false);
		assert.deepEqual(commands, ["rename"]);
	} finally {
		if (previous === undefined) delete process.env[DISABLE_ENV_VAR];
		else process.env[DISABLE_ENV_VAR] = previous;
	}
});

test("/rename with an argument uses that as the tmux window name", async () => {
	const harness = createRenameHarness();

	await harness.run("  Custom window name!!  ");

	assert.deepEqual(harness.execCalls, [
		{
			command: "tmux",
			args: ["display-message", "-p", "-t", "%42", "#{window_id}"],
		},
		{
			command: "tmux",
			args: ["rename-window", "-t", "@9", "Custom window name"],
		},
	]);
	assert.deepEqual(harness.setSessionNameCalls, ["Custom window name"]);
	assert.deepEqual(harness.appendEntryCalls, [
		["pi-tmux-window-name/window", { windowName: "Custom window name" }],
	]);
	assert.deepEqual(harness.notifications, []);
});

test("/rename without arguments follows the generated-name path", async () => {
	const harness = createRenameHarness();

	await harness.run("");

	assert.deepEqual(harness.execCalls, []);
	assert.deepEqual(harness.setSessionNameCalls, []);
	assert.deepEqual(harness.appendEntryCalls, []);
	assert.deepEqual(harness.notifications, []);
});
