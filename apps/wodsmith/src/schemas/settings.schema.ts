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
})
