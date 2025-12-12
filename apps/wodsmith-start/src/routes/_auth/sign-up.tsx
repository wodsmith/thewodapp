import { createFileRoute, useSearch } from "@tanstack/react-router"
import { useState, useTransition } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { startRegistration } from "@simplewebauthn/browser"
import { KeyIcon } from "lucide-react"
import posthog from "posthog-js"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { Button } from "~/components/ui/button"
import { Captcha } from "~/components/captcha"
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog"
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormMessage,
} from "~/components/ui/form"
import { Input } from "~/components/ui/input"
import { Spinner } from "~/components/ui/spinner"
import SeparatorWithText from "~/components/separator-with-text"
import SSOButtons from "~/components/auth/sso-buttons"
import { signUpSchema, type SignUpSchema } from "~/schemas/signup.schema"
import {
	passkeyEmailSchema,
	type PasskeyEmailSchema,
} from "~/schemas/passkey.schema"
import { signUpAction } from "~/server-functions/auth"
import {
	startPasskeyRegistrationAction,
	completePasskeyRegistrationAction,
} from "~/server-functions/passkey"
import { useConfigStore } from "~/state/config"
import { REDIRECT_AFTER_SIGN_IN } from "~/constants"
import Link from "~/components/link"

export const Route = createFileRoute("/_auth/sign-up")({
	validateSearch: (search: Record<string, unknown>) => ({
		redirect: (search.redirect as string) ?? REDIRECT_AFTER_SIGN_IN,
	}),
	component: SignUpPage,
})

interface SignUpSearch {
	redirect?: string
}

function SignUpPage() {
	const { redirect: redirectPath } = useSearch({ from: "/_auth/sign-up" })
	const { isTurnstileEnabled } = useConfigStore()
	const [isPasskeyModalOpen, setIsPasskeyModalOpen] = useState(false)
	const [isRegistering, setIsRegistering] = useState(false)
	const [isPending, startTransition] = useTransition()

	const form = useForm<SignUpSchema>({
		resolver: zodResolver(signUpSchema),
	})

	const passkeyForm = useForm<PasskeyEmailSchema>({
		resolver: zodResolver(passkeyEmailSchema),
	})

	const captchaToken = useWatch({
		control: form.control,
		name: "captchaToken",
	})
	const passkeyCaptchaToken = useWatch({
		control: passkeyForm.control,
		name: "captchaToken",
	})

	const onSubmit = (data: SignUpSchema) => {
		toast.loading("Creating your account...")
		startTransition(async () => {
			try {
				const result = await signUpAction(data)
				toast.dismiss()
				toast.success("Account created successfully")
				const userId = result?.userId
				if (userId) {
					posthog.identify(userId, {
						email: form.getValues("email"),
						first_name: form.getValues("firstName"),
						last_name: form.getValues("lastName"),
					})
				}
				posthog.capture("user_signed_up", {
					auth_method: "email_password",
					user_id: userId,
				})
				window.location.href = redirectPath || REDIRECT_AFTER_SIGN_IN
			} catch (error) {
				toast.dismiss()
				const message =
					error instanceof Error ? error.message : "Failed to create account"
				toast.error(message)
				posthog.capture("user_signed_up_failed", {
					error_message: message,
					auth_method: "email_password",
				})
			}
		})
	}

	const onPasskeySubmit = (data: PasskeyEmailSchema) => {
		toast.loading("Starting passkey registration...")
		setIsRegistering(true)
		startTransition(async () => {
			try {
				const response = await startPasskeyRegistrationAction(data)

				if (!response?.optionsJSON) {
					toast.dismiss()
					toast.error("Failed to start passkey registration")
					setIsRegistering(false)
					return
				}

				try {
					const attResp = await startRegistration({
						optionsJSON: response.optionsJSON,
						useAutoRegister: true,
					})
					toast.dismiss()
					toast.loading("Completing passkey registration...")
					const result = await completePasskeyRegistrationAction({
						response: attResp,
					})
					toast.dismiss()
					toast.success("Account created successfully")
					const userId = result?.userId
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
					})
					window.location.href = redirectPath || REDIRECT_AFTER_SIGN_IN
				} catch (error: unknown) {
					console.error("Failed to register passkey:", error)
					toast.dismiss()
					toast.error("Failed to register passkey")
					setIsRegistering(false)
				}
			} catch (error) {
				toast.dismiss()
				const message =
					error instanceof Error
						? error.message
						: "Failed to start passkey registration"
				toast.error(message)
				setIsRegistering(false)
				posthog.capture("user_signed_up_failed", {
					error_message: message,
					auth_method: "passkey",
				})
			}
		})
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

				<div className="space-y-4">
					<SSOButtons />

					<Button onClick={() => setIsPasskeyModalOpen(true)}>
						<KeyIcon className="w-5 h-5 mr-2" />
						SIGN UP WITH PASSKEY
					</Button>
				</div>

				<SeparatorWithText>
					<span className="uppercase text-primary font-mono font-bold text-sm">
						OR
					</span>
				</SeparatorWithText>

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
											disabled={isPending}
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
											disabled={isPending}
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
											disabled={isPending}
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
											disabled={isPending}
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<div className="flex flex-col justify-center items-center">
							<Captcha
								onSuccess={(token: string) =>
									form.setValue("captchaToken", token)
								}
								validationError={form.formState.errors.captchaToken?.message}
							/>

							<Button
								type="submit"
								disabled={
									isPending || Boolean(isTurnstileEnabled && !captchaToken)
								}
							>
								CREATE ACCOUNT
							</Button>
						</div>
					</form>
				</Form>

				<div className="mt-8">
					<p className="text-xs text-center text-primary font-mono">
						BY SIGNING UP, YOU AGREE TO OUR{" "}
						<Link
							to="/terms"
							className="font-bold text-orange underline hover:no-underline"
						>
							TERMS OF SERVICE
						</Link>{" "}
						AND{" "}
						<Link
							to="/privacy"
							className="font-bold text-orange underline hover:no-underline"
						>
							PRIVACY POLICY
						</Link>
					</p>
				</div>
			</div>

			<Dialog open={isPasskeyModalOpen} onOpenChange={setIsPasskeyModalOpen}>
				<DialogContent className="bg-background border-4 border-primary shadow-[8px_8px_0px_0px] shadow-primary p-8">
					<DialogHeader>
						<DialogTitle className="font-mono text-2xl text-primary uppercase font-bold">
							SIGN UP WITH PASSKEY
						</DialogTitle>
					</DialogHeader>
					<Form {...passkeyForm}>
						<form
							onSubmit={passkeyForm.handleSubmit(onPasskeySubmit)}
							className="space-y-6 mt-6"
						>
							<FormField
								control={passkeyForm.control}
								name="email"
								render={({ field }) => (
									<FormItem>
										<FormControl>
											<Input
												type="email"
												placeholder="EMAIL ADDRESS"
												disabled={isRegistering || isPending}
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={passkeyForm.control}
								name="firstName"
								render={({ field }) => (
									<FormItem>
										<FormControl>
											<Input
												placeholder="FIRST NAME"
												disabled={isRegistering || isPending}
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
												placeholder="LAST NAME"
												disabled={isRegistering || isPending}
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<div className="flex flex-col justify-center items-center">
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
									disabled={
										isRegistering ||
										isPending ||
										Boolean(isTurnstileEnabled && !passkeyCaptchaToken)
									}
								>
									{isRegistering || isPending ? (
										<>
											<Spinner className="mr-2 h-4 w-4" />
											REGISTERING...
										</>
									) : (
										"CONTINUE"
									)}
								</Button>
							</div>
							{!isRegistering && (
								<p className="text-xs text-primary font-mono text-center mt-4">
									AFTER CLICKING CONTINUE, YOUR BROWSER WILL PROMPT YOU TO
									CREATE AND SAVE YOUR PASSKEY. THIS WILL ALLOW YOU TO SIGN IN
									SECURELY WITHOUT A PASSWORD IN THE FUTURE.
								</p>
							)}
						</form>
					</Form>
				</DialogContent>
			</Dialog>
		</div>
	)
}
