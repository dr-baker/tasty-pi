---
name: commit-style
description: Reads a diff, splits ideologically separate concepts into separate commits, and writes commit messages in Daniel's plain-language style. Use when asked to commit changes, split a diff into multiple commits, or write commit messages "the way I like".
---

# Commit Style

Two jobs:

1. Split the diff into separate commits by concept.
- Separate ideologically different changes.
- Do not mix feature work, cleanup, refactors, bug fixes, styling, logging, or experiments unless one is required for the other.
- If part of the diff could be reverted independently, it should usually be its own commit.
- Do not hide mixed work under `misc`, `cleanup`, or `tweaks`.

2. Write the commit message in plain language.
- Use a short natural subject.
- Usually use lowercase for focused commits.
- Usually include bullets with more detail.
- Skip the body only if the commit is truly self-documenting.
- Put detail in the body, not crammed into the subject.
- No conventional commit prefixes.

Default format:

```text
added a skill for commiting

- detail 1
- detail 2
```

Before committing, say what the commit groups are. Then stage and commit each group deliberately.
