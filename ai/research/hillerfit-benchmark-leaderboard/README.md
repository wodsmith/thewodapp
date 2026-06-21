# Generic Benchmark Leaderboard Implementation Packet

This packet turns the benchmark leaderboard guide into implementation-ready contracts.

Source narrative: [`../hillerfit-benchmark-leaderboard-guide.md`](../hillerfit-benchmark-leaderboard-guide.md).

## Artifact Map

| Artifact | Purpose |
| --- | --- |
| [`requirements.md`](requirements.md) | Product requirements, fixed assumptions, external gates, and v1/v2 scope. |
| [`technical-design.md`](technical-design.md) | Components, data model, dependencies, write/read flows, and failure behavior. |
| [`tasks.md`](tasks.md) | Ordered implementation tasks with acceptance criteria and explicit dependencies. |
| [`test-strategy.md`](test-strategy.md) | Unit, integration, route, migration, LAT, and manual verification coverage. |
| [`traceability.md`](traceability.md) | Matrix linking guide sections to requirements, design, tasks, and tests. |
| [`assumptions-and-decisions.md`](assumptions-and-decisions.md) | Accepted decisions, deferred decisions, rejected alternatives, and the remaining user gate. |
| [`reviewer-alignment.md`](reviewer-alignment.md) | Independent reviewer summaries and convergence notes. |

## Build Rule: Source Data, Not Branded UI

The supplied training PDF is a benchmark seed-data source only. "HillerFit" is allowed as provenance in research notes, seed receipts, and extraction metadata, but it is not a customer-facing product surface. Do not build any HillerFit-branded page, route, tab, product navigation item, marketing copy, logo, call to action, theme treatment, or other branded UI; the shipped UI remains WODsmith's generic benchmark board/stat-line experience.

Non-goal: no HillerFit-branded pages, routes, tabs, navigation, stats pages, marketing surfaces, logos, calls to action, theme treatments, or customer-facing product areas.

Do not fork product behavior without an owner decision. In particular, do not switch v1 back to all-time history, Men/Women divisions, `competitionType: "online"`, publish-gated benchmark results, branded UI, or baked-constant Weighted C2B unless the decision sheet is updated first.
