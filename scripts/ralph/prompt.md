# Ralph Agent Instructions

## Your Task

1. Read `scripts/ralph/PRD.json`
2. Read `scripts/ralph/progress.txt`
   (check Codebase Patterns first)
3. Check you're on the correct branch
4. Pick highest priority story
   where `passes: false`
5. Implement that ONE story
6. Run typecheck and tests
7. Update AGENTS.md files with learnings
8. Commit: `feat: [ID] - [Title]`
9. Update prd.json: `passes: true`
10. Append learnings to progress.txt

## Progress Format

APPEND to progress.txt:

## [Date] - [Story ID]

- What was implemented
- Files changed
- **Learnings:**
  - Patterns discovered
  - Gotchas encountered

---

## Stop Condition

After completing ONE story:

1. Commit changes
2. Update PRD.json (`passes: true`)
3. Append to progress.txt
4. **STOP IMMEDIATELY** - do not start next story

The loop runner will start a fresh session for the next story.

If ALL stories pass, reply:
<promise>COMPLETE</promise>
