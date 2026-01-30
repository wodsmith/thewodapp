/**
 * Address TypeScript types for location management
 * Re-exports Address from DB schema as source of truth
 */

// Re-export Address type from DB schema (single source of truth)
export type { Address } from "@/db/schemas/addresses"

/**
 * Address input type for creating/updating addresses
 * Uses DB type with auto-generated fields omitted
 */
import type { Address } from "@/db/schemas/addresses"
export type AddressInput = Omit<Address, "id" | "createdAt" | "updatedAt">

/**
 * Display configuration for location badges
 */
export interface LocationBadgeDisplay {
	text: string
	icon: "map-pin" | "globe"
}
