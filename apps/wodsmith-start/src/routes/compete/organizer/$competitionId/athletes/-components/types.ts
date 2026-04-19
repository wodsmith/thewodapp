/**
 * Shared types for the athlete detail page co-located components.
 *
 * These mirror the server function return shape for
 * `getOrganizerAthleteDetailFn` — keeping them here avoids circular imports
 * and lets each co-located component stay under its line budget.
 */

export interface AthleteDetailMember {
  userId: string
  firstName: string | null
  lastName: string | null
  email: string
  avatar: string | null
  isCaptain: boolean
  isActive: boolean
  joinedAt: Date | null
  // True when the user has no password and no verified email — i.e. an
  // organizer-created placeholder that has not been claimed yet. Organizers
  // may edit name/email only while this is true; after claim, the athlete
  // owns their own profile.
  isPlaceholder: boolean
}

export interface AthleteDetailRegistration {
  id: string
  status: string
  teamName: string | null
  divisionId: string | null
  paymentStatus: string | null
  paidAt: Date | null
  registeredAt: Date
  metadata: unknown
  commercePurchaseId: string | null
  userId: string
  athleteTeamId: string | null
}

export interface AthleteDetailDivision {
  id: string
  label: string
  teamSize: number
}

export interface AthleteDetailCommercePurchase {
  id: string
  totalCents: number
  status: string
  completedAt: Date | null
  stripePaymentIntentId: string | null
}

export interface AthleteDetailPendingInvite {
  id: string
  email: string
  status: string
  guestName?: string
  createdAt: Date
  expiresAt: Date | null
  pendingAnswers?: Array<{ questionId: string; answer: string }>
  pendingSignatures?: Array<{
    waiverId: string
    signedAt: string
    signatureName: string
  }>
  submittedAt?: string
  affiliateName?: string
}

export interface AthleteDetailQuestion {
  id: string
  label: string
  type: string
  helpText: string | null
  // Stored as a JSON string in DB (or null); parse when rendering selects.
  options: string | null
  required: boolean
  forTeammates: boolean
  sortOrder: number
}

export interface AthleteDetailWaiver {
  id: string
  title: string
  required: boolean
}

export interface AthleteDetailWaiverSignature {
  userId: string
  waiverId: string
  signedAt: Date
}

export interface AthleteDetailEvent {
  id: string
  trackWorkoutId: string
  workoutId: string
  workoutName: string
  scheme: string
  scoreType: string | null
  timeCap: number | null
  tiebreakScheme: string | null
  repsPerRound: number | null
  roundsToScore: number | null
  submissionWindowStartsAt: Date | string | null
  submissionWindowEndsAt: Date | string | null
  ordinal: number
}

export interface AthleteDetailVideoSubmission {
  id: string
  eventId: string
  trackWorkoutId: string
  videoIndex: number
  userId: string
  videoUrl: string
  notes: string | null
  reviewedAt: Date | null
  status: string
  scoreId: string | null
}

export interface AthleteDetailScoreRound {
  roundIndex: number
  scoreValue: number
}

export interface AthleteDetailScore {
  id: string
  trackWorkoutId: string | null
  userId: string
  divisionId: string | null
  scoreStatus: string
  scoreValue: number | null
  secondaryScore: number | null
  tieBreakScore: number | null
  scoreRounds: AthleteDetailScoreRound[]
  updatedAt: Date
}

export function memberDisplayName(member: AthleteDetailMember): string {
  const name = [member.firstName, member.lastName]
    .filter(Boolean)
    .join(" ")
    .trim()
  return name || member.email
}

export function memberInitials(member: AthleteDetailMember): string {
  const first = member.firstName?.[0] ?? ""
  const last = member.lastName?.[0] ?? ""
  return (first + last).toUpperCase() || member.email[0]?.toUpperCase() || "?"
}
