/**
 * Route documentation helpers (shared client/server, pure functions).
 *
 * The docs drawer matches CMS entries to the current page using TanStack
 * Router route IDs (e.g. `/compete/organizer/$competitionId/schedule`).
 * Route IDs are static patterns — dynamic segments stay as `$param` — so
 * they are stable keys that survive any concrete URL.
 */

/** Route id prefix that scopes the docs drawer to organizer pages. */
export const ORGANIZER_ROUTE_PREFIX = "/compete/organizer"

/**
 * Readable labels for organizer route segments, used to title route groups
 * in the docs Browse view. Mirrors the breadcrumb labels in
 * `routes/compete/organizer/$competitionId.tsx` so the panel speaks the
 * same language as the page chrome.
 */
const ROUTE_SEGMENT_LABELS: Record<string, string> = {
  "check-in": "Check-in",
  divisions: "Divisions & capacity",
  athletes: "Athletes",
  "form-questions": "Athlete registration questions",
  invites: "Invites",
  events: "Events",
  "event-divisions": "Event visibility",
  "submission-windows": "Submission windows",
  schedule: "Heat schedule",
  locations: "Venues & lanes",
  volunteers: "Volunteers",
  shifts: "Volunteer shifts",
  judges: "Judge assignments",
  "signup-questions": "Volunteer signup questions",
  waivers: "Waivers",
  scoring: "Scoring rules",
  results: "Results",
  "leaderboard-preview": "Leaderboard preview",
  review: "Review",
  pricing: "Pricing",
  revenue: "Revenue",
  coupons: "Coupons",
  sponsors: "Sponsors",
  settings: "Settings",
  edit: "Competition details",
  "danger-zone": "Danger zone",
  $competitionId: "Competition",
  $groupId: "Series",
  series: "Series",
  compete: "Compete",
  organizer: "Organizer",
}

export interface RouteDocForViewer {
  id: string
  title: string
  description: string | null
  type: "markdown" | "video" | "link"
  content: string | null
  videoUrl: string | null
  linkUrl: string | null
  sortOrder: number
  /** Route ids this doc matched against for the current page */
  routeIds: string[]
}

/**
 * Order docs for display in the drawer.
 *
 * `matchedRouteIds` is the current match chain ordered root → leaf. Docs
 * attached to the leaf-most route come first (most specific help on top),
 * then docs inherited from ancestor/layout routes. Within the same route
 * depth, docs are ordered by sortOrder then title.
 */
export function orderDocsForMatches<T extends RouteDocForViewer>(
  docs: T[],
  matchedRouteIds: string[],
): T[] {
  const depthOf = (doc: T) => {
    let deepest = -1
    for (const routeId of doc.routeIds) {
      const idx = matchedRouteIds.indexOf(routeId)
      if (idx > deepest) deepest = idx
    }
    return deepest
  }

  return [...docs].sort((a, b) => {
    const depthDiff = depthOf(b) - depthOf(a)
    if (depthDiff !== 0) return depthDiff
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
    return a.title.localeCompare(b.title)
  })
}

/**
 * Split docs into the page's own docs and docs inherited from ancestor
 * (layout) routes, so the drawer can surface "this page" help prominently
 * and demote section-wide help below it.
 *
 * `matchedRouteIds` is the current match chain ordered root → leaf. A doc
 * is a **page** doc when it is mapped to the leaf route id (the page the
 * user is actually on); everything else mapped to a shallower matched
 * route is a **section** doc. Both buckets are returned in display order
 * (see `orderDocsForMatches`).
 *
 * Trailing slashes are normalized before comparing, because index routes
 * surface a slashed leaf id (e.g. the competition overview matches
 * `/compete/organizer/$competitionId/`) while admins map docs to the
 * canonical slashless route id (`/compete/organizer/$competitionId`).
 */
export function bucketDocsForMatches<T extends RouteDocForViewer>(
  docs: T[],
  matchedRouteIds: string[],
): { page: T[]; section: T[] } {
  const stripSlash = (id: string) =>
    id.length > 1 && id.endsWith("/") ? id.slice(0, -1) : id

  const leafRouteId = matchedRouteIds.at(-1)
  const leaf = leafRouteId ? stripSlash(leafRouteId) : undefined
  const ordered = orderDocsForMatches(docs, matchedRouteIds)

  const page: T[] = []
  const section: T[] = []
  for (const doc of ordered) {
    if (leaf && doc.routeIds.some((routeId) => stripSlash(routeId) === leaf)) {
      page.push(doc)
    } else {
      section.push(doc)
    }
  }
  return { page, section }
}

/**
 * Turn an organizer route id into a human-readable label for the Browse
 * view (e.g. `/compete/organizer/$competitionId/schedule` → "Heat
 * schedule"). Falls back to a title-cased last segment for routes without
 * an explicit label, and ignores pathless layout segments (leading `_`).
 */
export function labelForRouteId(routeId: string): string {
  const segments = routeId
    .split("/")
    .filter(Boolean)
    .filter((segment) => !segment.startsWith("_"))

  const lastSegment = segments.at(-1)
  if (!lastSegment) return "Organizer"

  const known = ROUTE_SEGMENT_LABELS[lastSegment]
  if (known) return known

  return lastSegment
    .replace(/^\$/, "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

/**
 * Whether a video URL points directly at a playable file (e.g. an R2
 * upload) rather than a platform page. Direct files render with a native
 * <video> element; platform URLs go through VideoEmbed.
 */
export function isDirectVideoFileUrl(url: string): boolean {
  let pathname: string
  try {
    pathname = new URL(url).pathname
  } catch {
    return false
  }
  return /\.(mp4|webm|mov|m4v)$/i.test(pathname)
}
