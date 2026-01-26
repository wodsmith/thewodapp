/**
 * Address Schemas
 * These schemas are safe to import on the client side.
 */

import { z } from "zod"

export const addressSchema = z.object({
	name: z.string().max(200).nullable(),
	streetLine1: z.string().max(200).nullable(),
	streetLine2: z.string().max(200).nullable(),
	city: z.string().max(100).nullable(),
	stateProvince: z.string().max(10).nullable(),
	postalCode: z.string().max(20).nullable(),
	countryCode: z.string().max(2).nullable(),
	notes: z.string().max(1000).nullable(),
	addressType: z
		.enum(["competition", "venue", "gym", "team"])
		.nullable(),
})

export const addressInputSchema = z.object({
	name: z.string().max(200).optional(),
	streetLine1: z.string().max(200).optional(),
	streetLine2: z.string().max(200).optional(),
	city: z.string().max(100).optional(),
	stateProvince: z.string().max(10).optional(),
	postalCode: z.string().max(20).optional(),
	countryCode: z.string().max(2).optional(),
	notes: z.string().max(1000).optional(),
	addressType: z
		.enum(["competition", "venue", "gym", "team"])
		.optional(),
})

export type AddressSchemaType = z.infer<typeof addressSchema>
export type AddressInputType = z.infer<typeof addressInputSchema>
