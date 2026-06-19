# Route Docs

In-app documentation drawer for organizer pages. A lightweight CMS lets site admins author contextual help (markdown articles, videos, external links) and map it to routes; the drawer surfaces matching docs on each page.

The design mirrors PostHog's docs side panel: help lives next to the work instead of on a separate site. Articles can still link out to the Docusaurus site at docs.wodsmith.com via the `link` type.

## Data model

Three tables in [[apps/wodsmith-start/src/db/schemas/route-docs.ts]]: `route_docs` (content), `route_doc_routes` (route mappings), and `route_doc_versions` (content snapshots).

A doc has a `type` of `markdown`, `video`, or `link`, and stores only the field that type renders from (`content`, `videoUrl`, or `linkUrl`). `isPublished` gates drawer visibility; `sortOrder` orders docs within a page. Mappings are a many-to-many between docs and route ids, so one doc can serve several pages.

## Route matching

Docs are keyed to TanStack Router **route IDs** (e.g. `/compete/organizer/$competitionId/schedule`), not concrete URLs. Route ids are static patterns — dynamic segments stay as `$param` — so one mapping covers every competition.

The drawer reads the current match chain from `useMatches()` and queries docs for all matched route ids. Docs mapped to a layout route (e.g. `/compete/organizer/$competitionId`) therefore appear on every child page — useful for section-wide guides. [[apps/wodsmith-start/src/utils/route-docs.ts#orderDocsForMatches]] orders results leaf-most route first, then `sortOrder`, then title. [[apps/wodsmith-start/src/utils/route-docs.ts#bucketDocsForMatches]] then splits those results into **page** docs (mapped to the leaf route the user is on) and **section** docs (inherited from ancestor/layout routes), which the contextual view renders as separate groups.

## Workspace sidebar

[[apps/wodsmith-start/src/components/workspace-sidebar.tsx#WorkspaceSidebar]] wraps the organizer layout content (`/compete/organizer`) and opens a right-side panel from a floating launcher. It is named generically because it hosts more than help; Documentation is the first tab.

The panel is a **push sidebar**, not an overlay: it is a flex sibling of the page content, so opening it reflows the page to the left (`min-w-0 flex-1`) instead of dimming it behind a backdrop. The content stays fully interactive while docs are open, and the panel is `sticky top-0 h-screen` so it scrolls independently and stays in view as the user works. The panel and floating button are `md:`-gated — on narrow screens there is no room to push, so docs are hidden there.

The panel is **tabbed** via a compact dark icon toolbar at the top (`WORKSPACE_TABS`): small tab icons on the left, a close button on the right. Today the only tab is Documentation, but the toolbar is built to grow — add a tool (e.g. an agent) by extending `WORKSPACE_TABS` and rendering its panel in `WorkspaceContent`.

The documentation panel is a shallow navigation stack (depth ≤ 2) with three views, modeled on the contextual-help pattern used by Intercom/PostHog (answer first, browse second):

- **Contextual** (default): the current page's docs list under an "On this page" group, with inherited layout docs under "In this section". Every doc is a uniform row (type icon, title, description) — markdown/video rows drill into the article view, link rows open externally — so no single doc is arbitrarily singled out. A "Browse all docs" footer enters the browse view.
- **Article**: drilling into any markdown/video row opens a full-panel reading view with a Back control returning to whichever root the user came from. Link docs open their external URL directly (no article view).
- **Browse**: lazily loads the full published organizer doc set via [[apps/wodsmith-start/src/server-fns/route-docs-fns.ts#getOrganizerDocsIndexFn]] (cached for the session) and groups it by route id, labeled with [[apps/wodsmith-start/src/utils/route-docs.ts#labelForRouteId]]. The current page's group is badged "This page" and floated to the top; a search box filters by title/description.

Markdown renders via react-markdown with `remark-gfm` (GitHub-flavored markdown), styled by the `@tailwindcss/typography` `prose` classes (registered with `@plugin` in `src/styles.css`). Direct video files (R2 uploads) play in a native `<video>` element while platform URLs (YouTube/Vimeo) reuse the shared `VideoEmbed`. Contextual doc lookups go through [[apps/wodsmith-start/src/server-fns/route-docs-fns.ts#getRouteDocsForRouteFn]] (session required) and are cached per route-chain for the browser session. Failures are swallowed — help content must never break a page.

### Orders docs leaf-route first

Verifies `orderDocsForMatches` puts page-specific docs above docs inherited from layout routes, so organizers always see the most contextually relevant help first when several docs apply to a route chain.

Also covers: the deepest matched route wins when a doc maps to several routes, ties break by sortOrder then title, and the input array is not mutated.

### Buckets page docs from section docs

Verifies `bucketDocsForMatches` separates docs mapped to the current leaf route (the page the organizer is on) from docs inherited from ancestor/layout routes, so the contextual view can surface page-specific help prominently above section-wide help.

Also covers: a doc mapped to both the leaf and an ancestor counts as a page doc; an index-route leaf (slashed, e.g. `…/$competitionId/`) matches its canonical slashless doc mapping; and when the leaf route has no docs everything falls through to the section bucket.

### Detects direct video files

Verifies `isDirectVideoFileUrl` recognizes direct file URLs by pathname extension. The result decides whether the drawer plays a video natively (R2 uploads) or through the shared `VideoEmbed` component (platform URLs).

Also covers: mp4/webm/mov/m4v extensions match case-insensitively, platform URLs like YouTube/Vimeo are rejected, and video-looking query params and unparseable URLs are ignored to avoid false positives.

### Shows seeded docs end to end

Playwright e2e: a signed-in organizer on the dashboard sees the floating workspace launcher and opening it shows the seeded "Your first competition" doc — proving route matching, fetch, and rendering work against a real database.

The test targets the current component, not the old drawer: the launcher button is labeled "Open workspace panel", the opened panel is a `complementary` aside (not a dialog) headed "Documentation", and the link doc renders as an external anchor whose `href` is the mapped docs.wodsmith.com URL.

Relies on the e2e pipeline running `db:push` + `db:seed` first, so the `22-route-docs` seeder's published docs exist for the `/compete/organizer/_dashboard/` route id. The Playwright web server sets `VITE_E2E` to hide the TanStack Devtools trigger, which otherwise floats over the bottom-right corner and intercepts clicks on the drawer button.

## Admin CMS

Site admins manage docs at `/admin/docs` (list, create, edit). All CRUD server functions in [[apps/wodsmith-start/src/server-fns/route-docs-fns.ts]] call `requireAdmin`.

The list page [[apps/wodsmith-start/src/routes/admin/docs/index.tsx]] groups docs by mapped route id into collapsible sections (a doc mapped to multiple routes appears under each; unmapped docs collect in a "No routes mapped" group sorted last). A search box filters the groups by route id and auto-expands matches. Each mapped route group header has a `+` button linking to `/admin/docs/new?routeId=<id>`; [[apps/wodsmith-start/src/routes/admin/docs/new.tsx]] validates the `routeId` search param and pre-maps the new doc to that route via the form's `initialValues`. Its loader also calls [[apps/wodsmith-start/src/server-fns/route-docs-fns.ts#getNextSortOrderForRouteFn]] (max `sortOrder` among that route's docs, +1) to default the new doc's sort order to the end of the group.

Within a group, docs render in `sortOrder` (then title) order — the same order the drawer shows them. Docs are drag-reorderable via a grip handle (`@atlaskit/pragmatic-drag-and-drop`, scoped per group with a `Symbol` instanceId so docs can't cross groups). A drop optimistically reassigns 1-based `sortOrder` to the group's docs and persists via [[apps/wodsmith-start/src/server-fns/route-docs-fns.ts#reorderRouteDocsFn]], reverting on failure. Reordering is content-independent, so it never snapshots a version. The list keeps a local copy of the loader's docs for these optimistic reorders but re-syncs it whenever the loader refetches, so docs created or edited elsewhere (the create/edit pages call `router.invalidate()` on success) appear without a manual reload.

The edit form's route picker is populated at runtime from `router.routesById` filtered to the `/compete/organizer` prefix, so it always matches the deployed route tree with no hand-maintained list. Trailing-slash duplicates (e.g. `…/$competitionId/`) are dropped when their canonical slashless route id is also present. Mappings whose route id no longer exists in the tree are highlighted as stale so admins can remove them after route renames.

Dev environments get starter content from the `22-route-docs` seeder: a markdown setup guide on the competition layout plus link docs pointing at docs.wodsmith.com organizer guides for key pages.

## Video storage

Documentation videos upload to R2 under `docs/videos/`; small files keep the `/api/upload` compatibility path while large files use a raw-body multipart route.

Authorization in [[apps/wodsmith-start/src/server/upload-authorization.ts#checkUploadAuthorization]] restricts the purpose to site admins. Files are served from `R2_PUBLIC_URL` like other uploads; admins can alternatively paste YouTube/Vimeo URLs instead of uploading.

### PR-1 upload mitigation

Docs-video fallback upload is capped at 32MB and sends `file.stream()` to R2 so the Worker avoids the extra `file.arrayBuffer()` copy that exhausted memory on larger videos.

This remains the compatibility path for small files. Because `/api/upload` still parses multipart requests with `request.formData()`, the admin docs form sends larger local video files through the multipart route below instead of this fallback.

### Multipart large-video upload

Large admin docs videos upload through `/api/upload/docs-video`, which streams raw chunks to R2 multipart uploads and authorizes each step with a signed upload token.

The route uses the existing `docs-video` authorization check for every initiate, part, complete, and abort request. It accepts MP4/WebM/MOV files up to 100MB, creates R2 multipart uploads under `docs/videos/{userId}/`, streams `PUT` request bodies directly into `uploadPart`, and completes only a validated contiguous part list returned by the client. This avoids sending the full video through `request.formData()` and avoids mutable multipart state in eventually consistent KV while preserving the small-file `/api/upload` fallback.

### Streams docs-video without second buffer

Verifies the `/api/upload` handler passes a docs-video file stream to R2 without calling `file.arrayBuffer()`, avoiding the extra memory copy that failed large demo uploads.

### Preserves non-video buffered uploads

Verifies generic upload purposes still pass `file.arrayBuffer()` results to R2, keeping image and PDF upload behavior unchanged while docs-video receives the targeted mitigation.

### Rejects docs-video above demo-safe cap

Verifies docs-video uploads above 32MB return the configured size error before R2 writes, keeping admin UI copy, route validation, and docs aligned around the proven-safe cap.

### Initiates large multipart docs-video uploads

Verifies the multipart route validates admin docs-video metadata, creates an R2 multipart upload, returns a signed upload token, and never reads multipart form data.

### Streams raw multipart parts to R2

Verifies each large docs-video part request passes the raw `Request.body` stream to R2 multipart upload, avoiding Worker-side full-file buffering.

### Completes multipart docs-video uploads

Verifies the multipart route completes a validated R2 part list and returns the public docs-video URL used by the admin form.

### Rejects incomplete multipart docs-video uploads

Verifies completion refuses provided part sets whose contiguous part numbers or byte total do not match the initiated file size, preventing truncated videos from being saved as successful uploads.

### Aborts multipart docs-video uploads

Verifies failed or canceled multipart uploads abort the R2 multipart session using the signed upload token without reading mutable KV metadata.

## Versioning

Content-changing saves snapshot the previous state into `route_doc_versions` with an incrementing version number, giving git-style history without external storage.

Publish toggles and route remapping do not create versions. Restoring a version first snapshots the current state, so restores are themselves reversible. Versions are listed on the admin edit page with one-click restore.
