/**
 * Authentication Schemas
 * These schemas are safe to import on the client side.
 * Server functions using these schemas are in @/server-fns/auth-fns.ts
 */

import { z } from "zod"

export const signInSchema = z.object({
	email: z.string().email("Please enter a valid email address"),
	password: z.string().min(1, "Password is required"),
})

export type SignInInput = z.infer<typeof signInSchema>

export const signUpSchema = z.object({
	email: z.string().email("Please enter a valid email address"),
	firstName: z.string().min(1, "First name is required"),
	lastName: z.string().min(1, "Last name is required"),
	password: z
		.string()
		.min(8, "Password must be at least 8 characters")
		.regex(/[A-Z]/, "Password must contain at least one uppercase letter")
		.regex(/[a-z]/, "Password must contain at least one lowercase letter")
		.regex(/[0-9]/, "Password must contain at least one number"),
})

export type SignUpInput = z.infer<typeof signUpSchema>

export const resetPasswordSchema = z
	.object({
		token: z.string().min(1, "Token is required"),
		password: z
			.string()
			.min(8, "Password must be at least 8 characters")
			.regex(/[A-Z]/, "Password must contain at least one uppercase letter")
			.regex(/[a-z]/, "Password must contain at least one lowercase letter")
			.regex(/[0-9]/, "Password must contain at least one number"),
		confirmPassword: z.string(),
	})
	.refine((data) => data.password === data.confirmPassword, {
		message: "Passwords do not match",
		path: ["confirmPassword"],
	})

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>

export const verifyEmailSchema = z.object({
	token: z.string().min(1, "Verification token is required"),
})

export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>

export const forgotPasswordSchema = z.object({
	email: z.string().email("Please enter a valid email address"),
})

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
