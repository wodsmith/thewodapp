import { zodResolver } from "@hookform/resolvers/zod"
import {
	createFileRoute,
	Link,
	redirect,
	useRouter,
} from "@tanstack/react-router"
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
	FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { REDIRECT_AFTER_SIGN_IN } from "@/constants"
import { getDb } from "@/db"
import { teamMembershipTable, teamTable, userTable } from "@/db/schema"
import { canSignUp, createAndStoreSession } from "@/utils/auth"
import { hashPassword } from "@/utils/password-hasher"

// Define schema here to avoid import issues with zod versions
const signUpSchema = z.object({
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

type SignUpSchema = z.infer<typeof signUpSchema>

// Server function for sign-up
// With Zod 4, we use inputValidator with a custom function instead of zodValidator adapter
const signUpServerFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => signUpSchema.parse(data))
	.handler(async ({ data }) => {
		const db = getDb()

		// Check if email is disposable
		await canSignUp({ email: data.email })

		// Check if email is already taken
		const existingUser = await db.query.userTable.findFirst({
			where: eq(userTable.email, data.email),
		})

		if (existingUser) {
			throw new Error("Email already taken")
		}

		// Hash the password
		const hashedPassword = await hashPassword({ password: data.password })

		// Create the user with auto-verified email
		const [user] = await db
			.insert(userTable)
			.values({
				email: data.email,
				firstName: data.firstName,
				lastName: data.lastName,
				passwordHash: hashedPassword,
				emailVerified: new Date(), // Auto-verify email on signup
			})
			.returning()

		if (!user || !user.email) {
			throw new Error("Failed to create user")
		}

		// Create a personal team for the user (inline logic)
		const personalTeamName = `${user.firstName || "Personal"}'s Team (personal)`
		const personalTeamSlug = `${
			user.firstName?.toLowerCase() || "personal"
		}-${user.id.slice(-6)}`

		const personalTeamResult = await db
			.insert(teamTable)
			.values({
				name: personalTeamName,
				slug: personalTeamSlug,
				description:
					"Personal team for individual programming track subscriptions",
				isPersonalTeam: 1,
				personalTeamOwnerId: user.id,
			})
			.returning()
		const personalTeam = personalTeamResult[0]

		if (!personalTeam) {
			throw new Error("Failed to create personal team")
		}

		// Add the user as a member of their personal team
		await db.insert(teamMembershipTable).values({
			teamId: personalTeam.id,
			userId: user.id,
			roleId: "owner", // System role for team owner
			isSystemRole: 1,
			joinedAt: new Date(),
			isActive: 1,
		})

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

export const Route = createFileRoute("/_auth/sign-up")({
	component: SignUpPage,
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

function SignUpPage() {
	const router = useRouter()
	const { redirect: redirectPath } = Route.useSearch()
	const [error, setError] = useState<string | null>(null)
	const [isLoading, setIsLoading] = useState(false)

	const form = useForm<SignUpSchema>({
		resolver: zodResolver(signUpSchema),
		defaultValues: {
			email: "",
			firstName: "",
			lastName: "",
			password: "",
		},
	})

	const onSubmit = async (data: SignUpSchema) => {
		try {
			setIsLoading(true)
			setError(null)

			await signUpServerFn({ data })

			// TODO: Add analytics tracking (PostHog)
			// posthog.identify(userId, { email: data.email, first_name: data.firstName, last_name: data.lastName })
			// posthog.capture('user_signed_up', { auth_method: 'email_password' })

			// Redirect to the intended destination
			router.navigate({ to: redirectPath })
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : "Sign-up failed"
			setError(errorMessage)
			console.error("Sign-up error:", err)

			// TODO: Add error analytics tracking
			// posthog.capture('user_signed_up_failed', { error_message: errorMessage })
		} finally {
			setIsLoading(false)
		}
	}

	return (
		<div className="min-h-[90vh] flex items-center px-4 justify-center bg-background my-6 md:my-10">
			<div className="w-full max-w-md space-y-8 p-8 bg-background border-4 border-primary shadow-[8px_8px_0px_0px] shadow-primary">
				<div className="text-center">
					<h2 className="mt-6 text-3xl md:text-4xl font-mono font-bold tracking-tight text-primary uppercase">
						CREATE ACCOUNT
					</h2>
					<p className="mt-4 text-primary font-mono">
						ALREADY HAVE AN ACCOUNT?{" "}
						<Link
							to="/sign-in"
							search={{ redirect: redirectPath }}
							className="font-bold text-orange underline hover:no-underline"
						>
							SIGN IN
						</Link>
					</p>
				</div>

				{/* TODO: Add Passkey registration when WebAuthn is implemented */}

				{error && (
					<div className="p-4 bg-red-500/10 border-2 border-red-500 text-red-500 font-mono text-sm">
						{error}
					</div>
				)}

				<Form {...form}>
					<form
						onSubmit={form.handleSubmit(onSubmit)}
						className="mt-8 space-y-4"
					>
						<FormField
							control={form.control}
							name="email"
							render={({ field }) => (
								<FormItem>
									<FormControl>
										<Input
											type="email"
											placeholder="EMAIL ADDRESS"
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
							name="firstName"
							render={({ field }) => (
								<FormItem>
									<FormControl>
										<Input
											placeholder="FIRST NAME"
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
							name="lastName"
							render={({ field }) => (
								<FormItem>
									<FormControl>
										<Input
											placeholder="LAST NAME"
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

						{/* TODO: Add Captcha component when Turnstile is implemented */}

						<Button type="submit" className="w-full" disabled={isLoading}>
							{isLoading ? "CREATING ACCOUNT..." : "CREATE ACCOUNT"}
						</Button>
					</form>
				</Form>

				<div className="mt-8">
					<p className="text-xs text-center text-primary font-mono">
						BY SIGNING UP, YOU AGREE TO OUR{" "}
						{/* TODO: Add terms and privacy routes */}
						<a
							href="/terms"
							className="font-bold text-orange underline hover:no-underline"
						>
							TERMS OF SERVICE
						</a>{" "}
						AND{" "}
						<a
							href="/privacy"
							className="font-bold text-orange underline hover:no-underline"
						>
							PRIVACY POLICY
						</a>
					</p>
				</div>
			</div>
		</div>
	)
}
