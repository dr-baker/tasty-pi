import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import YAML from "yaml";
import type { PreviewDirection, ToolPreviewConfigFile, ToolPreviewSettings } from "./types.ts";

const DEFAULT_SETTINGS: ToolPreviewSettings = {
	collapsedLines: 4,
	expandedLines: 20,
	commandMaxChars: 96,
	direction: "head",
	paddingX: 0,
	paddingY: 0,
	outerSpacing: 0,
};

export const TOOL_PREVIEW_CONFIG_PATH = join(homedir(), ".pi", "agent", "tool-preview-lengths.yaml");

function isDirection(value: unknown): value is PreviewDirection {
	return value === "head" || value === "tail";
}

function normalizeNumber(value: unknown): number | undefined {
	if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
	return Math.max(0, Math.floor(value));
}

function normalizePartialSettings(input: unknown): Partial<ToolPreviewSettings> {
	if (!input || typeof input !== "object") return {};

	const raw = input as Record<string, unknown>;
	const collapsedLines = normalizeNumber(raw.collapsedLines ?? raw.collapsed_lines);
	const expandedLines = normalizeNumber(raw.expandedLines ?? raw.expanded_lines);
	const commandMaxChars = normalizeNumber(raw.commandMaxChars ?? raw.command_max_chars);
	const direction = isDirection(raw.direction) ? raw.direction : undefined;
	const paddingX = normalizeNumber(raw.paddingX ?? raw.padding_x);
	const paddingY = normalizeNumber(raw.paddingY ?? raw.padding_y);
	const outerSpacing = normalizeNumber(raw.outerSpacing ?? raw.outer_spacing);

	return {
		...(collapsedLines === undefined ? {} : { collapsedLines }),
		...(expandedLines === undefined ? {} : { expandedLines }),
		...(commandMaxChars === undefined ? {} : { commandMaxChars }),
		...(direction === undefined ? {} : { direction }),
		...(paddingX === undefined ? {} : { paddingX }),
		...(paddingY === undefined ? {} : { paddingY }),
		...(outerSpacing === undefined ? {} : { outerSpacing }),
	};
}

function finalizeSettings(input: Partial<ToolPreviewSettings>): ToolPreviewSettings {
	const collapsedLines = input.collapsedLines ?? DEFAULT_SETTINGS.collapsedLines;
	const expandedLines = input.expandedLines ?? DEFAULT_SETTINGS.expandedLines;
	const commandMaxChars = input.commandMaxChars ?? DEFAULT_SETTINGS.commandMaxChars;
	const direction = input.direction ?? DEFAULT_SETTINGS.direction;
	const paddingX = input.paddingX ?? DEFAULT_SETTINGS.paddingX;
	const paddingY = input.paddingY ?? DEFAULT_SETTINGS.paddingY;
	const outerSpacing = input.outerSpacing ?? DEFAULT_SETTINGS.outerSpacing;

	return {
		collapsedLines,
		expandedLines: Math.max(expandedLines, collapsedLines),
		commandMaxChars: Math.max(12, commandMaxChars),
		direction,
		paddingX,
		paddingY,
		outerSpacing,
	};
}

export class ToolPreviewConfigStore {
	private config: ToolPreviewConfigFile = {};
	private error: string | undefined;

	load(): { ok: boolean; error?: string; found: boolean } {
		if (!existsSync(TOOL_PREVIEW_CONFIG_PATH)) {
			this.config = {};
			this.error = undefined;
			return { ok: true, found: false };
		}

		try {
			const raw = readFileSync(TOOL_PREVIEW_CONFIG_PATH, "utf8");
			const parsed = YAML.parse(raw);
			this.config = parsed && typeof parsed === "object" ? (parsed as ToolPreviewConfigFile) : {};
			this.error = undefined;
			return { ok: true, found: true };
		} catch (error) {
			this.config = {};
			this.error = error instanceof Error ? error.message : String(error);
			return { ok: false, error: this.error, found: true };
		}
	}

	getLastError() {
		return this.error;
	}

	getToolSettings(toolName: string, adapterDefaults?: Partial<ToolPreviewSettings>): ToolPreviewSettings {
		const merged = {
			...DEFAULT_SETTINGS,
			...normalizePartialSettings(adapterDefaults),
			...normalizePartialSettings(this.config.defaults),
			...normalizePartialSettings(this.config.tools?.[toolName]),
		};

		return finalizeSettings(merged);
	}
}
