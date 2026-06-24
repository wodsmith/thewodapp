export const CREW_SIGN_IN_PATH = "/sign-in"
export const CREW_SIGN_UP_PATH = "/sign-up"
export const CREW_AUTH_FALLBACK_PATH = "/events"

export interface CrewRouteLocation {
  pathname: string
  searchStr?: string
}

export function getCrewAuthRedirect(location: CrewRouteLocation) {
  return sanitizeCrewAuthRedirect(
    `${location.pathname}${location.searchStr ?? ""}`,
  )
}

export function sanitizeCrewAuthRedirect(
  value: string | null | undefined,
  fallback = CREW_AUTH_FALLBACK_PATH,
) {
  if (!value) return fallback
  if (!value.startsWith("/") || value.startsWith("//")) return fallback
  if (value.startsWith(CREW_SIGN_IN_PATH)) return fallback
  if (value.startsWith(CREW_SIGN_UP_PATH)) return fallback

  return value
}
