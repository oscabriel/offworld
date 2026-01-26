Convert the plan document into structured PRD user stories. Save to @scripts/ralph/PRD.json.
Each story should have: title, priority, description, steps to verify, and passes: false.
Format as JSON. Be specific about acceptance criteria.
All tasks should be easily completed by an agent, so don't include any manual testing or verification steps in the PRD.

```
{
  "branchName": "ralph/feature",
  "userStories": [
    {
      "id": "US-001",
      "title": "Add login form",
      "acceptanceCriteria": [
        "Email/password fields",
        "Validates email format",
        "typecheck passes"
      ],
      "priority": 1,
      "passes": false,
      "notes": ""
    }
  ]
}
```
