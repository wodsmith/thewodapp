import { z } from "zod"

export const resetPasswordSchema = z
	.object({
		token: z.string(),
		password: z.string().min(8, "Password must be at least 8 characters"),
		confirmPassword: z.string(),
	})
	.refine((data) => data.password === data.confirmPassword, {
		path: ["confirmPassword"],
        error: "Passwords do not match"
    })

export type ResetPasswordSchema = z.infer<typeof resetPasswordSchema>
