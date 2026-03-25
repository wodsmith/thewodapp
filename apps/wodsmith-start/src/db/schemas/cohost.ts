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
  /** Events sidebar item */
  events: boolean
  /** Scoring sidebar item */
  scoring: boolean
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
  /** Results sidebar item */
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

/** Default permissions for new cohost invitations */
export const DEFAULT_COHOST_PERMISSIONS: Omit<
  CohostMembershipMetadata,
  "inviteNotes"
> = {
  // Competition Setup (defaults OFF except registrations)
  divisions: false,
  events: false,
  scoring: false,
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
