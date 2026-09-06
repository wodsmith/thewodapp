# CrossFit Daily Import

CrossFit.com daily programming is imported through a Cloudflare Workflow into the public source track, retaining source text and explicit dates while protecting publication from duplicate retries.

## Schedule

Production imports begin at 05:00 PST, fixed UTC−8, using a 13:00 UTC cron. A second cron checks publication at 15:15 UTC. Other deployment stages have no cron.

The date comes from the scheduled timestamp, not the execution or retry time. Each scheduled instance uses `crossfit-YYYY-MM-DD`; administrator runs use separate instance IDs but share the database's source-date identity. This schedule is 06:00 Pacific daylight time in summer.

## Source Validation

The source adapter requests CrossFit's public `/workout/YYYY/MM/DD` JSON endpoint and validates the exact date, canonical URL, language, publication state, and Markdown before conversion.

Requests have a 30-second timeout, disallow redirects, and stream at most 256 KB. Source Markdown is additionally limited to 60,000 UTF-8 bytes so the ledger and attributed workout description fit MySQL TEXT storage. Original Markdown is normalized only for newlines and outer whitespace, then hashed. Missing content cannot become a rest day. The short `/YYMMDD` URL remains visible as source attribution.

## Scoring Conversion

Explicit rest days, narrow timed or rep-count workouts, and simple load-set prescriptions convert deterministically. Other formats use bounded structured output through Workers AI Gateway, followed by source-based validation.

The converter cannot choose track IDs or publish. The gateway adapter sends the JSON schema to Workers AI, and local validation checks the result independently. Evidence must appear in the main prescription and support the chosen scheme, including explicit movement-count scoring. Caps must be explicit; timed components minimize time. Score counts require explicit source requests, with one score by default and a score per prescribed load set. Non-timed scores reject minimum aggregation; sums and averages require explicit scoring instructions. A source requesting time and load requires both components. Unsupported conversion stays private for review. Source scaling remains in the preserved description rather than creating new scaling levels.

## Durable Execution

The Workflow checkpoints initialization, source attempts, source snapshot, conversion, and publication. Temporary source failures wait at least fifteen minutes and respect Retry-After within a two-hour window.

Dry runs return source and normalized output without database writes. Completed imports return before fetching or converting again. Invalid conversion or a source revision detected at publication records `needs_review`; fetch or publication errors record `failed` and propagate to Workflow/Sentry monitoring. The admin panel supports preview, explicit publication, status refresh, and inspection of original source and failure details.

## Publication

Two additive MySQL tables store one source-date import and its scoreable items. Publication locks the import and destination track, inserts all public rows, and marks publication within one transaction.

The unique provider/track/date constraint and deterministic identities protect retries after commit. The publisher verifies `ptrk_crossfit_dotcom` remains public, third-party, owned by its configured team, and unrelated to a competition. Manual additions verify the workout exists and allocate order under the same track lock; caller-supplied CrossFit order is rejected. All track edits, visibility changes, removals, and deletions require site administration. Published editorial changes remain intact on replay.

Rest imports contain zero scoreable items. Pending and failed imports have no public workout rows; competition-oriented `eventStatus` cannot hide an uncertain import from existing library readers. Apply the additive migration before deploying code that reads the import tables. Production schema changes use the existing PlanetScale deploy-request process.

## Dated Track Feed

The CrossFit.com track shows up to sixty published import days, newest first, with source attribution, expandable programming, rest labels, and links to each independently scoreable workout.

The main prescription is visible immediately; full source and scaling Markdown mount only when their disclosure is expanded. The published feed is intentionally public; administrator diagnostics are separate and return only fields used by the review panel. The existing workout library remains available below the dated feed. The source track's subscriptions do not automatically create [[training#Training#Session Model]] entries or gym-specific scheduled instances.

## Tests

These tests cover extraction, interpretation, durable execution, actual MySQL transactions, and the dated track display.

Database tests require an explicit local socket or loopback TCP configuration; they create and remove their own disposable database and resolve the migration independently of the runner directory.

### Source identity and failures

Source parsing accepts the requested published date and rejects mismatched dates, empty content, and schema changes so another day's programming cannot be published accidentally.

### Bounded fetching

Fetching rejects oversized and malformed responses, disallows redirects, and distinguishes temporary HTTP failures and Retry-After from permanent errors.

### PST calendar dates

Schedule date derivation remains fixed at UTC−8 across daylight-saving changes and preserves the previous calendar day before PST midnight.

### Rest and simple timed workouts

Explicit rest, timed and rep-count instructions, and load sets convert without inference while preserving scaling. Load-set scores retain every prescribed set; an ordinary workout cannot be reclassified as rest.

### Composite scores and caps

Time-and-load programming requires both scores, and a transition at twenty minutes cannot become a time cap unless the source explicitly prescribes a cap.

### Unsupported model claims

Scoring validation rejects invented evidence and invalid score direction while accepting source-backed AMRAP and load schemes.

### Atomic replay and concurrency

Concurrent publication and retry after commit create exactly one set of workout rows and preserve later editorial changes.

### Rest publication

A rest day appears in the dated feed without scoreable workouts and remains unchanged when replayed.

### Rollback and held visibility

A failure in any component rolls back all public rows while pending imports remain absent from the published feed.

### Manual and automated ordering

Manual and automated append operations allocate distinct sequence positions under the same lock, and publication refuses an unexpected destination owner.

### Dry run isolation

A dry run returns reviewable source and conversion output without initializing, modifying, or publishing database records.

### Completed workflow replay

A published import short-circuits before source fetching or AI conversion to avoid changing existing programming on replay.

### Late publication retry

A temporarily unavailable source sleeps according to Retry-After and retries the same explicit calendar date before publishing.

### Failed conversion remains private

Conversion failure records a review status, creates no public workout, and propagates the error to the workflow monitor.

### Permanent fetch failure

A source identity error fails immediately without sleeping, publishing, or treating missing programming as a rest day.

### Rest and component display

The dated feed attributes its source and links each scoreable component while showing rest days without score actions.

### Scoring review regressions

Reject invented score counts, reversed non-time scoring, and unsupported aggregation. Preserve separately requested strength and metcon scores, and parse cap units without case sensitivity.

### Storage bytes and transient timeouts

Reject Markdown exceeding the UTF-8 storage budget before writes, and treat HTTP 408 as a retryable source timeout.

### Source revision review

A source hash change at publication remains private and records a review outcome that survives Workflow step serialization.

### Missing manual workout

A nonexistent manual workout cannot create an orphaned track link or consume a sequence position.

### Deferred programming text

Collapsed daily entries do not mount Markdown; opening and closing a disclosure mounts and removes only that day's text.

### Track mutation authorization

Non-admin users cannot add, remove, edit, hide, or delete the CrossFit source track's content through the programming server functions.

### Automatic append contract

CrossFit additions omit caller-selected order, while other tracks retain required explicit ordering and their existing access behavior.

### Administrator track edits

Administrators can perform the protected CrossFit edits after authorization, preserving the intended maintenance workflow.

### Qualified composite score requests

Qualified score requests preserve total-rep AMRAP components, ignore unscored distances, and accept explicit counts with possessive or ranking words.

### Preview hash binding

The Workflow rejects a changed source hash before snapshot or publication, preserving the administrator's reviewed prescription.

### Admin preview date consent

The admin component requires a completed same-date preview, displays rich scoring metadata, and sends its hash only with an explicit publish action.

### Reader admin boundary

The actual reader hides administrator operations for ordinary users, exposes only the labeled destination to admins, and collapses legacy workouts.

## Reader and Administrator Destinations

The track page leads with selected-date programming and keeps following, gym-library access, and administrator operations distinct. The selected date uses a calendar-safe URL field and explicit fixed-PST Today labeling.

[[apps/wodsmith-start/src/components/track-detail-view.tsx#TrackDetailView]] renders the shared production reader. Its bounded archive contains the latest sixty published days, while exact-date queries work independently. Legacy workouts stay navigable under a collapsed library without raw order badges or literal Markdown title markers. Prescription text appears once per day; source/scaling Markdown mounts only after expansion.

Site administrators receive a labeled Admin section linking to `/admin/programming/ptrk_crossfit_dotcom`. Its loader calls an admin-authorized server read. Preview and publish remain separate; preview state resets with the chosen source date. The Workflow accepts an optional expected source hash and holds changed content for review before snapshot or publication. Automatic scheduled runs keep their existing parameters and cron semantics.
