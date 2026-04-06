/**
 * Cohost role metadata for competition co-management.
 *
 * Stored as JSON in teamMembershipTable.metadata for memberships
 * with roleId: "cohost" on competition_event teams.
 *
 * Each permission maps 1:1 to a sidebar navigation item.
 */
export interface CohostMembershipMetadata {
  // Competition Setup (defaults OFF except registrations)
  /** Divisions sidebar item */
  divisions: boolean
  /** Events sidebar item — edit events and publish event status */
  editEvents: boolean
  /** Scoring config sidebar item — how events are scored */
  scoringConfig: boolean
  /** View registrations list */
  viewRegistrations: boolean
  /** Add/remove/transfer registrations + registration rules */
  editRegistrations: boolean
  /** Waivers sidebar item */
  waivers: boolean

  // Run Competition (defaults ON)
  /** Schedule sidebar item */
  schedule: boolean
  /** Locations sidebar item */
  locations: boolean
  /** Volunteers sidebar item */
  volunteers: boolean
  /** Results sidebar item — score entry, review submissions, publish results */
  results: boolean

  // Business (defaults OFF)
  /** Pricing sidebar item */
  pricing: boolean
  /** Revenue sidebar item */
  revenue: boolean
  /** Coupons sidebar item */
  coupons: boolean
  /** Sponsors sidebar item */
  sponsors: boolean

  /** Optional notes from organizer */
  inviteNotes?: string
}

/**
 * Parse cohost permissions from a JSON metadata string.
 * Handles backward compat for renamed fields (events→editEvents, scoring→scoringConfig).
 */
export function parseCohostMetadata(json: string | null | undefined): CohostMembershipMetadata {
  if (!json) return { ...DEFAULT_COHOST_PERMISSIONS }
  try {
    const raw = JSON.parse(json)
    if (typeof raw !== "object" || raw === null) return { ...DEFAULT_COHOST_PERMISSIONS }
    const bool = (key: string, legacy?: string) => {
      if (typeof raw[key] === "boolean") return raw[key]
      if (legacy && typeof raw[legacy] === "boolean") return raw[legacy]
      return undefined
    }
    return {
      divisions: bool("divisions") ?? DEFAULT_COHOST_PERMISSIONS.divisions,
      editEvents: bool("editEvents", "events") ?? DEFAULT_COHOST_PERMISSIONS.editEvents,
      scoringConfig: bool("scoringConfig", "scoring") ?? DEFAULT_COHOST_PERMISSIONS.scoringConfig,
      viewRegistrations: bool("viewRegistrations") ?? DEFAULT_COHOST_PERMISSIONS.viewRegistrations,
      editRegistrations: bool("editRegistrations") ?? DEFAULT_COHOST_PERMISSIONS.editRegistrations,
      waivers: bool("waivers") ?? DEFAULT_COHOST_PERMISSIONS.waivers,
      schedule: bool("schedule") ?? DEFAULT_COHOST_PERMISSIONS.schedule,
      locations: bool("locations") ?? DEFAULT_COHOST_PERMISSIONS.locations,
      volunteers: bool("volunteers") ?? DEFAULT_COHOST_PERMISSIONS.volunteers,
      results: bool("results") ?? DEFAULT_COHOST_PERMISSIONS.results,
      pricing: bool("pricing") ?? DEFAULT_COHOST_PERMISSIONS.pricing,
      revenue: bool("revenue") ?? DEFAULT_COHOST_PERMISSIONS.revenue,
      coupons: bool("coupons") ?? DEFAULT_COHOST_PERMISSIONS.coupons,
      sponsors: bool("sponsors") ?? DEFAULT_COHOST_PERMISSIONS.sponsors,
      inviteNotes: typeof raw.inviteNotes === "string" ? raw.inviteNotes : undefined,
    }
  } catch {
    return { ...DEFAULT_COHOST_PERMISSIONS }
  }
}

/** Default permissions for new cohost invitations */
export const DEFAULT_COHOST_PERMISSIONS: Omit<
  CohostMembershipMetadata,
  "inviteNotes"
> = {
  // Competition Setup (defaults OFF except registrations)
  divisions: false,
  editEvents: false,
  scoringConfig: false,
  viewRegistrations: true,
  editRegistrations: false,
  waivers: false,

  // Run Competition (defaults ON)
  schedule: true,
  locations: true,
  volunteers: true,
  results: true,

  // Business (defaults OFF)
  pricing: false,
  revenue: false,
  coupons: false,
  sponsors: false,
}
