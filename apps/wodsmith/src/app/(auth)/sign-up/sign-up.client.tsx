"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { startRegistration } from "@simplewebauthn/browser"
import { KeyIcon } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { useServerAction } from "zsa-react"
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
	FormField,
	FormItem,
	FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { REDIRECT_AFTER_SIGN_IN } from "@/constants"
import {
	type PasskeyEmailSchema,
	passkeyEmailSchema,
} from "@/schemas/passkey.schema"
import { type SignUpSchema, signUpSchema } from "@/schemas/signup.schema"
import { useConfigStore } from "@/state/config"
import SSOButtons from "../_components/sso-buttons"
import {
	completePasskeyRegistrationAction,
	startPasskeyRegistrationAction,
} from "./passkey-sign-up.actions"
import { signUpAction } from "./sign-up.actions"

interface SignUpClientProps {
	redirectPath: string
}

const SignUpPage = ({ redirectPath }: SignUpClientProps) => {
	const { isTurnstileEnabled } = useConfigStore()
	const [isPasskeyModalOpen, setIsPasskeyModalOpen] = useState(false)
	const [isRegistering, setIsRegistering] = useState(false)

	const { execute: signUp } = useServerAction(signUpAction, {
		onError: (error) => {
			toast.dismiss()
			toast.error(error.err?.message)
		},
		onStart: () => {
			toast.loading("Creating your account...")
		},
		onSuccess: () => {
			toast.dismiss()
			toast.success("Account created successfully")
			window.location.href = redirectPath || REDIRECT_AFTER_SIGN_IN
		},
	})

	const { execute: completePasskeyRegistration } = useServerAction(
		completePasskeyRegistrationAction,
		{
			onError: (error) => {
				toast.dismiss()
				toast.error(error.err?.message)
				setIsRegistering(false)
			},
			onSuccess: () => {
				toast.dismiss()
				toast.success("Account created successfully")
				window.location.href = redirectPath || REDIRECT_AFTER_SIGN_IN
			},
		},
	)

	const { execute: startPasskeyRegistration } = useServerAction(
		startPasskeyRegistrationAction,
		{
			onError: (error) => {
				toast.dismiss()
				toast.error(error.err?.message)
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

	const onSubmit = async (data: SignUpSchema) => {
		signUp(data)
	}

	const onPasskeySubmit = async (data: PasskeyEmailSchema) => {
		startPasskeyRegistration(data)
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
							href={`/sign-in?redirect=${encodeURIComponent(redirectPath)}`}
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
										<Input placeholder="FIRST NAME" {...field} />
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
										<Input placeholder="LAST NAME" {...field} />
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
										<Input type="password" placeholder="PASSWORD" {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<div className="flex flex-col justify-center items-center">
							<Captcha
								onSuccess={(token: string) => form.setValue("captchaToken", token)}
								validationError={form.formState.errors.captchaToken?.message}
							/>

							<Button
								type="submit"
								disabled={Boolean(isTurnstileEnabled && !captchaToken)}
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
							href="/terms"
							className="font-bold text-orange underline hover:no-underline"
						>
							TERMS OF SERVICE
						</Link>{" "}
						AND{" "}
						<Link
							href="/privacy"
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
								name="firstName"
								render={({ field }) => (
									<FormItem>
										<FormControl>
											<Input
												placeholder="FIRST NAME"
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
												placeholder="LAST NAME"
												disabled={isRegistering}
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
										Boolean(isTurnstileEnabled && !passkeyCaptchaToken)
									}
								>
									{isRegistering ? (
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

export default SignUpPage
