# Ralph Agent Instructions

## Your Task

1. Read `scripts/ralph/plan.md`
2. Read `scripts/ralph/PRD.json`
3. Review recent commits below (context from previous iterations)
4. Pick highest priority story where `passes: false`
5. Implement that ONE story
6. Run `bun check`, `bun typecheck`, and `bun run test`
7. Update PRD.json: `passes: true`
8. Commit with detailed message (see format below)

## Commit Message Format

```
feat: [ID] - [Title]

## What was implemented
- bullet points

## Files changed
- list of files

## Learnings
- Patterns discovered
- Gotchas encountered
```

## Stop Condition

Before doing any work, if ALL stories pass, reply:
<promise>COMPLETE</promise>

If all stories do not pass, after completing ONE story:

1. Update PRD.json (`passes: true`)
2. Commit with detailed message
3. **STOP IMMEDIATELY** - do not start next story

The loop runner will start a fresh session for the next story.
