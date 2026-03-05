---
shaping: true
---

# Team Memory System — Frame

## Source

> I want to build a hosted memory system that follows these principles
> https://joelclaw.com/observation-pipeline-persistent-ai-memory
> specifically pay attention to the github repositories that the article mentions.
> This should live in cloudflare and use d1 with sqlite for the memory database.
> essentially I want to be able to store memories from the whole team who is
> working on this app so that we can share our learnings from ai sessions.
> I want this project to live in /apps and all the infrastructure primitives
> to be cloudflare. whether we should use durable objects, vectorize database,
> workers is up for debate.

### Referenced Systems (researched)

- **joelclaw.com article** — Three-tier observation pipeline: raw messages → structured observations → condensed reflections. Priority levels (red/yellow/green). Redis + Qdrant + daily markdown logs. Inngest for durable jobs.
- **Mastra Observational Memory** — Observer/Reflector agent pattern. Token-threshold triggers. Async buffering pipeline. Storage-agnostic (pg, libsql, mongodb). Priority emoji system.
- **Lamarck** — Automated learning from Claude JSONL history. Diary extraction → playbook deltas. Maturity lifecycle (candidate → proven → deprecated). Jaccard dedup, decay scoring, category quotas. Exports to MEMORY.md.
- **Kuato** — Session search/retrieval. "User messages are gold." PostgreSQL + full-text search. Skill file teaches Claude to query past sessions.
- **Andy-Timeline** — Narrative weekly markdown with mandatory Lesson Learned blocks. Cost/Fix/Lesson triads. Monthly synthesis arcs.
- **pi-tools** — Session lifecycle hooks. Fires on compaction/shutdown events.

---

## Problem

AI coding sessions start from zero context. When multiple team members work on the same codebase with AI agents, learnings are siloed — each person's MEMORY.md is local and personal. Patterns discovered in one session (gotchas, conventions, debugging insights) don't transfer to other team members' sessions. Context windows compact and nuanced details evaporate. There's no shared institutional memory across the team's AI-assisted work.

---

## Outcome

A shared, hosted memory system where:
- Observations from any team member's AI session can be stored
- The team's collective learnings are searchable (semantic + structured)
- Memories condense over time (observations → reflections) so the system doesn't bloat
- Any team member's AI agent can retrieve relevant context from the shared pool
- The system runs entirely on Cloudflare infrastructure as an app in the monorepo
