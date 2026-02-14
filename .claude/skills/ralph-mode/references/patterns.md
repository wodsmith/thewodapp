# Ralph Patterns and Gotchas

## Common Gotchas

### Idempotent Migrations

Always use `IF NOT EXISTS` for migrations:

```sql
-- Good
ADD COLUMN IF NOT EXISTS email TEXT;
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Bad (fails if run twice)
ADD COLUMN email TEXT;
```

### Interactive Prompts

Some CLI tools prompt for input. Handle with:

```bash
echo -e "\n\n\n" | npm run db:generate
```

Or use `--yes` / `-y` flags when available.

### Schema Changes Cascade

After editing schema, check:
- Server actions using the table
- UI components displaying the data
- API routes accessing the table
- Tests mocking the data

Fixing related files is OK - not scope creep.

### Context Rot

LLMs get worse as context fills up. Keep iterations small:
- One story per iteration
- One logical change per commit
- Run feedback loops frequently

### Agent Shortcuts

Agents will take shortcuts if criteria are vague:

```
❌ "Users can log in" → Agent marks internal commands as "not user-facing"
✅ "Login form exists at /login with email/password fields" → Specific, verifiable
```

## Effective Patterns

### Progress File Patterns

Keep the Codebase Patterns section at the TOP of progress.txt:

```markdown
## Codebase Patterns
- Migrations: Always use IF NOT EXISTS
- React: useRef<Timeout | null>(null) for timeouts
- API: All endpoints require team context
- Tests: Use factory functions from test/factories/
```

### Commit Message Pattern

```
feat: [STORY-ID] - Short description

- What was implemented
- Files changed
```

### AGENTS.md Updates

Update AGENTS.md when discovering reusable patterns:

```markdown
✅ Good additions:
- "When modifying X, also update Y"
- "This module uses pattern Z"
- "Tests require dev server running"

❌ Don't add:
- Story-specific details
- Temporary notes
- Info already in progress.txt
```

### Feedback Loop Order

Run in this order to fail fast:

```bash
1. pnpm type-check  # Fastest, catches most errors
2. pnpm lint        # Fast, catches style issues
3. pnpm test        # Slower, catches logic errors
```

### Branch Naming

```
ralph/feature-name    # Feature work
ralph/fix-issue-123   # Bug fixes
ralph/refactor-xyz    # Refactoring
```

## Alternative Loop Types

### Test Coverage Loop

```txt
@coverage-report.txt
Find uncovered lines in the coverage report.
Write tests for the most critical uncovered code paths.
Run coverage again and update coverage-report.txt.
Target: 80% coverage minimum.
```

### Linting Loop

```txt
Run: pnpm lint
Fix ONE linting error at a time.
Run lint again to verify the fix.
Repeat until no errors remain.
```

### Entropy Loop

```txt
Scan for code smells: unused exports, dead code, inconsistent patterns.
Fix ONE issue per iteration.
Document what you changed in progress.txt.
```

### Duplication Loop

Hook Ralph up to duplicate detection:

```txt
Run: npx jscpd --min-lines 5 --min-tokens 50
Find the most significant duplicate.
Refactor into a shared utility.
Run detection again to verify reduction.
```

## Troubleshooting

### Ralph Loops Forever

- Check if completion criteria are explicit
- Verify `passes` field updates correctly
- Add max iteration cap

### Ralph Takes Shortcuts

- Make acceptance criteria more specific
- Add verification steps
- Include typecheck/test requirements

### Context Rot

- Split large stories into smaller ones
- Run feedback loops more frequently
- Cap iteration count

### Rate Limiting

- Add `sleep 2` between iterations
- Use exponential backoff on failures
- Monitor API usage

### Git Push Failures

- Verify branch permissions
- Check for uncommitted changes
- Ensure remote branch exists
