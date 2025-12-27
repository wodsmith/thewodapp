import { createId } from "@paralleldrive/cuid2"

export interface SponsorGroupFactory {
	id: string
	competitionId: string
	name: string
	displayOrder: number
	createdAt: Date
	updatedAt: Date
	updateCounter: number | null
}

export interface SponsorFactory {
	id: string
	competitionId: string | null
	userId: string | null
	groupId: string | null
	name: string
	logoUrl: string | null
	website: string | null
	displayOrder: number
	createdAt: Date
	updatedAt: Date
	updateCounter: number | null
}

/**
 * Create a test sponsor group with sensible defaults.
 * All properties can be overridden.
 *
 * @example
 * ```ts
 * const group = createSponsorGroup({ competitionId: comp.id })
 * const goldSponsors = createSponsorGroup({ name: "Gold Sponsors", displayOrder: 1 })
 * ```
 */
export function createSponsorGroup(
	overrides?: Partial<SponsorGroupFactory>,
): SponsorGroupFactory {
	const id = overrides?.id ?? `spgrp_${createId()}`
	const now = new Date()
	return {
		id,
		competitionId: `comp_${createId()}`,
		name: `Sponsor Group ${id.slice(0, 8)}`,
		displayOrder: 0,
		createdAt: now,
		updatedAt: now,
		updateCounter: null,
		...overrides,
	}
}

/**
 * Create a test sponsor with sensible defaults.
 * All properties can be overridden.
 *
 * @example
 * ```ts
 * // Competition sponsor
 * const sponsor = createSponsor({ competitionId: comp.id })
 *
 * // Athlete sponsor
 * const athleteSponsor = createSponsor({ userId: user.id, competitionId: null })
 *
 * // With group
 * const goldSponsor = createSponsor({ competitionId: comp.id, groupId: group.id })
 * ```
 */
export function createSponsor(
	overrides?: Partial<SponsorFactory>,
): SponsorFactory {
	const id = overrides?.id ?? `spnsr_${createId()}`
	const now = new Date()
	return {
		id,
		competitionId: `comp_${createId()}`,
		userId: null,
		groupId: null,
		name: `Test Sponsor ${id.slice(0, 8)}`,
		logoUrl: null,
		website: null,
		displayOrder: 0,
		createdAt: now,
		updatedAt: now,
		updateCounter: null,
		...overrides,
	}
}
