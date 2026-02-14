/**
 * Address Server Functions for TanStack Start
 * CRUD operations for addresses table
 *
 * This file uses top-level imports for server-only modules.
 */

import { createServerFn } from "@tanstack/react-start"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import { type AddressType, addressesTable } from "@/db/schemas/addresses"
import { createAddressId } from "@/db/schemas/common"
import { addressInputSchema } from "@/schemas/address"
import { normalizeAddressInput } from "@/utils/address"

// ===========================
// Input Schemas
// ===========================

const createAddressInputSchema = addressInputSchema

const updateAddressInputSchema = z.object({
	id: z.string().min(1, "Address ID is required"),
	data: addressInputSchema,
})

const getAddressInputSchema = z.object({
	id: z.string().min(1, "Address ID is required"),
})

// ===========================
// Server Functions
// ===========================

/**
 * Create a new address
 * Normalizes state and country codes before saving
 */
export const createAddressFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => createAddressInputSchema.parse(data))
	.handler(async ({ data }) => {
		const db = getDb()

		// Normalize state/country codes
		const normalized = normalizeAddressInput(data)

		// Generate ID upfront for MySQL compatibility
		const id = createAddressId()

		// Insert address with default addressType if not provided
		await db.insert(addressesTable).values({
			id,
			name: normalized.name ?? null,
			streetLine1: normalized.streetLine1 ?? null,
			streetLine2: normalized.streetLine2 ?? null,
			city: normalized.city ?? null,
			stateProvince: normalized.stateProvince ?? null,
			postalCode: normalized.postalCode ?? null,
			countryCode: normalized.countryCode ?? null,
			notes: normalized.notes ?? null,
			addressType: (normalized.addressType ?? "venue") as AddressType,
		})

		// Fetch the created address
		const address = await db.query.addressesTable.findFirst({
			where: eq(addressesTable.id, id),
		})

		if (!address) {
			throw new Error("Failed to create address")
		}

		return address
	})

/**
 * Update an existing address
 * Normalizes state and country codes before saving
 */
export const updateAddressFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => updateAddressInputSchema.parse(data))
	.handler(async ({ data }) => {
		const db = getDb()

		// Normalize state/country codes
		const normalized = normalizeAddressInput(data.data)

		// Build update object with only provided fields
		const updateData: Record<string, any> = {
			updatedAt: new Date(),
		}

		if (normalized.name !== undefined) updateData.name = normalized.name
		if (normalized.streetLine1 !== undefined)
			updateData.streetLine1 = normalized.streetLine1
		if (normalized.streetLine2 !== undefined)
			updateData.streetLine2 = normalized.streetLine2
		if (normalized.city !== undefined) updateData.city = normalized.city
		if (normalized.stateProvince !== undefined)
			updateData.stateProvince = normalized.stateProvince
		if (normalized.postalCode !== undefined)
			updateData.postalCode = normalized.postalCode
		if (normalized.countryCode !== undefined)
			updateData.countryCode = normalized.countryCode
		if (normalized.notes !== undefined) updateData.notes = normalized.notes
		if (normalized.addressType !== undefined)
			updateData.addressType = normalized.addressType

		// Update address with updatedAt timestamp
		await db
			.update(addressesTable)
			.set(updateData)
			.where(eq(addressesTable.id, data.id))

		// Fetch the updated address
		const address = await db.query.addressesTable.findFirst({
			where: eq(addressesTable.id, data.id),
		})

		if (!address) {
			throw new Error(`Address not found: ${data.id}`)
		}

		return address
	})

/**
 * Get an address by ID
 */
export const getAddressFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) => getAddressInputSchema.parse(data))
	.handler(async ({ data }) => {
		const db = getDb()

		const address = await db.query.addressesTable.findFirst({
			where: eq(addressesTable.id, data.id),
		})

		if (!address) {
			throw new Error(`Address not found: ${data.id}`)
		}

		return address
	})
