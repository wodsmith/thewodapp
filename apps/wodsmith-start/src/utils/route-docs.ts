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
