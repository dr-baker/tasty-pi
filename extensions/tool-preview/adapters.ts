import type {
	BashToolDetails,
	EditToolDetails,
	FindToolDetails,
	GrepToolDetails,
	LsToolDetails,
	ReadToolDetails,
} from "@mariozechner/pi-coding-agent";
import {
	createBashToolDefinition,
	createEditToolDefinition,
	createFindToolDefinition,
	createGrepToolDefinition,
	createLsToolDefinition,
	createReadToolDefinition,
	createWriteToolDefinition,
} from "@mariozechner/pi-coding-agent";
import {
	byteCount,
	countLines,
	countLsKinds,
	countMatches,
	countUniqueGrepFiles,
	lastNonEmptyLine,
	pluralize,
	stripTrailingNoticeBlock,
	truncateInline,
} from "./preview.ts";
import type { SummaryToken, ToolAdapter } from "./types.ts";

function addTruncationWarning(warnings: string[], details: { truncation?: { truncated?: boolean } } | undefined, label = "output truncated") {
	if (details?.truncation?.truncated) warnings.push(label);
}

function parseExitCode(text: string): number | undefined {
	const match = text.match(/(?:Command exited with code|exit code:)\s+(\d+)/i);
	if (!match) return undefined;
	return Number.parseInt(match[1], 10);
}

function diffStats(diff: string) {
	let additions = 0;
	let removals = 0;

	for (const line of diff.split("\n")) {
		if (line.startsWith("+++") || line.startsWith("---")) continue;
		if (line.startsWith("+")) additions++;
		if (line.startsWith("-")) removals++;
	}

	return { additions, removals };
}

function countListedLines(text: string): number {
	return stripTrailingNoticeBlock(text)
		.split("\n")
		.filter((line) => line.trim().length > 0).length;
}

function resultMetrics(...tokens: Array<SummaryToken | undefined>): SummaryToken[] {
	return tokens.filter((token): token is SummaryToken => Boolean(token));
}

export const toolAdapters: ToolAdapter[] = [
	{
		name: "read",
		progressLabel: "Reading",
		createToolDefinition: (cwd) => createReadToolDefinition(cwd),
		normalizeCall(args) {
			const meta: string[] = [];
			if (typeof args.offset === "number") meta.push(`offset ${args.offset}`);
			if (typeof args.limit === "number") meta.push(`limit ${args.limit}`);
			return { primary: args.path ?? "", meta };
		},
		normalizeResult({ result, status }) {
			const details = result.details as ReadToolDetails | undefined;
			const warnings: string[] = [];
			addTruncationWarning(warnings, details, "file output truncated");
			const text = result.content.find((part) => part.type === "text")?.text ?? "";
			const hasImage = result.content.some((part) => part.type === "image");
			const visibleText = stripTrailingNoticeBlock(text);
			const lineCount = countLines(visibleText);

			return {
				status,
				primaryLabel: status === "error" ? "read failed" : hasImage ? "image loaded" : `${lineCount} ${pluralize(lineCount, "line")}`,
				secondaryLabels: resultMetrics(hasImage ? { text: "image", tone: "accent" } : undefined),
				text,
				warnings,
			};
		},
	},
	{
		name: "bash",
		progressLabel: "Running",
		defaultSettings: { direction: "tail" },
		createToolDefinition: (cwd) => createBashToolDefinition(cwd),
		normalizeCall(args) {
			const meta: string[] = [];
			if (typeof args.timeout === "number") meta.push(`timeout ${args.timeout}s`);
			return { primary: args.command ?? "", meta };
		},
		normalizeResult({ result, status }) {
			const details = result.details as BashToolDetails | undefined;
			const warnings: string[] = [];
			addTruncationWarning(warnings, details);
			if (details?.fullOutputPath) warnings.push(`full output saved to ${details.fullOutputPath}`);
			const text = result.content.find((part) => part.type === "text")?.text ?? "";
			const outputWithoutNotice = stripTrailingNoticeBlock(text);
			const lineCount = countLines(outputWithoutNotice);
			const exitCode = parseExitCode(text);
			const lastOutput = truncateInline(lastNonEmptyLine(outputWithoutNotice), 72);

			return {
				status,
				primaryLabel: status === "error" ? `exit ${exitCode ?? "error"}` : "command finished",
				secondaryLabels: resultMetrics(
					{ text: `${lineCount} ${pluralize(lineCount, "line")}`, tone: "muted" },
					lastOutput ? { text: `last: ${lastOutput}`, tone: "dim" } : undefined,
				),
				text,
				warnings,
				previewDirection: "tail",
			};
		},
	},
	{
		name: "edit",
		progressLabel: "Editing",
		createToolDefinition: (cwd) => createEditToolDefinition(cwd),
		normalizeCall(args) {
			return {
				primary: args.path ?? "",
				meta: [`${args.edits?.length ?? 0} ${pluralize(args.edits?.length ?? 0, "block")}`],
			};
		},
		normalizeResult({ args, result, status }) {
			const details = result.details as EditToolDetails | undefined;
			const text = status === "success" && details?.diff ? details.diff : result.content.find((part) => part.type === "text")?.text ?? "";
			const { additions, removals } = diffStats(details?.diff ?? "");

			return {
				status,
				primaryLabel:
					status === "error"
						? "edit failed"
						: `${args.edits?.length ?? 0} ${pluralize(args.edits?.length ?? 0, "block")} replaced`,
				secondaryLabels: resultMetrics(
					details?.diff ? { text: `+${additions}`, tone: "success" } : undefined,
					details?.diff ? { text: `-${removals}`, tone: "error" } : undefined,
					typeof details?.firstChangedLine === "number"
						? { text: `line ${details.firstChangedLine}`, tone: "muted" }
						: undefined,
				),
				text,
				warnings: [],
			};
		},
	},
	{
		name: "write",
		progressLabel: "Writing",
		createToolDefinition: (cwd) => createWriteToolDefinition(cwd),
		normalizeCall(args) {
			const content = typeof args.content === "string" ? args.content : "";
			const lineCount = countLines(content);
			return {
				primary: args.path ?? "",
				meta: [`${lineCount} ${pluralize(lineCount, "line")}`, `${byteCount(content)} bytes`],
			};
		},
		normalizeResult({ args, result, status }) {
			const previewText = typeof args.content === "string" ? args.content : result.content.find((part) => part.type === "text")?.text ?? "";
			const lineCount = countLines(previewText);
			const bytes = byteCount(typeof args.content === "string" ? args.content : previewText);

			return {
				status,
				primaryLabel: status === "error" ? "write failed" : `${bytes} bytes written`,
				secondaryLabels: resultMetrics({ text: `${lineCount} ${pluralize(lineCount, "line")}`, tone: "muted" }),
				text: previewText,
				warnings: [],
			};
		},
	},
	{
		name: "grep",
		progressLabel: "Searching",
		createToolDefinition: (cwd) => createGrepToolDefinition(cwd),
		normalizeCall(args) {
			const meta: string[] = [];
			if (args.path) meta.push(`in ${args.path}`);
			if (args.glob) meta.push(`glob ${args.glob}`);
			if (typeof args.context === "number" && args.context > 0) meta.push(`±${args.context}`);
			if (args.ignoreCase) meta.push("ignore case");
			if (args.literal) meta.push("literal");
			if (typeof args.limit === "number") meta.push(`limit ${args.limit}`);
			return { primary: args.pattern ?? "", meta };
		},
		normalizeResult({ result, status }) {
			const details = result.details as GrepToolDetails | undefined;
			const warnings: string[] = [];
			addTruncationWarning(warnings, details);
			if (details?.matchLimitReached) warnings.push(`${details.matchLimitReached} match limit reached`);
			if (details?.linesTruncated) warnings.push("long lines shortened");
			const text = result.content.find((part) => part.type === "text")?.text ?? "";
			const cleanText = stripTrailingNoticeBlock(text);
			const matches = countMatches(cleanText, /:\d+:/);
			const files = countUniqueGrepFiles(cleanText);

			return {
				status,
				primaryLabel: status === "error" ? "grep failed" : matches > 0 ? `${matches} ${pluralize(matches, "match")}` : "no matches",
				secondaryLabels: resultMetrics(files > 0 ? { text: `${files} ${pluralize(files, "file")}`, tone: "muted" } : undefined),
				text,
				warnings,
			};
		},
	},
	{
		name: "find",
		progressLabel: "Finding",
		createToolDefinition: (cwd) => createFindToolDefinition(cwd),
		normalizeCall(args) {
			const meta: string[] = [];
			if (args.path) meta.push(`in ${args.path}`);
			if (typeof args.limit === "number") meta.push(`limit ${args.limit}`);
			return { primary: args.pattern ?? "", meta };
		},
		normalizeResult({ result, status }) {
			const details = result.details as FindToolDetails | undefined;
			const warnings: string[] = [];
			addTruncationWarning(warnings, details);
			if (details?.resultLimitReached) warnings.push(`${details.resultLimitReached} result limit reached`);
			const text = result.content.find((part) => part.type === "text")?.text ?? "";
			const count = text.includes("No files found") ? 0 : countListedLines(text);

			return {
				status,
				primaryLabel: status === "error" ? "find failed" : count > 0 ? `${count} ${pluralize(count, "file")}` : "no files found",
				secondaryLabels: resultMetrics(),
				text,
				warnings,
			};
		},
	},
	{
		name: "ls",
		progressLabel: "Listing",
		createToolDefinition: (cwd) => createLsToolDefinition(cwd),
		normalizeCall(args) {
			const meta: string[] = [];
			if (typeof args.limit === "number") meta.push(`limit ${args.limit}`);
			return { primary: args.path ?? ".", meta };
		},
		normalizeResult({ result, status }) {
			const details = result.details as LsToolDetails | undefined;
			const warnings: string[] = [];
			addTruncationWarning(warnings, details);
			if (details?.entryLimitReached) warnings.push(`${details.entryLimitReached} entry limit reached`);
			const text = result.content.find((part) => part.type === "text")?.text ?? "";
			const count = text.includes("(empty directory)") ? 0 : countListedLines(text);
			const kinds = countLsKinds(stripTrailingNoticeBlock(text));

			return {
				status,
				primaryLabel: status === "error" ? "ls failed" : count > 0 ? `${count} ${pluralize(count, "entry")}` : "empty directory",
				secondaryLabels: resultMetrics(
					count > 0 ? { text: `${kinds.dirs} ${pluralize(kinds.dirs, "dir")}`, tone: "muted" } : undefined,
					count > 0 ? { text: `${kinds.files} ${pluralize(kinds.files, "file")}`, tone: "muted" } : undefined,
				),
				text,
				warnings,
			};
		},
	},
];
