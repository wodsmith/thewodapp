# Session Context

## User Prompts

### Prompt 1

pull pr comments and adress any that make sense

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

