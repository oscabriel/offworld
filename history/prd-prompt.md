Convert the plan document below into structured PRD user stories. Save to @scripts/ralph/PRD.json.
Each story should have: title, priority, description, steps to verify, and passes: false.
Format as JSON. Be specific about acceptance criteria.

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
