# Ralph Agent Instructions

## Your Task

1. Read `scripts/ralph/plan.md`
2. Read `scripts/ralph/PRD.json`
3. Review recent commits below (context from previous iterations)
4. Check you're on the correct branch
5. Pick highest priority story where `passes: false`
6. Implement that ONE story
7. Run typecheck and tests
8. Update AGENTS.md files with learnings
9. Update PRD.json: `passes: true`
10. Commit with detailed message (see format below)

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

After completing ONE story:

1. Update PRD.json (`passes: true`)
2. Commit with detailed message
3. **STOP IMMEDIATELY** - do not start next story

The loop runner will start a fresh session for the next story.

If ALL stories pass, reply:
<promise>COMPLETE</promise>
