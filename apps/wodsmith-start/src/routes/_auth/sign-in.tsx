import { standardSchemaResolver } from "@hookform/resolvers/standard-schema"
import {
	createFileRoute,
	Link,
	redirect,
	useRouter,
} from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { REDIRECT_AFTER_SIGN_IN } from "@/constants"

// Define schema here to avoid import issues with zod versions
const signInSchema = z.object({
	email: z.string().email("Please enter a valid email address"),
	password: z.string().min(1, "Password is required"),
})

type SignInSchema = z.infer<typeof signInSchema>

// Server function for sign-in
// With Zod 4, we use inputValidator with a custom function instead of zodValidator adapter
const signInServerFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => signInSchema.parse(data))
	.handler(async ({ data }) => {
		const { getDb } = await import("@/db")
		const { verifyPassword } = await import("@/utils/password-hasher")
		const { createAndStoreSession } = await import("@/utils/auth")
		const { userTable } = await import("@/db/schema")
		const { eq } = await import("drizzle-orm")

		const db = getDb()

		// Find user by email
		const user = await db.query.userTable.findFirst({
			where: eq(userTable.email, data.email),
		})

		if (!user) {
			throw new Error("Invalid email or password")
		}

		// Check if user has only Google SSO
		if (!user.passwordHash && user.googleAccountId) {
			throw new Error("Please sign in with your Google account instead.")
		}

		if (!user.passwordHash) {
			throw new Error("Invalid email or password")
		}

		// Verify password
		const isValid = await verifyPassword({
			storedHash: user.passwordHash,
			passwordAttempt: data.password,
		})

		if (!isValid) {
			throw new Error("Invalid email or password")
		}

		// Create session and set cookie
		await createAndStoreSession(user.id, "password")

		return { success: true, userId: user.id }
	})

// Server function to check existing session
const getSessionServerFn = createServerFn({ method: "GET" }).handler(
	async () => {
		// TODO: Implement getSessionFromCookie for TanStack Start
		// Check if user is already authenticated
		return null
	},
)

export const Route = createFileRoute("/_auth/sign-in")({
	component: SignInPage,
	validateSearch: (search: Record<string, unknown>) => {
		return {
			redirect: (search.redirect as string) || REDIRECT_AFTER_SIGN_IN,
		}
	},
	beforeLoad: async ({ search }) => {
		const session = await getSessionServerFn()
		const redirectPath =
			(search as { redirect?: string }).redirect || REDIRECT_AFTER_SIGN_IN

		if (session) {
			throw redirect({ to: redirectPath })
		}
	},
})

function SignInPage() {
	const router = useRouter()
	const { redirect: redirectPath } = Route.useSearch()
	const [error, setError] = useState<string | null>(null)
	const [isLoading, setIsLoading] = useState(false)

	const form = useForm<SignInSchema>({
		resolver: standardSchemaResolver(signInSchema),
		defaultValues: {
			email: "",
			password: "",
		},
	})

	const onSubmit = async (data: SignInSchema) => {
		try {
			setIsLoading(true)
			setError(null)

			await signInServerFn({ data })

			// TODO: Add analytics tracking (PostHog)
			// posthog.capture('user_signed_in', { auth_method: 'email_password' })

			// Redirect to the intended destination
			router.navigate({ to: redirectPath })
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : "Sign-in failed"
			setError(errorMessage)
			console.error("Sign-in error:", err)

			// TODO: Add error analytics tracking
			// posthog.capture('user_signed_in_failed', { error_message: errorMessage })
		} finally {
			setIsLoading(false)
		}
	}

	return (
		<div className="min-h-[90vh] flex flex-col items-center px-4 justify-center bg-background my-6 md:my-10">
			<div className="w-full max-w-md space-y-8 p-8 bg-background border-4 border-black dark:border-primary shadow-[8px_8px_0px_0px] dark:shadow-primary">
				<div className="text-center">
					<h2 className="mt-2 text-3xl md:text-4xl font-mono font-bold tracking-tight dark:text-primary uppercase">
						SIGN IN
					</h2>
					<p className="mt-4 text-black dark:text-primary font-mono">
						OR{" "}
						<Link
							to="/sign-up"
							search={{ redirect: redirectPath }}
							className="font-bold dark:text-primary underline hover:no-underline"
						>
							CREATE ACCOUNT
						</Link>
					</p>
				</div>

				{/* TODO: Add Passkey authentication when WebAuthn is implemented */}

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
							name="email"
							render={({ field }) => (
								<FormItem>
									<FormControl>
										<Input
											placeholder="EMAIL ADDRESS"
											type="email"
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
							name="password"
							render={({ field }) => (
								<FormItem>
									<FormControl>
										<Input
											type="password"
											placeholder="PASSWORD"
											disabled={isLoading}
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<Button type="submit" className="w-full" disabled={isLoading}>
							{isLoading ? "SIGNING IN..." : "SIGN IN"}
						</Button>
					</form>
				</Form>
			</div>

			<div className="mt-8">
				<p className="text-center text-sm dark:text-primary font-mono">
					<Link
						to="/forgot-password"
						className="font-bold dark:text-primary underline hover:no-underline uppercase"
					>
						FORGOT PASSWORD?
					</Link>
				</p>
			</div>
		</div>
	)
}
