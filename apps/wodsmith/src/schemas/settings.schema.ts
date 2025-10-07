import { z } from "zod"

export const userSettingsSchema = z.object({
	firstName: z.string().min(2, {
        error: "First name must be at least 2 characters."
    }),
	lastName: z.string().min(2, {
        error: "Last name must be at least 2 characters."
    }),
})
