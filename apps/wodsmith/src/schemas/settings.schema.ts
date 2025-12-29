import { z } from "zod"
import { GENDER_ENUM } from "@/db/schemas/users"

export const userSettingsSchema = z.object({
	firstName: z.string().min(2, {
		message: "First name must be at least 2 characters.",
	}),
	lastName: z.string().min(2, {
		message: "Last name must be at least 2 characters.",
	}),
})

export const athleteProfileSchema = z.object({
	gender: z.enum([GENDER_ENUM.MALE, GENDER_ENUM.FEMALE], {
		required_error: "Please select your gender",
	}),
	dateOfBirth: z.coerce.date({
		required_error: "Please enter your date of birth",
		invalid_type_error: "Invalid date",
	}),
	affiliateName: z.string().optional(),
})

// Extended athlete profile JSON schema
export const athleteProfileExtendedSchema = z.object({
	// Core profile fields (stored as direct columns)
	gender: z.enum([GENDER_ENUM.MALE, GENDER_ENUM.FEMALE]).optional(),
	dateOfBirth: z.string().optional(), // ISO date string YYYY-MM-DD
	affiliateName: z.string().max(255).optional(), // Default affiliate for registration

	// Extended profile fields (stored as JSON)
	preferredUnits: z.enum(["imperial", "metric"]).default("imperial"),
	heightCm: z.number().positive().optional(),
	weightKg: z.number().positive().optional(),
	coverImageUrl: z.string().optional(),

	conditioning: z
		.object({
			// Notable metcons (can be manually entered or suggested from database)
			fran: z
				.object({ time: z.string().optional(), date: z.string().optional() })
				.optional(),
			grace: z
				.object({ time: z.string().optional(), date: z.string().optional() })
				.optional(),
			helen: z
				.object({ time: z.string().optional(), date: z.string().optional() })
				.optional(),
			diane: z
				.object({ time: z.string().optional(), date: z.string().optional() })
				.optional(),
			murph: z
				.object({ time: z.string().optional(), date: z.string().optional() })
				.optional(),
			// Other conditioning benchmarks
			row2k: z
				.object({ time: z.string().optional(), date: z.string().optional() })
				.optional(),
			run1Mile: z
				.object({ time: z.string().optional(), date: z.string().optional() })
				.optional(),
			run5k: z
				.object({ time: z.string().optional(), date: z.string().optional() })
				.optional(),
			row500m: z
				.object({ time: z.string().optional(), date: z.string().optional() })
				.optional(),
			maxPullups: z
				.object({ reps: z.string().optional(), date: z.string().optional() })
				.optional(),
			maxCindyRounds: z
				.object({ rounds: z.string().optional(), date: z.string().optional() })
				.optional(),
		})
		.optional(),

	strength: z
		.object({
			backSquat: z
				.object({
					weight: z.number().optional(),
					unit: z.enum(["kg", "lbs"]).optional(),
					date: z.string().optional(),
				})
				.optional(),
			deadlift: z
				.object({
					weight: z.number().optional(),
					unit: z.enum(["kg", "lbs"]).optional(),
					date: z.string().optional(),
				})
				.optional(),
			benchPress: z
				.object({
					weight: z.number().optional(),
					unit: z.enum(["kg", "lbs"]).optional(),
					date: z.string().optional(),
				})
				.optional(),
			press: z
				.object({
					weight: z.number().optional(),
					unit: z.enum(["kg", "lbs"]).optional(),
					date: z.string().optional(),
				})
				.optional(),
			snatch: z
				.object({
					weight: z.number().optional(),
					unit: z.enum(["kg", "lbs"]).optional(),
					date: z.string().optional(),
				})
				.optional(),
			cleanAndJerk: z
				.object({
					weight: z.number().optional(),
					unit: z.enum(["kg", "lbs"]).optional(),
					date: z.string().optional(),
				})
				.optional(),
		})
		.optional(),

	social: z
		.object({
			facebook: z.string().url().optional().or(z.literal("")),
			instagram: z.string().url().optional().or(z.literal("")),
			twitter: z.string().url().optional().or(z.literal("")),
			tiktok: z.string().url().optional().or(z.literal("")),
		})
		.optional(),

	// NOTE: sponsors field removed - now stored in sponsors table
	// Use getUserSponsors() from @/server/sponsors instead
})
