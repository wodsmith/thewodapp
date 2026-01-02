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
import { Captcha } from "@/components/captcha"
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
import { Alert, AlertDescription } from "@/components/ui/alert"
import { REDIRECT_AFTER_SIGN_IN } from "@/constants"
import { useIdentifyUser, useTrackEvent } from "@/lib/posthog/hooks"
import {
	getSessionFn,
	type SignUpInput,
	signUpFn,
	signUpSchema,
} from "@/server-fns/auth-fns"

export const Route = createFileRoute("/_auth/sign-up")({
	component: SignUpPage,
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

function SignUpPage() {
	const router = useRouter()
	const { redirect: redirectPath } = Route.useSearch()
	const [error, setError] = useState<string | null>(null)
	const [isLoading, setIsLoading] = useState(false)

	// PostHog tracking hooks
	const trackEvent = useTrackEvent()
	const identifyUser = useIdentifyUser()

	// Use useServerFn for client-side calls
	const signUp = useServerFn(signUpFn)

	const form = useForm<SignUpInput>({
		resolver: standardSchemaResolver(signUpSchema),
		defaultValues: {
			email: "",
			firstName: "",
			lastName: "",
			password: "",
		},
	})

	const onSubmit = async (data: SignUpInput) => {
		try {
			setIsLoading(true)
			setError(null)

			const result = await signUp({ data })

			// Identify user and track successful sign-up
			identifyUser(result.userId, {
				email: data.email,
				first_name: data.firstName,
				last_name: data.lastName,
			})
			trackEvent("user_signed_up", { auth_method: "email_password" })

			// Redirect to the intended destination
			router.navigate({ to: redirectPath })
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : "Sign-up failed"
			setError(errorMessage)
			console.error("Sign-up error:", err)

			// Track failed sign-up attempt
			trackEvent("user_signed_up_failed", { error_message: errorMessage })
		} finally {
			setIsLoading(false)
		}
	}

	return (
		<div className="min-h-[90vh] flex items-center px-4 justify-center bg-background my-6 md:my-10">
			<Card className="w-full max-w-md">
				<CardHeader className="text-center">
					<CardTitle className="text-2xl">Create Account</CardTitle>
					<CardDescription>
						Already have an account?{" "}
						<Link
							to="/sign-in"
							search={{ redirect: redirectPath }}
							className="text-primary underline-offset-4 hover:underline"
						>
							Sign in
						</Link>
					</CardDescription>
				</CardHeader>

				<CardContent>
					{/* TODO: Add Passkey registration when WebAuthn is implemented */}

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
												type="email"
												placeholder="you@example.com"
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
										<FormLabel>First Name</FormLabel>
										<FormControl>
											<Input
												placeholder="John"
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
										<FormLabel>Last Name</FormLabel>
										<FormControl>
											<Input
												placeholder="Doe"
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

							<div className="flex flex-col justify-center items-center space-y-4 pt-2">
								<Captcha
									onSuccess={(token: string) =>
										form.setValue("captchaToken", token)
									}
									validationError={form.formState.errors.captchaToken?.message}
								/>

								<Button type="submit" className="w-full" disabled={isLoading}>
									{isLoading ? "Creating account..." : "Create Account"}
								</Button>
							</div>
						</form>
					</Form>
				</CardContent>

				<CardFooter>
					<p className="text-xs text-center text-muted-foreground w-full">
						By signing up, you agree to our{" "}
						{/* TODO: Add terms and privacy routes */}
						<a
							href="/terms"
							className="text-primary underline-offset-4 hover:underline"
						>
							Terms of Service
						</a>{" "}
						and{" "}
						<a
							href="/privacy"
							className="text-primary underline-offset-4 hover:underline"
						>
							Privacy Policy
						</a>
					</p>
				</CardFooter>
			</Card>
		</div>
	)
}
