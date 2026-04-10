import type { PreviewDirection, PreviewSlice } from "./types.ts";

export function normalizeText(text: string | undefined | null): string {
	return (text ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export function extractTextContent(content: Array<{ type: string; text?: string }> | undefined): string {
	if (!content?.length) return "";

	const parts = content.flatMap((part) => (part?.type === "text" && typeof part.text === "string" ? [part.text] : []));
	return normalizeText(parts.join("\n\n")).replace(/\n+$/, "");
}

export function stripTrailingNoticeBlock(text: string): string {
	const normalized = normalizeText(text).replace(/\n+$/, "");
	return normalized.replace(/\n\n\[[^\n]+\]$/, "");
}

export function splitLines(text: string | undefined | null): string[] {
	const normalized = normalizeText(text);
	if (!normalized) return [];
	return normalized.split("\n");
}

export function countLines(text: string | undefined | null): number {
	return splitLines(text).length;
}

export function countMatches(text: string, matcher: RegExp): number {
	return splitLines(text).filter((line) => matcher.test(line)).length;
}

export function byteCount(text: string): number {
	return Buffer.byteLength(text, "utf8");
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
	return count === 1 ? singular : plural;
}

export function truncateInline(text: string, maxChars: number): string {
	const compact = normalizeText(text).replace(/\s+/g, " ").trim();
	if (!compact) return "";
	if (compact.length <= maxChars) return compact;
	if (maxChars <= 3) return compact.slice(0, maxChars);
	return `${compact.slice(0, Math.max(1, maxChars - 3))}...`;
}

export function slicePreview(text: string | undefined, maxLines: number, direction: PreviewDirection): PreviewSlice | undefined {
	const lines = splitLines(text);
	if (lines.length === 0 || maxLines <= 0) return undefined;

	if (direction === "tail") {
		const visible = lines.slice(-maxLines);
		return {
			lines: visible,
			totalLines: lines.length,
			hiddenBefore: Math.max(0, lines.length - visible.length),
			hiddenAfter: 0,
			direction,
		};
	}

	const visible = lines.slice(0, maxLines);
	return {
		lines: visible,
		totalLines: lines.length,
		hiddenBefore: 0,
		hiddenAfter: Math.max(0, lines.length - visible.length),
		direction,
	};
}

export function firstLine(text: string | undefined): string {
	return splitLines(text)[0] ?? "";
}

export function lastLine(text: string | undefined): string {
	const lines = splitLines(text);
	return lines.length > 0 ? lines[lines.length - 1] ?? "" : "";
}

export function lastNonEmptyLine(text: string | undefined): string {
	const lines = splitLines(text);
	for (let index = lines.length - 1; index >= 0; index -= 1) {
		const line = lines[index]?.trim();
		if (line) return line;
	}
	return "";
}

export function countUniqueGrepFiles(text: string | undefined): number {
	const files = new Set<string>();
	for (const line of splitLines(text)) {
		const match = line.match(/^([^:]+):\d+:/);
		if (match?.[1]) files.add(match[1]);
	}
	return files.size;
}

export function countLsKinds(text: string | undefined): { files: number; dirs: number } {
	let files = 0;
	let dirs = 0;

	for (const line of splitLines(text)) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		if (trimmed.endsWith("/")) dirs += 1;
		else files += 1;
	}

	return { files, dirs };
}
