# Session Context

## User Prompts

### Prompt 1

please review any new pull request comments and address any relevant ones

### Prompt 2

Base directory for this skill: /Users/zacjones/Documents/02.Areas/wodsmith/thewodapp-2/.claude/skills/my-pr-comments

Get the current pr number:

```bash
gh pr view --json "url" | jq '.url'
```

Now you can run this command to get all the pr comments in JSON

```bash
gh api repos/corpaxe/{reponame}/pulls/{prnumber}/comments --paginate --jq '.[] | {file: .path, line: .line, body: .body, author: .user.login}'
```

## Example:

```bash
gh pr view --json "url" | jq '.url'

# outputs
"https://github....

### Prompt 3

Stop hook feedback:
The codebase has changes (9 lines) but `lat.md/` was not updated. Verify `lat.md/` is in sync — run `lat search` to find relevant sections. Run `lat check` at the end.

