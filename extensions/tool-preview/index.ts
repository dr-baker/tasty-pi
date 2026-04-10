import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { ToolExecutionComponent } from "@mariozechner/pi-coding-agent";
import { TOOL_PREVIEW_CONFIG_PATH, ToolPreviewConfigStore } from "./config.ts";
import { toolAdapters } from "./adapters.ts";
import { registerToolPreviewOverrides } from "./override.ts";

function report(message: string, ctx: { hasUI: boolean; ui: { notify: (message: string, level: "info" | "warning" | "error") => void } }, level: "info" | "warning" | "error") {
	if (ctx.hasUI) ctx.ui.notify(message, level);
	else console.log(message);
}

function applyCompactToolExecutionPatch(configStore: ToolPreviewConfigStore) {
	const proto = ToolExecutionComponent.prototype as any;
	if (proto.__toolPreviewCompactPatchApplied) return;

	const originalUpdateDisplay = proto.updateDisplay;
	if (typeof originalUpdateDisplay !== "function") return;

	proto.updateDisplay = function (...args: any[]) {
		const settings = configStore.getToolSettings(this.toolName ?? "read");
		const desiredOuterSpacing = settings.outerSpacing;

		if (Array.isArray(this.children)) {
			let leadingSpacer = this.children[0];
			while (leadingSpacer?.constructor?.name === "Spacer") {
				if (desiredOuterSpacing > 0) break;
				this.removeChild(leadingSpacer);
				leadingSpacer = this.children[0];
			}
		}

		if (this.contentBox) {
			this.contentBox.paddingX = settings.paddingX;
			this.contentBox.paddingY = settings.paddingY;
			this.contentBox.invalidate?.();
		}

		if (this.contentText) {
			this.contentText.paddingX = settings.paddingX;
			this.contentText.paddingY = settings.paddingY;
			this.contentText.invalidate?.();
		}

		return originalUpdateDisplay.apply(this, args);
	};

	proto.__toolPreviewCompactPatchApplied = true;
}

export default function (pi: ExtensionAPI) {
	const configStore = new ToolPreviewConfigStore();
	applyCompactToolExecutionPatch(configStore);
	configStore.load();

	pi.registerCommand("tool-preview-path", {
		description: "Show the tool preview config path",
		handler: async (_args, ctx) => {
			report(`Tool preview config: ${TOOL_PREVIEW_CONFIG_PATH}`, ctx, "info");
		},
	});

	pi.registerCommand("tool-preview-reload", {
		description: "Reload tool preview config from disk",
		handler: async (_args, ctx) => {
			const result = configStore.load();
			if (!result.ok) {
				report(`Failed to load tool preview config: ${result.error}`, ctx, "error");
				return;
			}

			const status = result.found ? "reloaded config" : "config file not found, using defaults";
			report(`Tool preview ${status}: ${TOOL_PREVIEW_CONFIG_PATH}`, ctx, "info");
		},
	});

	registerToolPreviewOverrides(pi, configStore, toolAdapters);
}
