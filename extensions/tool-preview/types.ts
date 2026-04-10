import type { AgentToolResult, ToolDefinition } from "@mariozechner/pi-coding-agent";

export type BuiltinToolName = "read" | "bash" | "edit" | "write" | "grep" | "find" | "ls";

export type PreviewDirection = "head" | "tail";

export type SummaryTone = "accent" | "success" | "warning" | "error" | "muted" | "dim" | "toolOutput";

export type ToolPreviewSettings = {
	collapsedLines: number;
	expandedLines: number;
	commandMaxChars: number;
	direction: PreviewDirection;
	paddingX: number;
	paddingY: number;
	outerSpacing: number;
};

export type ToolPreviewConfigFile = {
	defaults?: Partial<ToolPreviewSettings>;
	tools?: Record<string, Partial<ToolPreviewSettings>>;
};

export type NormalizedCall = {
	primary: string;
	meta?: string[];
};

export type SummaryToken = {
	text: string;
	tone?: SummaryTone;
};

export type ToolStatus = "success" | "error" | "partial";

export type NormalizedToolResult = {
	status: ToolStatus;
	primaryLabel: string;
	secondaryLabels?: SummaryToken[];
	text?: string;
	warnings?: string[];
	previewDirection?: PreviewDirection;
};

export type PreviewSlice = {
	lines: string[];
	totalLines: number;
	hiddenBefore: number;
	hiddenAfter: number;
	direction: PreviewDirection;
};

export type ToolSummary = {
	status: ToolStatus;
	primaryLabel: SummaryToken;
	secondaryLabels: SummaryToken[];
	warnings: SummaryToken[];
	preview?: PreviewSlice;
};

export type ToolAdapter = {
	name: BuiltinToolName;
	progressLabel: string;
	defaultSettings?: Partial<ToolPreviewSettings>;
	createToolDefinition(cwd: string): ToolDefinition<any, any, any>;
	normalizeCall(args: any): NormalizedCall;
	normalizeResult(input: {
		args: any;
		result: AgentToolResult<any>;
		status: Exclude<ToolStatus, "partial">;
	}): NormalizedToolResult;
};
