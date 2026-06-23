import type { CrewViewerRole } from "@/lib/crew/navigation"

export interface CrewViewerInput {
  role?: CrewViewerRole | null
  session?: CrewSessionLike | null
  isWodsmithOperator?: boolean
  isDepartmentLead?: boolean
  isVolunteerPublic?: boolean
}

interface CrewSessionLike {
  user?: {
    role?: string | null
  } | null
}

export interface CrewViewer {
  role: CrewViewerRole
  isWodsmithOperator: boolean
  isOrganizer: boolean
  isDepartmentLead: boolean
  isVolunteerPublic: boolean
}

export class CrewAccessDeniedError extends Error {
  constructor(
    message = "FORBIDDEN: You do not have access to this Crew area.",
  ) {
    super(message)
    this.name = "CrewAccessDeniedError"
  }
}

/**
 * Resolves the crew viewer role and derives all boolean flags from it.
 * Explicit role inputs win, boolean inputs are fallbacks, and missing sessions
 * default to the least-privileged public volunteer persona.
 */
export function resolveCrewViewer(input: CrewViewerInput = {}): CrewViewer {
  const role = resolveCrewViewerRole(input)

  return {
    role,
    isWodsmithOperator: role === "wodsmith_operator",
    isOrganizer: role === "organizer_admin",
    isDepartmentLead: role === "department_lead",
    isVolunteerPublic: role === "volunteer_public",
  }
}

export function resolveCrewViewerRole({
  role,
  session,
  isWodsmithOperator = false,
  isDepartmentLead = false,
  isVolunteerPublic = false,
}: CrewViewerInput = {}): CrewViewerRole {
  if (role) return role
  if (isWodsmithOperator) return "wodsmith_operator"
  if (isDepartmentLead) return "department_lead"
  if (isVolunteerPublic) return "volunteer_public"
  if (session?.user?.role === "admin") return "wodsmith_operator"
  if (session?.user) return "organizer_admin"

  return "volunteer_public"
}

export async function requireCrewOperatorAccess(
  input: CrewViewerInput | CrewViewer = {},
) {
  const viewer = isResolvedCrewViewer(input) ? input : resolveCrewViewer(input)
  if (!viewer.isWodsmithOperator) {
    throw new CrewAccessDeniedError(
      "FORBIDDEN: Crew admin is available to WODsmith operators only.",
    )
  }

  return viewer
}

export async function requireCrewOrganizerAccess(
  eventId: string,
  input: CrewViewerInput | CrewViewer = {},
) {
  if (!eventId) {
    throw new CrewAccessDeniedError("FORBIDDEN: Crew event access is required.")
  }

  const viewer = isResolvedCrewViewer(input) ? input : resolveCrewViewer(input)
  if (
    viewer.isWodsmithOperator ||
    viewer.isOrganizer ||
    viewer.isDepartmentLead
  ) {
    return viewer
  }

  throw new CrewAccessDeniedError(
    "FORBIDDEN: Crew event access is available to event staff only.",
  )
}

function isResolvedCrewViewer(
  input: CrewViewerInput | CrewViewer,
): input is CrewViewer {
  return "isOrganizer" in input
}
