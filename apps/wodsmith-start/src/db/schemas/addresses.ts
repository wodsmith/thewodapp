import type { InferSelectModel } from "drizzle-orm"
import { relations } from "drizzle-orm"
import { sqliteTable, text } from "drizzle-orm/sqlite-core"
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

const addressTypeTuple = Object.values(ADDRESS_TYPE_ENUM) as [
	string,
	...string[],
]

// Addresses table
export const addressesTable = sqliteTable("addresses", {
	...commonColumns,
	id: text()
		.primaryKey()
		.$defaultFn(() => createAddressId())
		.notNull(),
	// Type of address (billing, shipping, venue, etc.)
	addressType: text({
		enum: addressTypeTuple,
	}).$type<AddressType>(),
	// Optional name for the address (e.g., "Main Gym", "Downtown Location")
	name: text({
		length: 255,
	}),
	// Street address line 1
	streetLine1: text({
		length: 500,
	}),
	// Street address line 2 (optional)
	streetLine2: text({
		length: 500,
	}),
	// City
	city: text({
		length: 255,
	}),
	// State or province
	stateProvince: text({
		length: 255,
	}),
	// Postal/zip code
	postalCode: text({
		length: 50,
	}),
	// Country code (ISO 3166-1 alpha-2, e.g., "US", "CA")
	countryCode: text({
		length: 2,
	}),
	// Optional notes or additional information
	notes: text({
		length: 1000,
	}),
})

// Address relations
export const addressesRelations = relations(addressesTable, () => ({}))

// Type exports
export type Address = InferSelectModel<typeof addressesTable>
