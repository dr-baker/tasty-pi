import type { ExtensionAPI, ExtensionContext, SlashCommandInfo, Theme } from "@mariozechner/pi-coding-agent";
import { Key, SelectList, type OverlayHandle, type SelectItem, type TUI, matchesKey, truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";

type BrowserCategory = "all" | "extension" | "skill" | "prompt";
type BrowserCommandSource = SlashCommandInfo["source"] | "builtin";
type BrowserCommandScope = SlashCommandInfo["sourceInfo"]["scope"] | "builtin";

interface BrowserCommand {
	name: string;
	description?: string;
	source: BrowserCommandSource;
	scope: BrowserCommandScope;
	path?: string;
}

const CATEGORY_ORDER: BrowserCategory[] = ["all", "extension", "skill", "prompt"];
const CATEGORY_LABELS: Record<BrowserCategory, string> = {
	all: "All",
	extension: "Commands",
	skill: "Skills",
	prompt: "Prompts",
};

const BUILTIN_COMMANDS: BrowserCommand[] = [
	{ name: "settings", description: "Open settings menu", source: "builtin", scope: "builtin" },
	{ name: "model", description: "Select model (opens selector UI)", source: "builtin", scope: "builtin" },
	{ name: "scoped-models", description: "Enable/disable models for Ctrl+P cycling", source: "builtin", scope: "builtin" },
	{ name: "export", description: "Export session (HTML default, or specify path: .html/.jsonl)", source: "builtin", scope: "builtin" },
	{ name: "import", description: "Import and resume a session from a JSONL file", source: "builtin", scope: "builtin" },
	{ name: "share", description: "Share session as a secret GitHub gist", source: "builtin", scope: "builtin" },
	{ name: "copy", description: "Copy last agent message to clipboard", source: "builtin", scope: "builtin" },
	{ name: "name", description: "Set session display name", source: "builtin", scope: "builtin" },
	{ name: "session", description: "Show session info and stats", source: "builtin", scope: "builtin" },
	{ name: "changelog", description: "Show changelog entries", source: "builtin", scope: "builtin" },
	{ name: "hotkeys", description: "Show all keyboard shortcuts", source: "builtin", scope: "builtin" },
	{ name: "fork", description: "Create a new fork from a previous message", source: "builtin", scope: "builtin" },
	{ name: "tree", description: "Navigate session tree (switch branches)", source: "builtin", scope: "builtin" },
	{ name: "login", description: "Login with OAuth provider", source: "builtin", scope: "builtin" },
	{ name: "logout", description: "Logout from OAuth provider", source: "builtin", scope: "builtin" },
	{ name: "new", description: "Start a new session", source: "builtin", scope: "builtin" },
	{ name: "compact", description: "Manually compact the session context", source: "builtin", scope: "builtin" },
	{ name: "resume", description: "Resume a different session", source: "builtin", scope: "builtin" },
	{ name: "reload", description: "Reload keybindings, extensions, skills, prompts, and themes", source: "builtin", scope: "builtin" },
	{ name: "quit", description: "Quit pi", source: "builtin", scope: "builtin" },
];

function normalizeCategory(value: string): BrowserCategory | undefined {
	const normalized = value.trim().toLowerCase();
	switch (normalized) {
		case "all":
			return "all";
		case "builtin":
		case "builtins":
		case "built-in":
		case "built-ins":
		case "extension":
		case "extensions":
		case "command":
		case "commands":
		case "ext":
			return "extension";
		case "skill":
		case "skills":
			return "skill";
		case "prompt":
		case "prompts":
			return "prompt";
		default:
			return undefined;
	}
}

function matchesCategory(command: BrowserCommand, category: BrowserCategory): boolean {
	if (category === "all") return true;
	if (category === "extension") return command.source === "extension" || command.source === "builtin";
	return command.source === category;
}

function formatSource(source: BrowserCommandSource): string {
	switch (source) {
		case "builtin":
			return "Built-in";
		case "extension":
			return "Command";
		case "skill":
			return "Skill";
		case "prompt":
			return "Prompt";
	}
}

function formatScope(scope: BrowserCommandScope): string {
	switch (scope) {
		case "builtin":
			return "builtin";
		case "project":
			return "project";
		case "user":
			return "global";
		case "temporary":
			return "temp";
	}
}

function sortCommands(commands: BrowserCommand[]): BrowserCommand[] {
	const sourceOrder: Record<BrowserCommandSource, number> = {
		builtin: 0,
		extension: 1,
		skill: 2,
		prompt: 3,
	};
	const scopeOrder: Record<BrowserCommandScope, number> = {
		builtin: 0,
		project: 1,
		user: 2,
		temporary: 3,
	};

	return [...commands].sort((a, b) => {
		const sourceCompare = sourceOrder[a.source] - sourceOrder[b.source];
		if (sourceCompare !== 0) return sourceCompare;

		const scopeCompare = scopeOrder[a.scope] - scopeOrder[b.scope];
		if (scopeCompare !== 0) return scopeCompare;

		return a.name.localeCompare(b.name);
	});
}

function toBrowserCommand(command: SlashCommandInfo): BrowserCommand {
	return {
		name: command.name,
		description: command.description,
		source: command.source,
		scope: command.sourceInfo.scope,
		path: command.sourceInfo.path,
	};
}

function getAvailableCommands(pi: ExtensionAPI): BrowserCommand[] {
	const sessionCommands = pi.getCommands().filter((command) => command.name !== "/").map(toBrowserCommand);
	return sortCommands([...BUILTIN_COMMANDS, ...sessionCommands]);
}

function getScopeColor(scope: BrowserCommandScope): "accent" | "success" | "warning" | "dim" {
	switch (scope) {
		case "builtin":
			return "accent";
		case "project":
			return "success";
		case "user":
			return "warning";
		case "temporary":
			return "dim";
	}
}

function getSourceColor(source: BrowserCommandSource): "accent" | "success" | "warning" | "dim" {
	switch (source) {
		case "builtin":
			return "accent";
		case "extension":
			return "success";
		case "skill":
			return "warning";
		case "prompt":
			return "dim";
	}
}

function getDisplayName(command: BrowserCommand): string {
	if (command.source === "skill" && command.name.startsWith("skill:")) {
		return command.name.slice(6);
	}
	return command.name;
}

function renderSourceBadge(theme: Theme, command: BrowserCommand): string {
	return theme.fg(getSourceColor(command.source), `[${formatSource(command.source).toLowerCase()}]`);
}

function renderScopeBadge(theme: Theme, command: BrowserCommand): string {
	return theme.fg(getScopeColor(command.scope), `[${formatScope(command.scope)}]`);
}

function renderRowLabel(theme: Theme, command: BrowserCommand): string {
	const commandText = `/${getDisplayName(command)}`.padEnd(22, " ");
	return `${theme.fg("text", commandText)} ${renderScopeBadge(theme, command)}`;
}

function renderRowDescription(theme: Theme, command: BrowserCommand): string | undefined {
	if (!command.description?.trim()) {
		return undefined;
	}

	return theme.fg("muted", command.description.trim());
}

function renderTab(theme: Theme, category: BrowserCategory, count: number, active: boolean): string {
	const label = ` ${CATEGORY_LABELS[category]} ${count} `;
	if (active) {
		return theme.bg("selectedBg", theme.fg("text", theme.bold(label)));
	}
	return count > 0 ? theme.fg("muted", label) : theme.fg("dim", label);
}

class CommandPreviewOverlay {
	constructor(
		private theme: Theme,
		private getCommand: () => BrowserCommand | undefined,
	) {}

	render(width: number): string[] {
		const command = this.getCommand();
		if (!command) return [];

		const innerWidth = Math.max(24, width - 2);
		const title = " Selected Command ";
		const left = "─".repeat(Math.max(0, Math.floor((innerWidth - visibleWidth(title)) / 2)));
		const right = "─".repeat(Math.max(0, innerWidth - visibleWidth(title) - left.length));
		const border = (text: string) => this.theme.fg("borderMuted", text);
		const row = (text: string) => {
			const content = truncateToWidth(text, innerWidth, "");
			const padding = " ".repeat(Math.max(0, innerWidth - visibleWidth(content)));
			return border("│") + content + padding + border("│");
		};

		const lines = [
			border(`╭${left}`) + this.theme.fg("accent", title) + border(`${right}╮`),
			row(` ${this.theme.fg("text", `/${getDisplayName(command)}`)} ${renderScopeBadge(this.theme, command)} ${renderSourceBadge(this.theme, command)}`),
		];

		if (command.name !== getDisplayName(command)) {
			lines.push(row(` ${this.theme.fg("dim", `invokes /${command.name}`)}`));
		}
		if (command.description?.trim()) {
			lines.push(row(` ${this.theme.fg("muted", command.description.trim())}`));
		}
		if (command.path) {
			lines.push(row(` ${this.theme.fg("dim", command.path)}`));
		}

		lines.push(border(`╰${"─".repeat(innerWidth)}╯`));
		return lines;
	}

	invalidate(): void {}
	handleInput(_data: string): void {}
	dispose(): void {}
}

class CommandBrowserComponent {
	private activeCategory: BrowserCategory;
	private currentCommands: BrowserCommand[] = [];
	private currentSelected?: BrowserCommand;
	private selectList: SelectList;
	private counts: Record<BrowserCategory, number>;
	private previewOverlay: CommandPreviewOverlay;
	private previewHandle: OverlayHandle;

	constructor(
		private tui: TUI,
		private theme: Theme,
		private allCommands: BrowserCommand[],
		initialCategory: BrowserCategory,
		private done: (result: BrowserCommand | undefined) => void,
	) {
		this.activeCategory = initialCategory;
		this.counts = {
			all: allCommands.length,
			extension: allCommands.filter((command) => command.source === "extension" || command.source === "builtin").length,
			skill: allCommands.filter((command) => command.source === "skill").length,
			prompt: allCommands.filter((command) => command.source === "prompt").length,
		};
		this.selectList = this.createSelectList([]);
		this.previewOverlay = new CommandPreviewOverlay(this.theme, () => this.currentSelected);
		this.previewHandle = this.tui.showOverlay(this.previewOverlay, {
			nonCapturing: true,
			anchor: "top-center",
			width: "78%",
			maxHeight: 6,
			margin: { top: 1 },
		});
		this.refreshList();
	}

	handleInput(data: string): void {
		if (matchesKey(data, Key.tab) || matchesKey(data, Key.right)) {
			this.cycleCategory(1);
			return;
		}

		if (matchesKey(data, Key.shift("tab")) || matchesKey(data, Key.left)) {
			this.cycleCategory(-1);
			return;
		}

		if (data === "1") return this.setCategory("all");
		if (data === "2") return this.setCategory("extension");
		if (data === "3") return this.setCategory("skill");
		if (data === "4") return this.setCategory("prompt");

		this.selectList.handleInput(data);
	}

	render(width: number): string[] {
		const safeWidth = Math.max(1, width);
		const lines: string[] = [];

		lines.push(this.theme.fg("borderMuted", "─".repeat(safeWidth)));
		lines.push(truncateToWidth(` ${this.theme.fg("accent", this.theme.bold("Slash Commands"))}`, safeWidth));
		lines.push(truncateToWidth(` ${this.renderTabs()}`, safeWidth));
		lines.push("");

		if (this.currentCommands.length === 0) {
			lines.push(
				truncateToWidth(
					` ${this.theme.fg("warning", `No ${CATEGORY_LABELS[this.activeCategory].toLowerCase()} commands available`)}`,
					safeWidth,
				),
			);
		} else {
			lines.push(...this.selectList.render(safeWidth));
		}

		lines.push("");
		lines.push(this.theme.fg("borderMuted", "─".repeat(safeWidth)));

		return lines;
	}

	invalidate(): void {
		this.selectList.invalidate();
	}

	dispose(): void {
		this.previewHandle?.hide();
	}

	private createSelectList(commands: BrowserCommand[]): SelectList {
		const items: SelectItem[] = commands.map((command, index) => ({
			value: String(index),
			label: renderRowLabel(this.theme, command),
			description: renderRowDescription(this.theme, command),
		}));

		const preserveRowColors = (text: string) => text.replace(/^→ /, this.theme.fg("accent", "→ "));

		const list = new SelectList(
			items,
			Math.min(Math.max(items.length, 1), 14),
			{
				selectedPrefix: preserveRowColors,
				selectedText: preserveRowColors,
				description: (text) => text,
				scrollInfo: (text) => this.theme.fg("dim", text),
				noMatch: (text) => this.theme.fg("warning", text),
			},
			{
				minPrimaryColumnWidth: 26,
				maxPrimaryColumnWidth: 40,
			},
		);

		list.onSelect = (item) => this.done(this.currentCommands[Number(item.value)]);
		list.onCancel = () => this.done(undefined);
		list.onSelectionChange = (item) => {
			this.currentSelected = this.currentCommands[Number(item.value)];
			this.tui.requestRender();
		};

		return list;
	}

	private refreshList(): void {
		this.currentCommands = this.allCommands.filter((command) => matchesCategory(command, this.activeCategory));
		this.selectList = this.createSelectList(this.currentCommands);
		this.currentSelected = this.currentCommands[0];
		this.tui.requestRender();
	}

	private setCategory(category: BrowserCategory): void {
		if (this.activeCategory === category) return;
		this.activeCategory = category;
		this.refreshList();
	}

	private cycleCategory(direction: 1 | -1): void {
		const currentIndex = CATEGORY_ORDER.indexOf(this.activeCategory);
		const nextIndex = (currentIndex + direction + CATEGORY_ORDER.length) % CATEGORY_ORDER.length;
		this.activeCategory = CATEGORY_ORDER[nextIndex]!;
		this.refreshList();
	}

	private renderTabs(): string {
		return CATEGORY_ORDER.map((category) => renderTab(this.theme, category, this.counts[category], category === this.activeCategory)).join(this.theme.fg("dim", " "));
	}
}

async function showCommandBrowser(
	ctx: ExtensionContext,
	commands: BrowserCommand[],
	initialCategory: BrowserCategory = "all",
): Promise<void> {
	const sortedCommands = sortCommands(commands);

	if (sortedCommands.length === 0) {
		ctx.ui.notify("No slash commands are available in this session.", "info");
		return;
	}

	const selection = await ctx.ui.custom<BrowserCommand | undefined>((tui, theme, _keybindings, done) => {
		return new CommandBrowserComponent(tui, theme, sortedCommands, initialCategory, done);
	});

	if (!selection) return;

	ctx.ui.setEditorText(`/${selection.name}`);
	ctx.ui.notify(`Inserted /${selection.name}. Add arguments if needed, then submit.`, "info");
}

export default function commandBrowserExtension(pi: ExtensionAPI) {
	const openBrowser = async (ctx: ExtensionContext, initialCategory: BrowserCategory = "all") => {
		await showCommandBrowser(ctx, getAvailableCommands(pi), initialCategory);
	};

	pi.registerCommand("menu", {
		description: "Browse slash commands by source",
		getArgumentCompletions: (prefix) => {
			const normalizedPrefix = prefix.toLowerCase();
			const categories = CATEGORY_ORDER.filter((category) => category.startsWith(normalizedPrefix));
			return categories.length > 0
				? categories.map((category) => ({ value: category, label: CATEGORY_LABELS[category] }))
				: null;
		},
		handler: async (args, ctx) => {
			const trimmedArgs = args.trim();
			const category = trimmedArgs ? normalizeCategory(trimmedArgs) : "all";

			if (trimmedArgs && !category) {
				ctx.ui.notify('Unknown source. Use: all, command, skill, or prompt.', "warning");
				return;
			}

			await openBrowser(ctx, category ?? "all");
		},
	});

	pi.registerCommand("/", {
		description: "Open the custom command browser",
		handler: async (_args, ctx) => {
			await openBrowser(ctx, "all");
		},
	});

	pi.registerCommand("//", {
		description: "Open the custom command browser",
		handler: async (_args, ctx) => {
			await openBrowser(ctx, "all");
		},
	});
}
