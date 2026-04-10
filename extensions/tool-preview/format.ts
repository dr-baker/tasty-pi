import type {
	NormalizedCall,
	NormalizedToolResult,
	PreviewSlice,
	SummaryToken,
	ToolPreviewSettings,
	ToolStatus,
	ToolSummary,
} from "./types.ts";
import { pluralize, slicePreview, truncateInline } from "./preview.ts";

function tone(theme: any, value: SummaryToken): string {
	const color = value.tone ?? "text";
	return theme.fg(color, value.text);
}

function statusTone(status: ToolStatus): SummaryToken["tone"] {
	switch (status) {
		case "error":
			return "error";
		case "partial":
			return "warning";
		default:
			return "success";
	}
}

function statusIcon(status: ToolStatus): string {
	switch (status) {
		case "error":
			return "✕";
		case "partial":
			return "…";
		default:
			return "✓";
	}
}

function joinTokens(tokens: SummaryToken[], theme: any): string {
	return tokens.map((token) => tone(theme, token)).join(theme.fg("dim", " · "));
}

function formatPreviewSlice(slice: PreviewSlice, theme: any): string[] {
	const lines: string[] = [];

	if (slice.hiddenBefore > 0) {
		lines.push(theme.fg("muted", `… ${slice.hiddenBefore} earlier ${pluralize(slice.hiddenBefore, "line")}`));
	}

	for (const line of slice.lines) {
		const prefix = theme.fg("dim", "  ");
		lines.push(line.length > 0 ? `${prefix}${theme.fg("toolOutput", line)}` : prefix);
	}

	if (slice.hiddenAfter > 0) {
		lines.push(theme.fg("muted", `… ${slice.hiddenAfter} more ${pluralize(slice.hiddenAfter, "line")}`));
	}

	return lines;
}

export function formatCall(call: NormalizedCall, settings: ToolPreviewSettings, theme: any, toolName: string): string {
	const parts = [theme.fg("toolTitle", theme.bold(toolName))];
	const primary = truncateInline(call.primary, settings.commandMaxChars);
	if (primary) parts.push(theme.fg("accent", primary));
	if (call.meta?.length) parts.push(theme.fg("muted", `(${call.meta.join(", ")})`));
	return parts.join(" ");
}

export function summarizeNormalizedResult(
	normalized: NormalizedToolResult,
	settings: ToolPreviewSettings,
	expanded: boolean,
): ToolSummary {
	const previewLineLimit = expanded ? settings.expandedLines : settings.collapsedLines;
	const preview = slicePreview(normalized.text, previewLineLimit, normalized.previewDirection ?? settings.direction);

	return {
		status: normalized.status,
		primaryLabel: {
			text: normalized.primaryLabel,
			tone: statusTone(normalized.status),
		},
		secondaryLabels: normalized.secondaryLabels ?? [],
		warnings: (normalized.warnings ?? []).map((warning) => ({ text: warning, tone: "warning" })),
		preview,
	};
}

export function formatResult(summary: ToolSummary, theme: any): string {
	const headerTokens: SummaryToken[] = [
		{ text: statusIcon(summary.status), tone: statusTone(summary.status) },
		summary.primaryLabel,
		...summary.secondaryLabels,
	];
	const lines = [joinTokens(headerTokens, theme)];

	for (const warning of summary.warnings) {
		lines.push(theme.fg("warning", `! ${warning.text}`));
	}

	if (summary.preview) {
		lines.push(...formatPreviewSlice(summary.preview, theme));
	}

	return lines.join("\n");
}
