/**
 * Pure competition-settings helpers and public division types.
 *
 * Client-safe by design: no DB or server-only imports. Lives outside the
 * server-fns files so that server modules (src/server/*) can use these
 * without pulling a server-fn module into their import graph, and so that
 * client routes can keep importing them (via the re-exports in
 * competition-divisions-fns.ts) without dragging `@/db` into the browser
 * bundle.
 */

/**
 * Pending Stripe purchases older than this are ignored when counting
 * division reservations — Stripe checkout sessions expire after 30 minutes.
 */
export const PENDING_PURCHASE_MAX_AGE_MINUTES = 35

/**
 * Parse competition settings from JSON string
 */
export function parseCompetitionSettings(settings: string | null): {
	divisions?: { scalingGroupId?: string }
} | null {
	if (!settings) return null
	try {
		return JSON.parse(settings)
	} catch {
		return null
	}
}

export interface PublicCompetitionDivision {
	id: string
	label: string
	description: string | null
	registrationCount: number
	feeCents: number
	teamSize: number
	maxSpots: number | null
	spotsAvailable: number | null
	isFull: boolean
}

/**
 * The competition columns getPublicCompetitionDivisionsForCompetition needs —
 * lets callers that already loaded the competition row pass it straight in.
 */
export interface PublicDivisionsCompetitionInput {
	id: string
	settings: string | null
	defaultRegistrationFeeCents: number | null
	defaultMaxSpotsPerDivision: number | null
	maxTotalRegistrations: number | null
}
