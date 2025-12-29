"use client"

import { PlusIcon } from "@heroicons/react/24/outline"
import { zodResolver } from "@hookform/resolvers/zod"
import { useServerAction } from "@repo/zsa-react"
import { startAuthentication, startRegistration } from "@simplewebauthn/browser"
import { KeyIcon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import posthog from "posthog-js"
import { useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { submitOrganizerRequestAction } from "@/actions/organizer-onboarding-actions"
import { createTeamAction } from "@/actions/team-actions"
import SSOButtons from "@/app/(auth)/_components/sso-buttons"
import { signInAction } from "@/app/(auth)/sign-in/sign-in.actions"
import {
	completePasskeyRegistrationAction,
	startPasskeyRegistrationAction,
} from "@/app/(auth)/sign-up/passkey-sign-up.actions"
import { signUpAction } from "@/app/(auth)/sign-up/sign-up.actions"
import {
	generateAuthenticationOptionsAction,
	verifyAuthenticationAction,
} from "@/app/(settings)/settings/security/passkey-settings.actions"
import { Captcha } from "@/components/captcha"
import SeparatorWithText from "@/components/separator-with-text"
import { Button } from "@/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import type { Team } from "@/db/schema"
import { catchaSchema } from "@/schemas/catcha.schema"
import {
	type PasskeyEmailSchema,
	passkeyEmailSchema,
} from "@/schemas/passkey.schema"
import { type SignInSchema, signInSchema } from "@/schemas/signin.schema"
import { type SignUpSchema, signUpSchema } from "@/schemas/signup.schema"
import { useConfigStore } from "@/state/config"

const CALLBACK_URL = "/compete/organizer/onboard"

const CREATE_NEW_TEAM = "__create_new__"

const formSchema = z.object({
	teamId: z.string().min(1, "Please select a team"),
	newTeamName: z.string().optional(),
	reason: z
		.string()
		.min(10, "Please provide more detail about why you want to organize")
		.max(2000, "Reason is too long"),
	captchaToken: catchaSchema,
})

type FormValues = z.infer<typeof formSchema>

interface OnboardFormProps {
	teams: Pick<Team, "id" | "name" | "type" | "isPersonalTeam">[]
	isAuthenticated: boolean
}

/**
 * Inline auth UI for unauthenticated users on the organizer onboard page.
 * Shows sign-in/sign-up tabs with all auth methods (SSO, passkey, email/password).
 * After auth, users are redirected back to this page to complete the organizer application.
 */
function AuthSection() {
	const { isTurnstileEnabled } = useConfigStore()
	const [isPasskeyModalOpen, setIsPasskeyModalOpen] = useState(false)
	const [isRegistering, setIsRegistering] = useState(false)
	const [isAuthenticating, setIsAuthenticating] = useState(false)

	// Sign In form
	const signInForm = useForm<SignInSchema>({
		resolver: zodResolver(signInSchema),
	})

	// Sign Up form
	const signUpForm = useForm<SignUpSchema>({
		resolver: zodResolver(signUpSchema),
	})

	// Passkey form for sign up
	const passkeyForm = useForm<PasskeyEmailSchema>({
		resolver: zodResolver(passkeyEmailSchema),
	})

	const signUpCaptchaToken = useWatch({
		control: signUpForm.control,
		name: "captchaToken",
	})

	const passkeyCaptchaToken = useWatch({
		control: passkeyForm.control,
		name: "captchaToken",
	})

	// Sign In action
	const { execute: signIn } = useServerAction(signInAction, {
		onError: (error) => {
			toast.dismiss()
			toast.error(error.err?.message || "Sign in failed")
			posthog.capture("user_signed_in_failed", {
				error_message: error.err?.message,
				auth_method: "email_password",
				source: "organizer_onboard",
			})
		},
		onStart: () => {
			toast.loading("Signing you in...")
		},
		onSuccess: (result) => {
			toast.dismiss()
			toast.success("Signed in successfully")
			const userId = result?.data?.userId
			if (userId) {
				posthog.identify(userId, {
					email: signInForm.getValues("email"),
				})
			}
			posthog.capture("user_signed_in", {
				auth_method: "email_password",
				user_id: userId,
				source: "organizer_onboard",
			})
			window.location.href = CALLBACK_URL
		},
	})

	// Sign Up action
	const { execute: signUp } = useServerAction(signUpAction, {
		onError: (error) => {
			toast.dismiss()
			toast.error(error.err?.message || "Sign up failed")
			posthog.capture("user_signed_up_failed", {
				error_message: error.err?.message,
				auth_method: "email_password",
				source: "organizer_onboard",
			})
		},
		onStart: () => {
			toast.loading("Creating your account...")
		},
		onSuccess: (result) => {
			toast.dismiss()
			toast.success("Account created successfully")
			const userId = result?.data?.userId
			if (userId) {
				posthog.identify(userId, {
					email: signUpForm.getValues("email"),
					first_name: signUpForm.getValues("firstName"),
					last_name: signUpForm.getValues("lastName"),
				})
			}
			posthog.capture("user_signed_up", {
				auth_method: "email_password",
				user_id: userId,
				source: "organizer_onboard",
			})
			window.location.href = CALLBACK_URL
		},
	})

	// Passkey authentication (sign in)
	const { execute: generateOptions } = useServerAction(
		generateAuthenticationOptionsAction,
		{
			onError: (error) => {
				toast.dismiss()
				toast.error(
					error.err?.message || "Failed to get authentication options",
				)
			},
		},
	)

	const { execute: verifyAuthentication } = useServerAction(
		verifyAuthenticationAction,
		{
			onError: (error) => {
				toast.dismiss()
				toast.error(error.err?.message || "Authentication failed")
				posthog.capture("user_signed_in_failed", {
					error_message: error.err?.message,
					auth_method: "passkey",
					source: "organizer_onboard",
				})
			},
			onSuccess: (result) => {
				toast.dismiss()
				toast.success("Authentication successful")
				if (result?.data?.userId) {
					posthog.identify(result.data.userId)
				}
				posthog.capture("user_signed_in", {
					auth_method: "passkey",
					user_id: result?.data?.userId,
					source: "organizer_onboard",
				})
				window.location.href = CALLBACK_URL
			},
		},
	)

	// Passkey registration (sign up)
	const { execute: completePasskeyRegistration } = useServerAction(
		completePasskeyRegistrationAction,
		{
			onError: (error) => {
				toast.dismiss()
				toast.error(error.err?.message || "Registration failed")
				setIsRegistering(false)
				posthog.capture("user_signed_up_failed", {
					error_message: error.err?.message,
					auth_method: "passkey",
					source: "organizer_onboard",
				})
			},
			onSuccess: (result) => {
				toast.dismiss()
				toast.success("Account created successfully")
				const userId = result?.data?.userId
				if (userId) {
					posthog.identify(userId, {
						email: passkeyForm.getValues("email"),
						first_name: passkeyForm.getValues("firstName"),
						last_name: passkeyForm.getValues("lastName"),
					})
				}
				posthog.capture("user_signed_up", {
					auth_method: "passkey",
					user_id: userId,
					source: "organizer_onboard",
				})
				window.location.href = CALLBACK_URL
			},
		},
	)

	const { execute: startPasskeyRegistration } = useServerAction(
		startPasskeyRegistrationAction,
		{
			onError: (error) => {
				toast.dismiss()
				toast.error(
					error.err?.message || "Failed to start passkey registration",
				)
				setIsRegistering(false)
			},
			onStart: () => {
				toast.loading("Starting passkey registration...")
				setIsRegistering(true)
			},
			onSuccess: async (response) => {
				toast.dismiss()
				if (!response?.data?.optionsJSON) {
					toast.error("Failed to start passkey registration")
					setIsRegistering(false)
					return
				}

				try {
					const attResp = await startRegistration({
						optionsJSON: response.data.optionsJSON,
						useAutoRegister: true,
					})
					await completePasskeyRegistration({ response: attResp })
				} catch (error: unknown) {
					console.error("Failed to register passkey:", error)
					toast.error("Failed to register passkey")
					setIsRegistering(false)
				}
			},
		},
	)

	const handlePasskeyAuthenticate = async () => {
		try {
			setIsAuthenticating(true)
			toast.loading("Authenticating with passkey...")

			const [options] = await generateOptions({})
			if (!options) {
				throw new Error("Failed to get authentication options")
			}

			const authenticationResponse = await startAuthentication({
				optionsJSON: options,
			})

			await verifyAuthentication({
				response: authenticationResponse,
				challenge: options.challenge,
			})
		} catch (error) {
			console.error("Passkey authentication error:", error)
			toast.dismiss()
			toast.error("Authentication failed")
		} finally {
			setIsAuthenticating(false)
		}
	}

	const onSignInSubmit = async (data: SignInSchema) => {
		signIn(data)
	}

	const onSignUpSubmit = async (data: SignUpSchema) => {
		signUp(data)
	}

	const onPasskeySubmit = async (data: PasskeyEmailSchema) => {
		startPasskeyRegistration(data)
	}

	return (
		<div className="space-y-6">
			<div className="text-center">
				<p className="text-sm text-muted-foreground">
					Sign in or create an account to apply
				</p>
			</div>

			<Tabs defaultValue="sign-in" className="w-full">
				<TabsList className="grid w-full grid-cols-2">
					<TabsTrigger value="sign-in">Sign In</TabsTrigger>
					<TabsTrigger value="sign-up">Create Account</TabsTrigger>
				</TabsList>

				{/* Sign In Tab */}
				<TabsContent value="sign-in" className="space-y-4 mt-4">
					<SSOButtons isSignIn />

					<Button
						onClick={handlePasskeyAuthenticate}
						disabled={isAuthenticating}
						className="w-full"
						variant="outline"
					>
						{isAuthenticating ? (
							<>
								<Spinner className="mr-2 h-4 w-4" />
								Authenticating...
							</>
						) : (
							<>
								<KeyIcon className="w-4 h-4 mr-2" />
								Sign in with Passkey
							</>
						)}
					</Button>

					<SeparatorWithText>
						<span className="text-xs text-muted-foreground uppercase">or</span>
					</SeparatorWithText>

					<Form {...signInForm}>
						<form
							onSubmit={signInForm.handleSubmit(onSignInSubmit)}
							className="space-y-4"
						>
							<FormField
								control={signInForm.control}
								name="email"
								render={({ field }) => (
									<FormItem>
										<FormControl>
											<Input
												placeholder="Email address"
												type="email"
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={signInForm.control}
								name="password"
								render={({ field }) => (
									<FormItem>
										<FormControl>
											<Input
												type="password"
												placeholder="Password"
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<Button type="submit" className="w-full">
								Sign In
							</Button>
						</form>
					</Form>

					<p className="text-center text-sm text-muted-foreground">
						<Link
							href="/forgot-password"
							className="underline hover:no-underline"
						>
							Forgot password?
						</Link>
					</p>
				</TabsContent>

				{/* Sign Up Tab */}
				<TabsContent value="sign-up" className="space-y-4 mt-4">
					<SSOButtons />

					<Button
						onClick={() => setIsPasskeyModalOpen(true)}
						className="w-full"
						variant="outline"
					>
						<KeyIcon className="w-4 h-4 mr-2" />
						Sign up with Passkey
					</Button>

					<SeparatorWithText>
						<span className="text-xs text-muted-foreground uppercase">or</span>
					</SeparatorWithText>

					<Form {...signUpForm}>
						<form
							onSubmit={signUpForm.handleSubmit(onSignUpSubmit)}
							className="space-y-4"
						>
							<FormField
								control={signUpForm.control}
								name="email"
								render={({ field }) => (
									<FormItem>
										<FormControl>
											<Input
												type="email"
												placeholder="Email address"
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<div className="grid grid-cols-2 gap-4">
								<FormField
									control={signUpForm.control}
									name="firstName"
									render={({ field }) => (
										<FormItem>
											<FormControl>
												<Input placeholder="First name" {...field} />
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>

								<FormField
									control={signUpForm.control}
									name="lastName"
									render={({ field }) => (
										<FormItem>
											<FormControl>
												<Input placeholder="Last name" {...field} />
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
							</div>

							<FormField
								control={signUpForm.control}
								name="password"
								render={({ field }) => (
									<FormItem>
										<FormControl>
											<Input
												type="password"
												placeholder="Password"
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<div className="flex flex-col items-center gap-4">
								<Captcha
									onSuccess={(token: string) =>
										signUpForm.setValue("captchaToken", token)
									}
									validationError={
										signUpForm.formState.errors.captchaToken?.message
									}
								/>

								<Button
									type="submit"
									className="w-full"
									disabled={Boolean(isTurnstileEnabled && !signUpCaptchaToken)}
								>
									Create Account
								</Button>
							</div>
						</form>
					</Form>

					<p className="text-xs text-center text-muted-foreground">
						By signing up, you agree to our{" "}
						<Link href="/terms" className="underline hover:no-underline">
							Terms of Service
						</Link>{" "}
						and{" "}
						<Link href="/privacy" className="underline hover:no-underline">
							Privacy Policy
						</Link>
					</p>
				</TabsContent>
			</Tabs>

			{/* Passkey Sign Up Modal */}
			<Dialog open={isPasskeyModalOpen} onOpenChange={setIsPasskeyModalOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Sign up with Passkey</DialogTitle>
					</DialogHeader>
					<Form {...passkeyForm}>
						<form
							onSubmit={passkeyForm.handleSubmit(onPasskeySubmit)}
							className="space-y-4 mt-4"
						>
							<FormField
								control={passkeyForm.control}
								name="email"
								render={({ field }) => (
									<FormItem>
										<FormControl>
											<Input
												type="email"
												placeholder="Email address"
												disabled={isRegistering}
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<div className="grid grid-cols-2 gap-4">
								<FormField
									control={passkeyForm.control}
									name="firstName"
									render={({ field }) => (
										<FormItem>
											<FormControl>
												<Input
													placeholder="First name"
													disabled={isRegistering}
													{...field}
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>

								<FormField
									control={passkeyForm.control}
									name="lastName"
									render={({ field }) => (
										<FormItem>
											<FormControl>
												<Input
													placeholder="Last name"
													disabled={isRegistering}
													{...field}
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
							</div>

							<div className="flex flex-col items-center gap-4">
								<Captcha
									onSuccess={(token: string) =>
										passkeyForm.setValue("captchaToken", token)
									}
									validationError={
										passkeyForm.formState.errors.captchaToken?.message
									}
								/>

								<Button
									type="submit"
									className="w-full"
									disabled={
										isRegistering ||
										Boolean(isTurnstileEnabled && !passkeyCaptchaToken)
									}
								>
									{isRegistering ? (
										<>
											<Spinner className="mr-2 h-4 w-4" />
											Registering...
										</>
									) : (
										"Continue"
									)}
								</Button>
							</div>

							{!isRegistering && (
								<p className="text-xs text-muted-foreground text-center">
									After clicking Continue, your browser will prompt you to
									create and save your passkey.
								</p>
							)}
						</form>
					</Form>
				</DialogContent>
			</Dialog>
		</div>
	)
}

export function OnboardForm({ teams, isAuthenticated }: OnboardFormProps) {
	// If not authenticated, show auth UI
	if (!isAuthenticated) {
		return <AuthSection />
	}

	// Authenticated - show the organizer request form
	return <OrganizerRequestForm teams={teams} />
}

/**
 * The actual organizer request form for authenticated users.
 * Allows selecting a team and submitting an application to become an organizer.
 */
function OrganizerRequestForm({
	teams,
}: {
	teams: Pick<Team, "id" | "name" | "type" | "isPersonalTeam">[]
}) {
	const router = useRouter()
	const [isCreatingTeam, setIsCreatingTeam] = useState(false)
	const { isTurnstileEnabled } = useConfigStore()

	const form = useForm<FormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			teamId: teams.length === 1 ? teams[0]?.id : "",
			newTeamName: "",
			reason: "",
			captchaToken: "",
		},
	})

	const watchTeamId = form.watch("teamId")
	const captchaToken = useWatch({
		control: form.control,
		name: "captchaToken",
	})
	const showNewTeamFields = watchTeamId === CREATE_NEW_TEAM

	const { execute: submitRequest, isPending: isSubmitting } = useServerAction(
		submitOrganizerRequestAction,
		{
			onSuccess: () => {
				toast.success("Application submitted successfully!")
				router.push("/compete/organizer/onboard/pending")
			},
			onError: (error) => {
				toast.error(error.err?.message || "Failed to submit application")
			},
		},
	)

	const { execute: createTeam, isPending: isCreating } = useServerAction(
		createTeamAction,
		{
			onSuccess: async (result) => {
				if (result.data?.data?.teamId) {
					// Submit the organizer request with the new team
					await submitRequest({
						teamId: result.data.data.teamId,
						reason: form.getValues("reason"),
						captchaToken: form.getValues("captchaToken"),
					})
				}
			},
			onError: (error) => {
				toast.error(error.err?.message || "Failed to create team")
				setIsCreatingTeam(false)
			},
		},
	)

	const onSubmit = async (data: FormValues) => {
		if (data.teamId === CREATE_NEW_TEAM) {
			if (!data.newTeamName?.trim()) {
				form.setError("newTeamName", { message: "Team name is required" })
				return
			}
			setIsCreatingTeam(true)
			await createTeam({ name: data.newTeamName.trim() })
		} else {
			await submitRequest({
				teamId: data.teamId,
				reason: data.reason,
				captchaToken: data.captchaToken,
			})
		}
	}

	const isPending = isSubmitting || isCreating || isCreatingTeam

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
				{/* Team Selection */}
				<FormField
					control={form.control}
					name="teamId"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Organizing Team</FormLabel>
							<Select onValueChange={field.onChange} value={field.value}>
								<FormControl>
									<SelectTrigger>
										<SelectValue placeholder="Select a team" />
									</SelectTrigger>
								</FormControl>
								<SelectContent>
									{teams.map((team) => (
										<SelectItem key={team.id} value={team.id}>
											{team.name}
										</SelectItem>
									))}
									<SelectItem value={CREATE_NEW_TEAM}>
										<span className="flex items-center gap-2">
											<PlusIcon className="h-4 w-4" />
											Create new team
										</span>
									</SelectItem>
								</SelectContent>
							</Select>
							<FormDescription>
								The team that will be listed as the competition organizer
							</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				{/* New Team Name (conditional) */}
				{showNewTeamFields && (
					<FormField
						control={form.control}
						name="newTeamName"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Team Name</FormLabel>
								<FormControl>
									<Input placeholder="e.g., CrossFit Downtown" {...field} />
								</FormControl>
								<FormDescription>
									This will be your organizing team's name
								</FormDescription>
								<FormMessage />
							</FormItem>
						)}
					/>
				)}

				{/* Reason */}
				<FormField
					control={form.control}
					name="reason"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Why do you want to organize competitions?</FormLabel>
							<FormControl>
								<Textarea
									placeholder="Tell us about the competitions you plan to host, your experience organizing events, and what draws you to the WODsmith platform..."
									className="min-h-[120px]"
									{...field}
								/>
							</FormControl>
							<FormDescription>
								This helps us understand your needs and approve your application
								faster
							</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				{/* Captcha */}
				<Captcha
					onSuccess={(token: string) => form.setValue("captchaToken", token)}
					validationError={form.formState.errors.captchaToken?.message}
				/>

				{/* Submit */}
				<div className="flex justify-end gap-4 pt-4">
					<Button
						type="button"
						variant="outline"
						onClick={() => router.back()}
						disabled={isPending}
					>
						Cancel
					</Button>
					<Button
						type="submit"
						disabled={isPending || (isTurnstileEnabled && !captchaToken)}
					>
						{isPending ? "Submitting..." : "Submit Application"}
					</Button>
				</div>
			</form>
		</Form>
	)
}
