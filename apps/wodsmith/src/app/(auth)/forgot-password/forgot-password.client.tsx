"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import type { z } from "zod"
import { useServerAction } from "zsa-react"
import { Captcha } from "@/components/captcha"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
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
import { forgotPasswordSchema } from "@/schemas/forgot-password.schema"
import { useConfigStore } from "@/state/config"
import { useSessionStore } from "@/state/session"
import { forgotPasswordAction } from "./forgot-password.action"

type ForgotPasswordSchema = z.infer<typeof forgotPasswordSchema>

export default function ForgotPasswordClientComponent() {
	const { session } = useSessionStore()
	const { isTurnstileEnabled } = useConfigStore()
	const router = useRouter()

	const form = useForm<ForgotPasswordSchema>({
		resolver: zodResolver(forgotPasswordSchema),
	})

	const captchaToken = useWatch({ control: form.control, name: "captchaToken" })

	const { execute: sendResetLink, isSuccess } = useServerAction(
		forgotPasswordAction,
		{
			onError: (error) => {
				toast.dismiss()
				toast.error(error.err?.message)
			},
			onStart: () => {
				toast.loading("Sending reset instructions...")
			},
			onSuccess: () => {
				toast.dismiss()
				toast.success("Reset instructions sent")
			},
		},
	)

	const onSubmit = async (data: ForgotPasswordSchema) => {
		sendResetLink(data)
	}

	if (isSuccess) {
		return (
			<div className="container mx-auto px-4 flex items-center justify-center min-h-screen">
				<Card className="w-full max-w-md">
					<CardHeader>
						<CardTitle>Check your email</CardTitle>
						<CardDescription>
							If an account exists with that email, we&apos;ve sent you
							instructions to reset your password.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Button
							variant="outline"
							className="w-full"
							onClick={() => router.push("/sign-in")}
						>
							Back to login
						</Button>
					</CardContent>
				</Card>
			</div>
		)
	}

	return (
		<div className="container mx-auto px-4 flex flex-col items-center justify-center min-h-screen">
			<Card className="w-full max-w-md">
				<CardHeader>
					<CardTitle>
						{session ? "Change Password" : "Forgot Password"}
					</CardTitle>
					<CardDescription>
						Enter your email address and we&apos;ll send you instructions to
						reset your password.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Form {...form}>
						<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
							<FormField
								control={form.control}
								name="email"
								disabled={Boolean(session?.user?.email)}
								defaultValue={session?.user?.email || undefined}
								render={({ field }) => (
									<FormItem>
										<FormLabel>Email</FormLabel>
										<FormControl>
											<Input
												type="email"
												placeholder="name@example.com"
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
									disabled={Boolean(isTurnstileEnabled && !captchaToken)}
								>
									Send Reset Instructions
								</Button>
							</div>
						</form>
					</Form>
				</CardContent>
			</Card>

			<div className="mt-4 w-full">
				{session ? (
					<Button
						type="button"
						variant="link"
						className="w-full"
						onClick={() => router.push("/settings")}
					>
						Back to settings
					</Button>
				) : (
					<Button
						type="button"
						variant="link"
						className="w-full"
						onClick={() => router.push("/sign-in")}
					>
						Back to login
					</Button>
				)}
			</div>
		</div>
	)
}
