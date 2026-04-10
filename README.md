# Tasty Pi

A Pi package with custom extensions, skills, and themes.

## Included resources

This package collects Pi extensions, skills, and themes in one repo.

### Extensions
- `command-browser` — browse built-in commands, extension commands, skills, and prompts from a picker UI
- `theme-cycler` — choose a theme from inside Pi and persist it to settings
- `tool-preview` — replace built-in tool previews with shorter, more readable summaries
- `turn-timing` — show a timing breakdown after each agent turn

### Skills
- `commit-style` — split changes into logical commits and write plain-language commit messages
- `plan-todos` — keep working plans in `plans/` with a consistent todo structure

### Themes
- `dracula-dark` — a high-contrast Dracula palette tuned for Pi
- `nord-dark` — a muted Nord palette with cool blue accents
- `rose-pine` — a warm purple Rose Pine-inspired dark theme
- `synthwave` — a neon dark theme with bright cyan and pink accents

## Local development

Install this repo into Pi as a local path package:

```bash
pi install tasty-pi
```

Because Pi loads local path packages from disk, edits in this repo are live once Pi reloads resources.

```text
/reload
```

## Publish later

This repo is already structured as a Pi package, so it can be shared through git or npm later.
