import { zodResolver } from "@hookform/resolvers/zod"
import { createFileRoute, Link, useRouter } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { eq } from "drizzle-orm"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { REDIRECT_AFTER_SIGN_IN } from "@/constants"
import { getDb } from "@/db"
import { userTable } from "@/db/schema"
import { getResetTokenKey } from "@/utils/auth-utils"
import { hashPassword } from "@/utils/password-hasher"

// Define schema inline to avoid import issues with zod versions
const resetPasswordSchema = z
	.object({
		token: z.string().min(1, "Token is required"),
		password: z.string().min(8, "Password must be at least 8 characters"),
		confirmPassword: z.string(),
	})
	.refine((data) => data.password === data.confirmPassword, {
		message: "Passwords do not match",
		path: ["confirmPassword"],
	})

type ResetPasswordSchema = z.infer<typeof resetPasswordSchema>

// Search params schema for validation
const searchSchema = z.object({
	token: z.string().optional(),
})

// Server function to validate token exists before rendering the page
const validateTokenServerFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) =>
		z.object({ token: z.string() }).parse(data),
	)
	.handler(async ({ data }) => {
		const { env } = await import("cloudflare:workers")

		const tokenData = await env.KV_SESSION.get(getResetTokenKey(data.token))

		if (!tokenData) {
			return { valid: false, error: "Invalid or expired reset token" }
		}

		try {
			const parsed = JSON.parse(tokenData) as {
				userId: string
				expiresAt: string
			}

			// Check if token is expired
			if (new Date() > new Date(parsed.expiresAt)) {
				return { valid: false, error: "Reset token has expired" }
			}

			return { valid: true }
		} catch {
			return { valid: false, error: "Invalid token format" }
		}
	})

// Server function to reset password
const resetPasswordServerFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => resetPasswordSchema.parse(data))
	.handler(async ({ data }) => {
		const { env } = await import("cloudflare:workers")
		const db = getDb()

		// Find valid reset token
		const resetTokenStr = await env.KV_SESSION.get(getResetTokenKey(data.token))

		if (!resetTokenStr) {
			throw new Error("Invalid or expired reset token")
		}

		const resetToken = JSON.parse(resetTokenStr) as {
			userId: string
			expiresAt: string
		}

		// Check if token is expired (although KV should have auto-deleted it)
		if (new Date() > new Date(resetToken.expiresAt)) {
			throw new Error("Reset token has expired")
		}

		// Find user
		const user = await db.query.userTable.findFirst({
			where: eq(userTable.id, resetToken.userId),
		})

		if (!user) {
			throw new Error("User not found")
		}

		// Hash new password and update
		const passwordHash = await hashPassword({ password: data.password })
		await db
			.update(userTable)
			.set({ passwordHash })
			.where(eq(userTable.id, resetToken.userId))

		// Delete the used token
		await env.KV_SESSION.delete(getResetTokenKey(data.token))

		return { success: true }
	})

export const Route = createFileRoute("/_auth/reset-password")({
	component: ResetPasswordPage,
	validateSearch: (search: Record<string, unknown>) =>
		searchSchema.parse(search),
	beforeLoad: async ({ search }) => {
		// If no token, we'll show an error message in the component
		if (!search.token) {
			return { tokenValid: false, tokenError: "No reset token provided" }
		}

		// Validate the token exists and is not expired
		const result = await validateTokenServerFn({
			data: { token: search.token },
		})
		return { tokenValid: result.valid, tokenError: result.error }
	},
})

function ResetPasswordPage() {
	const router = useRouter()
	const { token } = Route.useSearch()
	const { tokenValid, tokenError } = Route.useRouteContext() as {
		tokenValid: boolean
		tokenError?: string
	}
	const [error, setError] = useState<string | null>(null)
	const [isLoading, setIsLoading] = useState(false)
	const [isSuccess, setIsSuccess] = useState(false)

	const form = useForm<ResetPasswordSchema>({
		resolver: zodResolver(resetPasswordSchema),
		defaultValues: {
			token: token || "",
			password: "",
			confirmPassword: "",
		},
	})

	const onSubmit = async (data: ResetPasswordSchema) => {
		try {
			setIsLoading(true)
			setError(null)

			await resetPasswordServerFn({ data })

			setIsSuccess(true)
		} catch (err) {
			const errorMessage =
				err instanceof Error ? err.message : "Failed to reset password"
			setError(errorMessage)
			console.error("Reset password error:", err)
		} finally {
			setIsLoading(false)
		}
	}

	// Show error for invalid/missing token
	if (!tokenValid) {
		return (
			<div className="min-h-[90vh] flex flex-col items-center px-4 justify-center bg-background my-6 md:my-10">
				<div className="w-full max-w-md space-y-8 p-8 bg-background border-4 border-black dark:border-primary shadow-[8px_8px_0px_0px] dark:shadow-primary">
					<div className="text-center">
						<h2 className="mt-2 text-3xl md:text-4xl font-mono font-bold tracking-tight dark:text-primary uppercase">
							INVALID LINK
						</h2>
						<p className="mt-4 text-black dark:text-primary font-mono">
							{tokenError ||
								"This password reset link is invalid or has expired."}
						</p>
					</div>
					<Button
						className="w-full"
						onClick={() => router.navigate({ to: "/forgot-password" })}
					>
						REQUEST NEW LINK
					</Button>
					<div className="text-center">
						<Link
							to="/sign-in"
							search={{ redirect: REDIRECT_AFTER_SIGN_IN }}
							className="font-bold dark:text-primary underline hover:no-underline font-mono"
						>
							BACK TO SIGN IN
						</Link>
					</div>
				</div>
			</div>
		)
	}

	// Show success message after password reset
	if (isSuccess) {
		return (
			<div className="min-h-[90vh] flex flex-col items-center px-4 justify-center bg-background my-6 md:my-10">
				<div className="w-full max-w-md space-y-8 p-8 bg-background border-4 border-black dark:border-primary shadow-[8px_8px_0px_0px] dark:shadow-primary">
					<div className="text-center">
						<h2 className="mt-2 text-3xl md:text-4xl font-mono font-bold tracking-tight dark:text-primary uppercase">
							PASSWORD RESET
						</h2>
						<p className="mt-4 text-black dark:text-primary font-mono">
							Your password has been reset successfully. You can now sign in
							with your new password.
						</p>
					</div>
					<Button
						className="w-full"
						onClick={() =>
							router.navigate({
								to: "/sign-in",
								search: { redirect: REDIRECT_AFTER_SIGN_IN },
							})
						}
					>
						GO TO SIGN IN
					</Button>
				</div>
			</div>
		)
	}

	return (
		<div className="min-h-[90vh] flex flex-col items-center px-4 justify-center bg-background my-6 md:my-10">
			<div className="w-full max-w-md space-y-8 p-8 bg-background border-4 border-black dark:border-primary shadow-[8px_8px_0px_0px] dark:shadow-primary">
				<div className="text-center">
					<h2 className="mt-2 text-3xl md:text-4xl font-mono font-bold tracking-tight dark:text-primary uppercase">
						RESET PASSWORD
					</h2>
					<p className="mt-4 text-black dark:text-primary font-mono">
						Enter your new password below.
					</p>
				</div>

				{error && (
					<div className="p-4 bg-red-500/10 border-2 border-red-500 text-red-500 font-mono text-sm">
						{error}
					</div>
				)}

				<Form {...form}>
					<form
						onSubmit={form.handleSubmit(onSubmit)}
						className="mt-8 space-y-6"
					>
						<FormField
							control={form.control}
							name="password"
							render={({ field }) => (
								<FormItem>
									<FormLabel className="font-mono dark:text-primary">
										NEW PASSWORD
									</FormLabel>
									<FormControl>
										<Input
											type="password"
											placeholder="Enter new password"
											disabled={isLoading}
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="confirmPassword"
							render={({ field }) => (
								<FormItem>
									<FormLabel className="font-mono dark:text-primary">
										CONFIRM PASSWORD
									</FormLabel>
									<FormControl>
										<Input
											type="password"
											placeholder="Confirm new password"
											disabled={isLoading}
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<Button type="submit" className="w-full" disabled={isLoading}>
							{isLoading ? "RESETTING..." : "RESET PASSWORD"}
						</Button>
					</form>
				</Form>

				<div className="text-center">
					<Link
						to="/sign-in"
						search={{ redirect: REDIRECT_AFTER_SIGN_IN }}
						className="font-bold dark:text-primary underline hover:no-underline font-mono text-sm"
					>
						BACK TO SIGN IN
					</Link>
				</div>
			</div>
		</div>
	)
}
