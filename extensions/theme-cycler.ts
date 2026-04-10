import type { ExtensionAPI, ExtensionCommandContext } from "@mariozechner/pi-coding-agent";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const SETTINGS_PATH = path.join(os.homedir(), ".pi", "agent", "settings.json");

function getCyclableThemes(ctx: ExtensionCommandContext): string[] {
  return ctx.ui
    .getAllThemes()
    .map((theme) => theme.name)
    .filter((name) => name !== "light");
}

function saveGlobalTheme(themeName: string) {
  let settings: Record<string, unknown> = {};

  if (fs.existsSync(SETTINGS_PATH)) {
    try {
      settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf8"));
    } catch {
      settings = {};
    }
  }

  settings.theme = themeName;
  fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true });
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2) + "\n", "utf8");
}

async function pickTheme(ctx: ExtensionCommandContext) {
  const themes = getCyclableThemes(ctx);
  if (themes.length === 0) {
    ctx.ui.notify("No themes found", "warning");
    return;
  }

  const currentName = ctx.ui.theme.name ?? "dark";
  const labelToTheme = new Map<string, string>();
  const labels = themes.map((name) => {
    const theme = ctx.ui.getTheme(name);
    const swatch = theme ? theme.bg("selectedBg", theme.fg("accent", "██")) : "██";
    const label = `${name === currentName ? "✓ " : "  "}${swatch} ${name}`;
    labelToTheme.set(label, name);
    return label;
  });

  const choice = await ctx.ui.select("Select theme:", labels);
  if (!choice) return;

  const nextTheme = labelToTheme.get(choice);
  if (!nextTheme) {
    ctx.ui.notify("Failed to resolve selected theme", "error");
    return;
  }

  const result = ctx.ui.setTheme(nextTheme);
  if (!result.success) {
    ctx.ui.notify(`Failed to switch theme: ${result.error ?? "unknown error"}`, "error");
    return;
  }

  saveGlobalTheme(nextTheme);
  ctx.ui.notify(`Theme: ${nextTheme} (reloading...)`, "success");
  await ctx.reload();
  return;
}

export default function (pi: ExtensionAPI) {
  pi.registerCommand("theme", {
    description: "Pick and apply a theme",
    handler: async (_args, ctx) => pickTheme(ctx),
  });
}
