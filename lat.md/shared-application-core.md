# Shared Application Core

The shared application package gives Crew and Start one business-operation authority while preserving two product shells, composition roots, and deployables.

`@repo/wodsmith-application` exposes client-safe, framework-neutral values from its root and `/core` exports. Server-only MySQL adapters use the separate `/mysql` export so client imports cannot traverse storage or Worker dependencies.

Applications remain responsible for transport decoding, session and token resolution, redirects, response shaping, runtime bindings, and product-specific capability translation. Shared operations own domain decisions and their transaction edge.

## Effect Boundary

The core uses plain async functions, tagged `Result` values, injected clocks, and privacy-safe operation receipts instead of introducing an effect-system runtime.

Database, queue, payment, email, filesystem, environment, and Worker behavior belongs in server-only adapters. Operation-specific ports stay beside the operation that consumes them rather than accumulating in a generic service locator.

The logger preserves each receipt's operation and aggregate-ID types. Named ID interfaces with string or null properties can be recorded without adding an index signature or widening their shape.

## Drift Manifest

Known differences between same-path Crew and Start server functions are executable migration evidence rather than silent alternate authorities.

The [[lat.md/shared-application-core#Drift Manifest#Manifest File|drift manifest]] records every divergent peer. A pending placeholder is allowed before review, while missing classifications and new divergence fail; resolving known drift passes.

Each vertical slice must replace its wildcard operation placeholder with reviewed operations and classify differences before moving behavior into the package.

### Manifest File

The [checked-in JSON manifest](../packages/wodsmith-application/guardrails/shared-operation-drift-manifest.json) is the executable inventory consumed by the drift guard.

## Runtime Boundary Guard

Client-safe package exports have zero tolerance for app aliases, TanStack server APIs, React, Worker bindings, Node built-ins, database libraries, or provider SDKs. The guard follows the full local re-export graph from every client-safe entry point.

Local traversal selects files, including directory index modules. JavaScript specifiers resolve to corresponding TypeScript sources before emitted JavaScript so forbidden dependencies remain visible in source-only packages.

The server-function baseline fingerprints existing direct static imports by file and specifier, including sibling `.server` modules, bare Node built-ins, and database package subpaths. Removing existing debt passes; adding a new violation fails.

## Cross-App Parity Harness

Reviewed fixtures run through both app adapters and compare normalized outcomes so app-only metadata can differ without hiding business-policy drift.

Domain slices own their golden fixture corpus. The shared harness supplies only adapter execution and normalization mechanics, keeping score and identity policy out of infrastructure code.

## CI And Deployment

CI runs Crew, Start, and shared-package tests, and type-checks the package alongside both applications and the database package. Shared-package test hashes include its scripts, guardrail data, and both scanned server-function trees.

Crew deployment watches `packages/wodsmith-application/**` and verifies the package before building. Start deploys on every main push and verifies the package during manually dispatched deployment tests.
