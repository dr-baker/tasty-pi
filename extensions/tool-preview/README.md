# tool-preview

Compact built-in tool preview overrides for Pi.

## Tools

- `read`
- `bash`
- `edit`
- `write`
- `grep`
- `find`
- `ls`

## Commands

- `/tool-preview-path`
- `/tool-preview-reload`

## Config

Config file:

`~/.pi/agent/tool-preview-lengths.yaml`

Supported settings:

- `collapsedLines`
- `expandedLines`
- `commandMaxChars`
- `direction` (`head` or `tail`)
- `paddingX`
- `paddingY`
- `outerSpacing`

Example:

```yaml
defaults:
  collapsedLines: 0
  commandMaxChars: 1000000
  paddingX: 0
  paddingY: 0
  outerSpacing: 0

tools:
  bash:
    direction: tail
    expandedLines: 30
```

Reload in Pi with:

```text
/reload
```
