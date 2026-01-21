# Ralph Agent Instructions

## Your Task

1. Read `scripts/ralph/plan.md`
2. Read `scripts/ralph/PRD.json`
3. Read `scripts/ralph/progress.txt`
   (check Codebase Patterns first)
4. Check you're on the correct branch
5. Pick highest priority story
   where `passes: false`
6. Implement that ONE story
7. Run typecheck and tests
8. Update AGENTS.md files with learnings
9. Commit: `feat: [ID] - [Title]`
10. Update prd.json: `passes: true`
11. Append learnings to progress.txt

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
