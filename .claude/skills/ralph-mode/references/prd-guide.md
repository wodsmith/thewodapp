# PRD Guide: Writing Effective User Stories for Ralph

## PRD Structure

```json
{
  "branchName": "ralph/feature-name",
  "description": "What this Ralph session accomplishes",
  "userStories": [...]
}
```

## User Story Structure

```json
{
  "id": "US-001",
  "title": "Short descriptive title",
  "category": "functional|integration|refactor|test",
  "description": "What needs to be done",
  "acceptanceCriteria": [
    "Specific, verifiable criteria",
    "typecheck passes",
    "tests pass"
  ],
  "priority": 1,
  "passes": false,
  "notes": ""
}
```

## Sizing Stories

Stories MUST fit in one context window. If it feels too big, it is.

### Right-Sized Examples

```
✅ "Add login form with email/password fields"
✅ "Add email format validation"
✅ "Add password strength indicator"
✅ "Connect form to auth server action"
```

### Too Large Examples

```
❌ "Build entire authentication system"
❌ "Add user dashboard with all widgets"
❌ "Refactor database layer"
```

## Writing Acceptance Criteria

Be specific and verifiable. Vague criteria lead to shortcuts.

### Good Criteria

```json
"acceptanceCriteria": [
  "Email input field with type='email'",
  "Password input with min 8 characters",
  "Submit button disabled until valid",
  "Error message appears for invalid email",
  "typecheck passes",
  "form.test.ts has coverage for validation"
]
```

### Bad Criteria

```json
"acceptanceCriteria": [
  "User can log in",
  "Form works correctly",
  "Tests pass"
]
```

## Prioritizing Stories

Use priority numbers to guide Ralph, but Ralph will make final decisions based on dependencies.

| Priority | Task Type | Why |
|----------|-----------|-----|
| 1 | Architectural decisions | Cascades through entire codebase |
| 2 | Integration points | Reveals incompatibilities early |
| 3 | Core functionality | Main feature work |
| 4 | Edge cases | Important but not blocking |
| 5 | Polish | Can be done anytime |

## Categories

- `functional` - New features or functionality
- `integration` - Connecting modules or systems
- `refactor` - Code improvements without behavior change
- `test` - Adding or improving tests

## Adjusting Mid-Flight

You can adjust the PRD while Ralph is running:

- Set `passes` back to `false` to redo a story
- Add notes to guide the next attempt
- Add new stories for discovered requirements
- Change priorities based on learnings

## Example: Complete PRD

```json
{
  "branchName": "ralph/user-auth",
  "description": "Add user authentication with email/password",
  "userStories": [
    {
      "id": "AUTH-001",
      "title": "Create auth schema",
      "category": "functional",
      "description": "Add users table with email, password_hash columns",
      "acceptanceCriteria": [
        "users table exists in schema.ts",
        "email column with unique constraint",
        "password_hash column",
        "created_at and updated_at columns",
        "db:generate creates migration",
        "typecheck passes"
      ],
      "priority": 1,
      "passes": false,
      "notes": ""
    },
    {
      "id": "AUTH-002",
      "title": "Add login form component",
      "category": "functional",
      "description": "Create LoginForm component with email/password inputs",
      "acceptanceCriteria": [
        "LoginForm component exists",
        "Email input with type='email'",
        "Password input with type='password'",
        "Submit button",
        "Loading state during submission",
        "typecheck passes"
      ],
      "priority": 2,
      "passes": false,
      "notes": "Use existing form patterns from the codebase"
    },
    {
      "id": "AUTH-003",
      "title": "Add login server action",
      "category": "integration",
      "description": "Create server action to validate credentials",
      "acceptanceCriteria": [
        "loginAction server function exists",
        "Validates email format",
        "Checks password against hash",
        "Returns session token on success",
        "Returns error on invalid credentials",
        "typecheck passes",
        "tests pass"
      ],
      "priority": 2,
      "passes": false,
      "notes": ""
    }
  ]
}
```

## Tips

1. **Always include feedback loop criteria**: `typecheck passes`, `tests pass`, `lint passes`
2. **One story = one commit**: If you can't describe it in one commit message, split it
3. **Verify, don't assume**: Add specific verification steps, not vague assertions
4. **Front-load risk**: High priority for architectural and integration work
5. **Leave notes**: If a story fails, add notes for the next attempt
