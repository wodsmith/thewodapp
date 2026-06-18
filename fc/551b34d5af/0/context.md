# Session Context

## User Prompts

### Prompt 1

please check if registration is allowed for draft competitions, it should not be even if the registration window allows for registrations to happen

### Prompt 2

Stop hook feedback:
The codebase has changes (12 lines) but `lat.md/` was not updated. Verify `lat.md/` is in sync — run `lat search` to find relevant sections. Run `lat check` at the end.

### Prompt 3

## Context

- Current branch: worktree-sunny-wibbling-eclipse
- Git status:  M apps/wodsmith-start/src/server-fns/registration-fns.ts
 M apps/wodsmith-start/src/server/registration.ts
 M lat.md/.cache/vectors.db
 M lat.md/registration.md
- Uncommitted changes: diff --git a/apps/wodsmith-start/src/server-fns/registration-fns.ts b/apps/wodsmith-start/src/server-fns/registration-fns.ts
index 871c845a..d2996c77 100644
--- a/apps/wodsmith-start/src/server-fns/registration-fns.ts
+++ b/apps/wodsmith-s...

### Prompt 4

pull the pr comments and fix the broken tests in ci. use subagents

