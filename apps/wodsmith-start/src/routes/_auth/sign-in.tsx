import { standardSchemaResolver } from "@hookform/resolvers/standard-schema"
import {
	createFileRoute,
	Link,
	redirect,
	useRouter,
} from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
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
import { useIdentifyUser, useTrackEvent } from "@/lib/posthog/hooks"
import {
	getSessionFn,
	type SignInInput,
	signInFn,
	signInSchema,
} from "@/server-fns/auth-fns"

export const Route = createFileRoute("/_auth/sign-in")({
	component: SignInPage,
	validateSearch: (search: Record<string, unknown>) => {
		return {
			redirect: (search.redirect as string) || REDIRECT_AFTER_SIGN_IN,
		}
	},
	beforeLoad: async ({ search }) => {
		const session = await getSessionFn()
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

	// PostHog tracking hooks
	const trackEvent = useTrackEvent()
	const identifyUser = useIdentifyUser()

	// Use useServerFn for client-side calls
	const signIn = useServerFn(signInFn)

	const form = useForm<SignInInput>({
		resolver: standardSchemaResolver(signInSchema),
		defaultValues: {
			email: "",
			password: "",
		},
	})

	const onSubmit = async (data: SignInInput) => {
		try {
			setIsLoading(true)
			setError(null)

			const result = await signIn({ data })

			// Identify user and track successful sign-in
			identifyUser(result.userId, { email: data.email })
			trackEvent("user_signed_in", { auth_method: "email_password" })

			// Redirect to the intended destination
			router.navigate({ to: redirectPath })
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : "Sign-in failed"
			setError(errorMessage)
			console.error("Sign-in error:", err)

			// Track failed sign-in attempt
			trackEvent("user_signed_in_failed", { error_message: errorMessage })
		} finally {
			setIsLoading(false)
		}
	}

	return (
		<div className="min-h-[90vh] flex flex-col items-center px-4 justify-center bg-background">
			<Card className="w-full max-w-md">
				<CardHeader className="text-center">
					<CardTitle className="text-2xl">Sign In</CardTitle>
					<CardDescription>
						Or{" "}
						<Link
							to="/sign-up"
							search={{ redirect: redirectPath }}
							className="text-primary underline-offset-4 hover:underline"
						>
							create an account
						</Link>
					</CardDescription>
				</CardHeader>

				<CardContent>
					{/* TODO: Add Passkey authentication when WebAuthn is implemented */}

					{error && (
						<Alert variant="destructive" className="mb-6">
							<AlertDescription>{error}</AlertDescription>
						</Alert>
					)}

					<Form {...form}>
						<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
							<FormField
								control={form.control}
								name="email"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Email</FormLabel>
										<FormControl>
											<Input
												placeholder="name@example.com"
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
										<FormLabel>Password</FormLabel>
										<FormControl>
											<Input
												type="password"
												placeholder="Enter your password"
												disabled={isLoading}
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<Button type="submit" className="w-full" disabled={isLoading}>
								{isLoading ? "Signing in..." : "Sign In"}
							</Button>
						</form>
					</Form>
				</CardContent>

				<CardFooter className="flex justify-center">
					<Link
						to="/forgot-password"
						className="text-sm text-muted-foreground hover:text-primary underline-offset-4 hover:underline"
					>
						Forgot password?
					</Link>
				</CardFooter>
			</Card>
		</div>
	)
}
