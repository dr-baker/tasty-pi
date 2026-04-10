import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import { ToolPreviewConfigStore } from "./config.ts";
import { formatCall, formatResult, summarizeNormalizedResult } from "./format.ts";
import { extractTextContent } from "./preview.ts";
import type { ToolAdapter, ToolStatus } from "./types.ts";

const definitionCache = new Map<string, Map<string, ReturnType<ToolAdapter["createToolDefinition"]>>>();

function getDefinition(adapter: ToolAdapter, cwd: string) {
	let toolDefinitions = definitionCache.get(cwd);
	if (!toolDefinitions) {
		toolDefinitions = new Map();
		definitionCache.set(cwd, toolDefinitions);
	}

	const cached = toolDefinitions.get(adapter.name);
	if (cached) return cached;

	const created = adapter.createToolDefinition(cwd);
	toolDefinitions.set(adapter.name, created);
	return created;
}

function buildPartialWarnings(details: any): string[] {
	const warnings: string[] = [];
	if (details?.truncation?.truncated) warnings.push("output truncated");
	if (details?.fullOutputPath) warnings.push(`full output saved to ${details.fullOutputPath}`);
	return warnings;
}

function buildPartialResult(adapter: ToolAdapter, result: any) {
	const text = extractTextContent(result.content);
	return {
		status: "partial" as ToolStatus,
		primaryLabel: adapter.progressLabel,
		text,
		warnings: buildPartialWarnings(result.details),
		previewDirection: adapter.defaultSettings?.direction,
	};
}

export function registerToolPreviewOverrides(pi: ExtensionAPI, configStore: ToolPreviewConfigStore, adapters: ToolAdapter[]) {
	for (const adapter of adapters) {
		const initialDefinition = getDefinition(adapter, process.cwd());

		pi.registerTool({
			name: initialDefinition.name,
			label: initialDefinition.label,
			description: initialDefinition.description,
			promptSnippet: initialDefinition.promptSnippet,
			promptGuidelines: initialDefinition.promptGuidelines,
			parameters: initialDefinition.parameters,
			prepareArguments: initialDefinition.prepareArguments,

			async execute(toolCallId, params, signal, onUpdate, ctx) {
				return getDefinition(adapter, ctx.cwd).execute(toolCallId, params, signal, onUpdate, ctx);
			},

			renderCall(args, theme, context) {
				const settings = configStore.getToolSettings(adapter.name, adapter.defaultSettings);
				const text = context.lastComponent ?? new Text("", 0, 0);
				text.setText(formatCall(adapter.normalizeCall(args), settings, theme, adapter.name));
				return text;
			},

			renderResult(result, options, theme, context) {
				const settings = configStore.getToolSettings(adapter.name, adapter.defaultSettings);
				const text = context.lastComponent ?? new Text("", 0, 0);
				const normalized = options.isPartial
					? buildPartialResult(adapter, result)
					: adapter.normalizeResult({
							args: context.args,
							result,
							status: context.isError ? "error" : "success",
						});
				const summary = summarizeNormalizedResult(normalized, settings, options.expanded);
				text.setText(formatResult(summary, theme));
				return text;
			},
		});
	}
}
