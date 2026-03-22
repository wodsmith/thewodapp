/**
 * Cohost role metadata for competition co-management.
 *
 * Stored as JSON in teamMembershipTable.metadata for memberships
 * with roleId: "cohost" on competition_event teams.
 */
export interface CohostMembershipMetadata {
  /** Can view revenue stats and financial dashboard */
  canViewRevenue: boolean
  /** Can modify capacity defaults and per-division max spots */
  canEditCapacity: boolean
  /** Can modify scoring algorithm and tiebreak rules */
  canEditScoring: boolean
  /** Can modify judge rotation defaults */
  canEditRotation: boolean
  /** Can manage pricing and coupons */
  canManagePricing: boolean
  /** Optional notes from organizer */
  inviteNotes?: string
}

/** Default permissions for new cohost invitations */
export const DEFAULT_COHOST_PERMISSIONS: Omit<
  CohostMembershipMetadata,
  "inviteNotes"
> = {
  canViewRevenue: false,
  canEditCapacity: true,
  canEditScoring: true,
  canEditRotation: true,
  canManagePricing: false,
}
