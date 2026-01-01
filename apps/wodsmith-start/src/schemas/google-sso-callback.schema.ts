import { z } from "zod"

export const googleSSOCallbackSchema = z.object({
	code: z.string().min(1, "Authorization code is required"),
	state: z.string().min(1, "State parameter is required"),
})

export type GoogleSSOCallbackInput = z.infer<typeof googleSSOCallbackSchema>
