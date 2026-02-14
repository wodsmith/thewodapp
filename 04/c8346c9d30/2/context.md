# Session Context

## User Prompts

### Prompt 1

based on the current changes, please create a full suite of tests for this functionality. we want it battle tested

### Prompt 2

Base directory for this skill: /Users/zacjones/Documents/02.Areas/wodsmith/thewodapp-2/.claude/skills/test

# Testing (Router Skill)

**"Write tests. Not too many. Mostly integration."** — Kent C. Dodds

This skill routes you to the right testing approach. TDD is non-negotiable for swarm work.

## Testing Trophy

```
      /\
     /  \  E2E (slow, high confidence)
    /----\  5-10 critical path tests
   / INT  \ Integration (SWEET SPOT)
  /--------\ Test real interactions
 |  UNIT  | Unit (fas...

### Prompt 3

Base directory for this skill: /Users/zacjones/Documents/02.Areas/wodsmith/thewodapp-2/.claude/skills/unit-test

# Unit Testing

Test pure business logic in isolation. Mock system boundaries (DB, webhooks, external APIs). Verify calculated values, not side effects.

## TDD Cycle (Non-Negotiable)

**RED → GREEN → REFACTOR**. Every feature. Every bug fix.

- **RED**: Write failing test first. If it passes, your test is wrong.
- **GREEN**: Minimum code to pass. Hardcode if needed.
- **REFACTOR*...

### Prompt 4

did you test all the variations around passing fees on to the customer vs merchant taking on that charge and such?

### Prompt 5

commit and push

