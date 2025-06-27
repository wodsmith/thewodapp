"use client"

import { type SignInSchema, signInSchema } from "@/schemas/signin.schema"
import { type ReactNode, useState } from "react"
import { signInAction } from "./sign-in.actions"

import SeparatorWithText from "@/components/separator-with-text"
import { Button } from "@/components/ui/button"
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"

import {
	generateAuthenticationOptionsAction,
	verifyAuthenticationAction,
} from "@/app/(settings)/settings/security/passkey-settings.actions"
import { zodResolver } from "@hookform/resolvers/zod"
import { startAuthentication } from "@simplewebauthn/browser"
import { KeyIcon } from "lucide-react"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { useServerAction } from "zsa-react"
import SSOButtons from "../_components/sso-buttons"

interface SignInClientProps {
	redirectPath: string
}

interface PasskeyAuthenticationButtonProps {
	className?: string
	disabled?: boolean
	children?: ReactNode
	redirectPath: string
}

function PasskeyAuthenticationButton({
	className,
	disabled,
	children,
	redirectPath,
}: PasskeyAuthenticationButtonProps) {
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
			},
			onSuccess: () => {
				toast.dismiss()
				toast.success("Authentication successful")
				window.location.href = redirectPath
			},
		},
	)

	const [isAuthenticating, setIsAuthenticating] = useState(false)

	const handleAuthenticate = async () => {
		try {
			setIsAuthenticating(true)
			toast.loading("Authenticating with passkey...")

			// Get authentication options from the server
			const [options] = await generateOptions({})

			if (!options) {
				throw new Error("Failed to get authentication options")
			}

			// Start the authentication process in the browser
			const authenticationResponse = await startAuthentication({
				optionsJSON: options,
			})

			// Send the response back to the server for verification
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

	return (
		<Button
			onClick={handleAuthenticate}
			disabled={isAuthenticating || disabled}
			className={className}
		>
			{isAuthenticating
				? "Authenticating..."
				: children || "Sign in with a Passkey"}
		</Button>
	)
}

const SignInPage = ({ redirectPath }: SignInClientProps) => {
	const { execute: signIn } = useServerAction(signInAction, {
		onError: (error) => {
			toast.dismiss()
			toast.error(error.err?.message)
		},
		onStart: () => {
			toast.loading("Signing you in...")
		},
		onSuccess: () => {
			toast.dismiss()
			toast.success("Signed in successfully")
			window.location.href = redirectPath
		},
	})
	const form = useForm<SignInSchema>({
		resolver: zodResolver(signInSchema),
	})

	const onSubmit = async (data: SignInSchema) => {
		signIn(data)
	}

	return (
		<div className="min-h-[90vh] flex flex-col items-center px-4 justify-center bg-background my-6 md:my-10">
			<div className="w-full max-w-md space-y-8 p-8 bg-background border-4 border-primary shadow-[8px_8px_0px_0px] shadow-primary">
				<div className="text-center">
					<h2 className="mt-2 text-3xl md:text-4xl font-mono font-bold tracking-tight text-primary uppercase">
						SIGN IN
					</h2>
					<p className="mt-4 text-primary font-mono">
						OR{" "}
						<Link
							href={`/sign-up?redirect=${encodeURIComponent(redirectPath)}`}
							className="font-bold text-orange underline hover:no-underline"
						>
							CREATE ACCOUNT
						</Link>
					</p>
				</div>

				<div className="space-y-4">
					<SSOButtons isSignIn />

					<PasskeyAuthenticationButton
						className="w-full bg-secondary border-4 border-primary text-primary hover:bg-orange hover:text-white shadow-[4px_4px_0px_0px] shadow-primary transition-all font-mono font-bold uppercase"
						redirectPath={redirectPath}
					>
						<KeyIcon className="w-5 h-5 mr-2" />
						SIGN IN WITH PASSKEY
					</PasskeyAuthenticationButton>
				</div>

				<SeparatorWithText>
					<span className="uppercase text-primary font-mono font-bold text-sm">
						OR
					</span>
				</SeparatorWithText>

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
											className="w-full px-4 py-3 border-4 border-primary font-mono placeholder:text-primary/60 placeholder:font-mono placeholder:uppercase bg-background focus:border-orange focus:ring-0 focus:outline-none transition-colors"
											{...field}
										/>
									</FormControl>
									<FormMessage className="font-mono text-destructive" />
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
											className="w-full px-4 py-3 border-4 border-primary font-mono placeholder:text-primary/60 placeholder:font-mono placeholder:uppercase bg-background focus:border-orange focus:ring-0 focus:outline-none transition-colors"
											{...field}
										/>
									</FormControl>
									<FormMessage className="font-mono text-destructive" />
								</FormItem>
							)}
						/>

						<Button
							type="submit"
							className="w-full flex justify-center py-3 mt-6 font-mono font-bold uppercase text-lg"
						>
							SIGN IN
						</Button>
					</form>
				</Form>
			</div>

			<div className="mt-8">
				<p className="text-center text-sm text-primary font-mono">
					<Link
						href="/forgot-password"
						className="font-bold text-orange underline hover:no-underline uppercase"
					>
						FORGOT PASSWORD?
					</Link>
				</p>
			</div>
		</div>
	)
}

export default SignInPage
