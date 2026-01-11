---
active: true
iteration: 1
max_iterations: 100
completion_promise: "DONE"
started_at: "2026-01-11T00:40:48.745Z"
session_id: "ses_4558066b9ffepcg7PF4nD2Fp1C"
---

## WORKFLOW \

\

1. Find the highest-priority task and implement it \
2. Run feedback loops (see below) \
3. Update PRD.md with what was done \
4. Append progress to progress.txt \
5. Commit your changes \
   \
   ONLY WORK ON A SINGLE TASK AT A TIME. \
   If PRD is complete, output <promise>COMPLETE</promise>. \
   \

## TASK PRIORITIZATION \

\
When choosing the next task, prioritize in this order: \

1. Architectural decisions and core abstractions \
2. Integration points between modules \
3. Unknown unknowns and spike work \
4. Standard features and implementation \
5. Polish, cleanup, and quick wins \
   \
   Fail fast on risky work. Save easy wins for later. \
   \

## FEEDBACK LOOPS \

\
Before committing, run ALL checks (must pass with no errors): \

1. TypeScript: bun run check-types \
2. Tests: bun run test \
3. Lint: bun run check \
   \
   Do NOT commit if any check fails. Fix issues first. \
   \

## COMMIT GUIDELINES \

\
Keep changes small and focused: \

- One logical change per commit \
- If a task feels too large, break it into subtasks \
- Prefer multiple small commits over one large commit \
- Run feedback loops after each change, not at the end \
  \
  Quality over speed. Small steps compound into big progress. \
  \

## PROGRESS LOGGING \

\
After completing each task, append to progress.txt: \

- Task completed and PRD item reference \
- Key decisions made and reasoning \
- Files changed \
- Any blockers or notes for next iteration \
  \
  Keep entries concise. Sacrifice grammar for concision. \
  This file helps future iterations skip exploration.
