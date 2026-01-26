/**
 * Address TypeScript types for location management
 */

/**
 * Complete Address interface matching database schema
 */
export interface Address {
	id: string
	addressType: string | null
	name: string | null
	streetLine1: string | null
	streetLine2: string | null
	city: string | null
	stateProvince: string | null
	postalCode: string | null
	countryCode: string | null
	notes: string | null
	createdAt: Date
	updatedAt: Date
}

/**
 * Address input type for creating/updating addresses
 * Omits auto-generated fields (id, timestamps)
 */
export type AddressInput = Omit<Address, 'id' | 'createdAt' | 'updatedAt'>

/**
 * Display configuration for location badges
 */
export interface LocationBadgeDisplay {
	text: string
	icon: 'map-pin' | 'globe'
}
