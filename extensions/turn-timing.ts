/**
 * Turn Timing Extension
 *
 * Shows a one-line UI-only summary after each agent run with a breakdown of
 * total time, assistant/reasoning time, tool time, and residual overhead.
 *
 * Toggle it with /turn-timing [toggle|on|off|status].
 */

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import type { AutocompleteItem } from "@mariozechner/pi-tui";

type Interval = {
	startMs: number;
	endMs: number;
};

type TimingState = {
	agentStartMs: number | null;
	assistantStartMs: number | null;
	assistantTimeMs: number;
	toolIntervals: Interval[];
	activeToolStarts: Map<string, number>;
};

const STATE_ENTRY_TYPE = "turn-timing-state";
const ACTIONS = ["toggle", "on", "off", "status"] as const;

type Action = (typeof ACTIONS)[number];

function createState(): TimingState {
	return {
		agentStartMs: null,
		assistantStartMs: null,
		assistantTimeMs: 0,
		toolIntervals: [],
		activeToolStarts: new Map(),
	};
}

function formatDuration(ms: number): string {
	if (ms < 1000) {
		return `${ms}ms`;
	}

	const totalSeconds = ms / 1000;
	if (totalSeconds < 60) {
		return `${totalSeconds.toFixed(1)}s`;
	}

	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds - minutes * 60;
	return `${minutes}m ${seconds.toFixed(1)}s`;
}

function mergeIntervals(intervals: Interval[]): Interval[] {
	if (intervals.length <= 1) {
		return intervals.slice();
	}

	const sorted = [...intervals].sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);
	const merged: Interval[] = [{ ...sorted[0] }];

	for (let i = 1; i < sorted.length; i++) {
		const current = sorted[i];
		const last = merged[merged.length - 1];

		if (current.startMs <= last.endMs) {
			last.endMs = Math.max(last.endMs, current.endMs);
		} else {
			merged.push({ ...current });
		}
	}

	return merged;
}

function sumIntervals(intervals: Interval[]): number {
	return mergeIntervals(intervals).reduce((sum, interval) => sum + Math.max(0, interval.endMs - interval.startMs), 0);
}

function isStateEntry(entry: unknown): entry is { type: "custom"; customType?: string; data?: { enabled?: unknown } } {
	if (!entry || typeof entry !== "object") return false;
	const value = entry as { type?: unknown; customType?: unknown; data?: unknown };
	return value.type === "custom" && value.customType === STATE_ENTRY_TYPE;
}

function restoreEnabled(ctx: ExtensionContext): boolean | undefined {
	for (const entry of [...ctx.sessionManager.getBranch()].reverse()) {
		if (!isStateEntry(entry)) continue;
		if (typeof entry.data?.enabled === "boolean") {
			return entry.data.enabled;
		}
	}
	return undefined;
}

function normalizeAction(rawArgs: string): Action | undefined {
	const normalized = rawArgs.trim().toLowerCase();
	if (!normalized) return "toggle";
	if (normalized === "enable" || normalized === "enabled") return "on";
	if (normalized === "disable" || normalized === "disabled") return "off";
	if (ACTIONS.includes(normalized as Action)) return normalized as Action;
	return undefined;
}

function autocompleteAction(prefix: string): AutocompleteItem[] | null {
	const lower = prefix.toLowerCase();
	const items = ACTIONS.filter((value) => value.startsWith(lower)).map((value) => ({ value, label: value }));
	return items.length > 0 ? items : null;
}

export default function (pi: ExtensionAPI) {
	let enabled = true;
	let state = createState();

	const resetState = () => {
		state = createState();
	};

	const setEnabled = (nextEnabled: boolean, ctx: ExtensionContext, options?: { persist?: boolean; notify?: boolean }) => {
		enabled = nextEnabled;

		if (options?.persist !== false) {
			pi.appendEntry(STATE_ENTRY_TYPE, { enabled });
		}


		if (options?.notify !== false) {
			ctx.ui.notify(`Turn timing ${enabled ? "enabled" : "disabled"}`, enabled ? "info" : "warning");
		}
	};

	pi.registerCommand("turn-timing", {
		description: "Toggle one-line turn timing breakdown: /turn-timing [toggle|on|off|status]",
		getArgumentCompletions: autocompleteAction,
		handler: async (args, ctx) => {
			const action = normalizeAction(args);
			if (!action) {
				ctx.ui.notify("Usage: /turn-timing [toggle|on|off|status]", "warning");
				return;
			}

			switch (action) {
				case "status": {
					ctx.ui.notify(`Turn timing is ${enabled ? "on" : "off"}`, "info");
					return;
				}
				case "toggle":
					setEnabled(!enabled, ctx);
					return;
				case "on":
					setEnabled(true, ctx);
					return;
				case "off":
					setEnabled(false, ctx);
					return;
			}
		},
	});

	pi.on("session_start", (_event, ctx) => {
		resetState();
		const restored = restoreEnabled(ctx);
		enabled = restored ?? true;
	});

	pi.on("agent_start", () => {
		resetState();
		state.agentStartMs = Date.now();
	});

	pi.on("message_start", (event) => {
		if (event.message.role !== "assistant") {
			return;
		}

		state.assistantStartMs = Date.now();
	});

	pi.on("message_end", (event) => {
		if (event.message.role !== "assistant" || state.assistantStartMs === null) {
			return;
		}

		state.assistantTimeMs += Math.max(0, Date.now() - state.assistantStartMs);
		state.assistantStartMs = null;
	});

	pi.on("tool_execution_start", (event) => {
		state.activeToolStarts.set(event.toolCallId, Date.now());
	});

	pi.on("tool_execution_end", (event) => {
		const startMs = state.activeToolStarts.get(event.toolCallId);
		if (startMs === undefined) {
			return;
		}

		state.toolIntervals.push({ startMs, endMs: Date.now() });
		state.activeToolStarts.delete(event.toolCallId);
	});

	pi.on("agent_end", (_event, ctx) => {
		const endMs = Date.now();
		if (state.agentStartMs === null) {
			resetState();
			return;
		}

		if (state.assistantStartMs !== null) {
			state.assistantTimeMs += Math.max(0, endMs - state.assistantStartMs);
			state.assistantStartMs = null;
		}

		for (const startMs of state.activeToolStarts.values()) {
			state.toolIntervals.push({ startMs, endMs });
		}
		state.activeToolStarts.clear();

		if (enabled && ctx.hasUI) {
			const toolTimeMs = sumIntervals(state.toolIntervals);
			const totalMs = Math.max(0, endMs - state.agentStartMs);
			const reasoningMs = Math.max(0, state.assistantTimeMs);
			const otherMs = Math.max(0, totalMs - reasoningMs - toolTimeMs);

			const line = `⏱ total ${formatDuration(totalMs)} | reasoning ${formatDuration(reasoningMs)} | tools ${formatDuration(toolTimeMs)} | other ${formatDuration(otherMs)}`;

			ctx.ui.notify(line, "info");
		}

		resetState();
	});
}
