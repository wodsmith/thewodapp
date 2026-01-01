import { standardSchemaResolver } from "@hookform/resolvers/standard-schema"
import {
	createFileRoute,
	Link,
	redirect,
	useRouter,
} from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { Captcha } from "@/components/captcha"
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
	const { config } = Route.useRouteContext()
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

	// Watch captcha token for disabling submit button
	const captchaToken = useWatch({
		control: form.control,
		name: "captchaToken",
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

						<div className="flex flex-col justify-center items-center space-y-4">
							<Captcha
								isTurnstileEnabled={config.isTurnstileEnabled}
								onSuccess={(token: string) =>
									form.setValue("captchaToken", token)
								}
								validationError={form.formState.errors.captchaToken?.message}
							/>

							<Button
								type="submit"
								className="w-full"
								disabled={
									isLoading || (config.isTurnstileEnabled && !captchaToken)
								}
							>
								{isLoading ? "CREATING ACCOUNT..." : "CREATE ACCOUNT"}
							</Button>
						</div>
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
