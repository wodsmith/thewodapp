import type { InferSelectModel } from "drizzle-orm"
import { relations } from "drizzle-orm"
import { mysqlTable, text, varchar } from "drizzle-orm/mysql-core"
import { commonColumns, createAddressId } from "./common"

// Address type enum for different use cases
export const ADDRESS_TYPE_ENUM = {
	BILLING: "billing",
	SHIPPING: "shipping",
	VENUE: "venue",
	GYM: "gym",
	OTHER: "other",
} as const

export type AddressType =
	(typeof ADDRESS_TYPE_ENUM)[keyof typeof ADDRESS_TYPE_ENUM]

// Addresses table
export const addressesTable = mysqlTable("addresses", {
	...commonColumns,
	id: varchar({ length: 255 })
		.primaryKey()
		.$defaultFn(() => createAddressId())
		.notNull(),
	// Type of address (billing, shipping, venue, etc.)
	addressType: varchar({ length: 20 }).$type<AddressType>(),
	// Optional name for the address (e.g., "Main Gym", "Downtown Location")
	name: varchar({ length: 255 }),
	// Street address line 1
	streetLine1: varchar({ length: 500 }),
	// Street address line 2 (optional)
	streetLine2: varchar({ length: 500 }),
	// City
	city: varchar({ length: 255 }),
	// State or province
	stateProvince: varchar({ length: 255 }),
	// Postal/zip code
	postalCode: varchar({ length: 50 }),
	// Country code (ISO 3166-1 alpha-2, e.g., "US", "CA")
	countryCode: varchar({ length: 2 }),
	// Optional notes or additional information
	notes: text(),
})

// Address relations
export const addressesRelations = relations(addressesTable, () => ({}))

// Type exports
export type Address = InferSelectModel<typeof addressesTable>
