---
name: review
description: Centralizes persona-driven code reviews (Carmack, React core, Anders, React Router, Next.js, etc.) so Claude can pick or combine expert viewpoints when the user asks for a code review or perspective-specific critique. Use when user asks for code review, architecture feedback, or expert perspective on implementation.
---

# Review Skill

Unifies every reviewer persona into one Skill. Claude activates this Skill whenever code should be reviewed and then "lazy loads" the exact perspective by opening the reference docs linked below or by spawning persona-specific subagents.

## Critical Workflow

**REQUIRED**: Before conducting ANY code review, you MUST load the relevant persona reference file(s) using the Read tool. These references contain the specific review priorities, perspective, and evaluation criteria for each reviewer persona.

1. Collect the code/diff context plus the user's goals (bugs, architecture, performance, etc.).
2. **MANDATORY: Parse reviewer hints** (e.g., "perf, react, typescript") and **READ the matching reference file(s) directly using the Read tool** BEFORE reviewing:
   - Accessibility concerns → Read `references/a11y-reviewer.md` FIRST
   - AI/ML concerns → Read `references/ai-reviewer.md` FIRST
   - Type system concerns → Read `references/anders-reviewer.md` FIRST
   - Testing/TDD concerns → Read `references/beck-reviewer.md` FIRST
   - Low-level performance → Read `references/carmack-reviewer.md` FIRST
   - Observability/tracing → Read `references/perf-reviewer.md` FIRST
   - React patterns → Read `references/react-reviewer.md` FIRST
   - React Router → Read `references/react-router-reviewer.md` FIRST
   - Next.js/App Router → Read `references/nextjs-reviewer.md` FIRST
3. **Apply the reviewer persona's perspective** by following their specific guidance and priorities from the loaded reference.
4. Cite specific files/lines, flag issues, and provide concrete recommendations.

**DO NOT attempt to conduct a code review without first loading the appropriate persona reference file(s).**

## General Checklist

- Understand inputs/outputs, dependencies, and expected behavior before judging the change.
- Use the allowed tools (`Read`, `Grep`, `Glob`, `Bash`) to inspect implementation, history, and tests.
- Evaluate correctness, safety, performance, maintainability, and user impact.
- Flag missing tests, weak docs, regressions, or architectural drift; propose concrete fixes.
- Summarize findings in severity order, then note risks, questions, and verification steps.

## Multi-Perspective Reviews

When multiple personas are requested (e.g., "review this with Anders and React perspectives"):
- Read each relevant reference file from the list below
- Apply each perspective's priorities and concerns to the code
- Synthesize findings: highlight where perspectives agree or conflict
- Prioritize issues by severity across all perspectives

## Persona References (load on demand)

- **Marcy Sutton & Léonie Watson** - inclusive design, semantic HTML, keyboard/screen reader accessibility. [Open instructions](references/a11y-reviewer.md)
- **AI Visionaries** - adaptive systems, emergent behavior, data-driven design. [Open instructions](references/ai-reviewer.md)
- **Anders Hejlsberg** - strong typing, language/tooling ergonomics, structured APIs. [Open instructions](references/anders-reviewer.md)
- **Kent Beck** - TDD discipline, rapid feedback loops, adaptive design. [Open instructions](references/beck-reviewer.md)
- **John Carmack** - low-level excellence, graphics/perf tuning, precision thinking. [Open instructions](references/carmack-reviewer.md)
- **Brendan Gregg & Liz Rice** - observability, tracing, data-first performance analysis. [Open instructions](references/perf-reviewer.md)
- **React Core Maintainer** - hooks, concurrent rendering, DX-focused component patterns. [Open instructions](references/react-reviewer.md)
- **React Router Team** - progressive enhancement, nested routing, loaders/actions, web platform APIs. [Open instructions](references/react-router-reviewer.md)
- **Vercel/Next.js Team** - server-first rendering, App Router, Server Components, Server Actions, caching. [Open instructions](references/nextjs-reviewer.md)

Each reference stays out of context until explicitly opened, keeping Claude's context lean while still giving fast access to the original, detailed reviewer guidance.
