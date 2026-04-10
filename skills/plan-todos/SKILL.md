---
name: plan-todos
description: Use this skill whenever a task needs a written plan, a todo list, or progress tracking in this repo. It defines where plan files live, the required plan structure, and how todos must be updated during implementation.
---

# Plan Todos

Use this skill whenever you create or maintain a written plan for work in this repository.

## Priority

- In this repo, use this skill instead of the agent's default plan tool when you need task tracking or a written implementation plan.
- The plan file in `plans/` is the working source of truth.

## File Location

- Store plan files in `plans/`.
- Do not place plan files in the repo root or in any default scratch directory.
- Name each file `YYYY-MM-DD-short-task-name.md`.

## Required Structure

Every plan file must use exactly these sections, in this order:

```md
# Short Task Title

## Goal
Brief description of the user-visible outcome.

## TODO
- [ ] Concrete implementation step
- [ ] Concrete implementation step
- [ ] Verification step

## Progress Notes
- Timestamped notes about work completed, scope changes, blockers, or decisions.

## Final notes and learnings
- Short summary of what shipped, what changed during execution, and anything worth carrying forward.
```

## Todo Rules

- Use Markdown checkboxes for every todo item.
- Keep todo items concrete and observable.
- Avoid vague items like "fix bug", "cleanup", or "polish".
- Prefer one clearly active step at a time.
- Update the todo list during implementation, not afterward from memory.
- If you finish a step, mark it complete in the same work session.
- If work is partially complete, split it into a completed item and a remaining item.
- If scope changes, update the todo list before continuing.

## Completion Rules

- When the feature or fix is complete, the plan file must reflect the final state of the work.
- Completed work must be checked off.
- Remaining follow-up work must stay as explicit unchecked items.
- Add a short note in `Final notes and learnings` describing verification, notable decisions, and reusable lessons.
