# Workout import integration acceptance

Integration began from `640e6668562f3ea96150e4c00424f9bb5c025229` on `zac/ai-workout-import-integration`. The infrastructure and UX plans in this directory were copied verbatim from the planning checkout; their research status describes their original authorship, not completed implementation.

## Ownership and order

The entitlement/save implementation owns shared schemas, access policy, provenance and transactional persistence. The backend owns plain Cloudflare Agents, TanStack AI, private sources and transport. The UX owns the review workspace and route adapters. Integration applies their scoped commits in that dependency order and checks the combined behavior.

Before integration, the owners must agree exact schema exports, session ownership, source references, RPC/state envelopes, revisions and provenance, final save inputs and return IDs. No production fixture or alternate save fallback can remain.

## Acceptance matrix

Each requirement below remains pending until its evidence is recorded. Mocked model output is not live model validation.

| Area | Required evidence | Status |
| --- | --- | --- |
| Personal library | Text and screenshot yield editable scored draft; explicit save returns a reloadable private workout | Pending |
| Track aliases | Both manager aliases create workout, movement links, track row and receipt atomically; owner/order/notes retained | Pending |
| Logging | Create and select retains date/notes without submitting results | Pending |
| Scoring | All supported fields roundtrip; 15-minute cap = 900 seconds; prescription rounds differ from separately recorded scores; ambiguous EMOM/units/parts block or ask | Pending |
| Entitlements | No grant, wrong team, expiry, revocation, missing write permission and unavailable lookup fail closed; actual grant/revoke mechanism covered | Pending |
| Agent boundaries | Direct session/upload/source/socket/RPC/state mutation cannot bypass authorization; open socket and completed draft after revocation denied | Pending |
| Persistence | Denied save makes zero writes; edited drafts require provenance; stale revision rejected; duplicate retry returns same IDs | Pending |
| Recovery | Cancel, late completion, reconnect, retry, expiry and failed save preserve permitted edits and avoid duplicate work | Pending |
| Manual regression | Create/edit/remix, choose existing track workout and ordinary logging remain functional | Pending |
| Runtime compatibility | Main/Crew scheduler tests, type checks and Worker builds with pinned importer stack | Pending |
| Browser | Desktop/mobile/keyboard source, review, error and save flows; focus and 200% zoom | Pending |
| Live evaluation | Actual TanStack adapter + Gateway text/vision calls; labeled corpus quality, latency and usage | Pending; credentials/runtime availability to inspect |

## Baseline and release boundary

Baseline `lat check` passes. Semantic `lat search` could not resolve `api.openai.com`; direct `lat locate` and source reads supplied design context. Initial offline dependency install failed because the package cache was incomplete; a frozen online install succeeded. Tests use Node 24 to match the repository engine requirement.

Baseline main-app type checking passes. The four existing workout, remix and scheduler test files pass all 97 tests. The initial Worker build cannot load Vite configuration because this new checkout lacks `.alchemy/local/wrangler.jsonc`; no application compilation occurred in that attempt.

No production deployment, entitlement grant or merge is authorized. Database schema/catalog provisioning, private bucket/DO/Gateway deployment, and live model evaluation must be distinguished from local deterministic tests. A draft PR is the review deliverable when GitHub access permits.
