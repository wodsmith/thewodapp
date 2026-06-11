# Route Docs

In-app documentation drawer for organizer pages. A lightweight CMS lets site admins author contextual help (markdown articles, videos, external links) and map it to routes; the drawer surfaces matching docs on each page.

The design mirrors PostHog's docs side panel: help lives next to the work instead of on a separate site. Articles can still link out to the Docusaurus site at docs.wodsmith.com via the `link` type.

## Data model

Three tables in [[apps/wodsmith-start/src/db/schemas/route-docs.ts]]: `route_docs` (content), `route_doc_routes` (route mappings), and `route_doc_versions` (content snapshots).

A doc has a `type` of `markdown`, `video`, or `link`, and stores only the field that type renders from (`content`, `videoUrl`, or `linkUrl`). `isPublished` gates drawer visibility; `sortOrder` orders docs within a page. Mappings are a many-to-many between docs and route ids, so one doc can serve several pages.

## Route matching

Docs are keyed to TanStack Router **route IDs** (e.g. `/compete/organizer/$competitionId/schedule`), not concrete URLs. Route ids are static patterns — dynamic segments stay as `$param` — so one mapping covers every competition.

The drawer reads the current match chain from `useMatches()` and queries docs for all matched route ids. Docs mapped to a layout route (e.g. `/compete/organizer/$competitionId`) therefore appear on every child page — useful for section-wide guides. [[apps/wodsmith-start/src/utils/route-docs.ts#orderDocsForMatches]] orders results leaf-most route first, then `sortOrder`, then title.

## Docs drawer

[[apps/wodsmith-start/src/components/docs-drawer.tsx#RouteDocsDrawer]] mounts once in the organizer layout (`/compete/organizer`). When published docs exist for the current route chain it shows a floating "Docs" button that opens a right-side sheet.

Markdown renders inline via react-markdown; direct video files (R2 uploads) play in a native `<video>` element while platform URLs (YouTube/Vimeo) reuse the shared `VideoEmbed`; link docs render an external-link button. Doc lookups go through [[apps/wodsmith-start/src/server-fns/route-docs-fns.ts#getRouteDocsForRouteFn]] (session required) and are cached per route-chain for the browser session. Failures are swallowed — help content must never break a page.

### Orders docs leaf-route first

Verifies `orderDocsForMatches` puts page-specific docs above docs inherited from layout routes, so organizers always see the most contextually relevant help first when several docs apply to a route chain.

Also covers: the deepest matched route wins when a doc maps to several routes, ties break by sortOrder then title, and the input array is not mutated.

### Detects direct video files

Verifies `isDirectVideoFileUrl` recognizes direct file URLs by pathname extension. The result decides whether the drawer plays a video natively (R2 uploads) or through the shared `VideoEmbed` component (platform URLs).

Also covers: mp4/webm/mov/m4v extensions match case-insensitively, platform URLs like YouTube/Vimeo are rejected, and video-looking query params and unparseable URLs are ignored to avoid false positives.

### Shows seeded docs end to end

Playwright e2e: a signed-in organizer on the dashboard sees the floating Docs button, and opening the drawer shows the seeded "Your first competition" link doc — proving route matching, fetch, and rendering work against a real database.

Relies on the e2e pipeline running `db:push` + `db:seed` first, so the `22-route-docs` seeder's published docs exist for the `/compete/organizer/_dashboard/` route id.

## Admin CMS

Site admins manage docs at `/admin/docs` (list, create, edit). All CRUD server functions in [[apps/wodsmith-start/src/server-fns/route-docs-fns.ts]] call `requireAdmin`.

The edit form's route picker is populated at runtime from `router.routesById` filtered to the `/compete/organizer` prefix, so it always matches the deployed route tree with no hand-maintained list. Mappings whose route id no longer exists in the tree are highlighted as stale so admins can remove them after route renames.

Dev environments get starter content from the `22-route-docs` seeder: a markdown setup guide on the competition layout plus link docs pointing at docs.wodsmith.com organizer guides for key pages.

## Video storage

Documentation videos upload to R2 through the existing `/api/upload` route using the `docs-video` purpose (MP4/WebM/MOV, 100MB max, stored under `docs/videos/`).

Authorization in [[apps/wodsmith-start/src/server/upload-authorization.ts#checkUploadAuthorization]] restricts the purpose to site admins. Files are served from `R2_PUBLIC_URL` like other uploads; admins can alternatively paste YouTube/Vimeo URLs instead of uploading.

## Versioning

Content-changing saves snapshot the previous state into `route_doc_versions` with an incrementing version number, giving git-style history without external storage.

Publish toggles and route remapping do not create versions. Restoring a version first snapshots the current state, so restores are themselves reversible. Versions are listed on the admin edit page with one-click restore.
