"use client"

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema"
import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { Loader2, UserPlus } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { Captcha } from "@/components/captcha"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { signUpSchema, type SignUpInput } from "@/schemas/auth.schema"
import { signUpFn } from "@/server-fns/auth-fns"

interface InviteSignUpFormProps {
	inviteToken: string
	inviteEmail: string
}

/**
 * Inline signup form for accepting an invite without an existing account.
 *
 * Creates a user account inline and redirects back to the invite page
 * where the now-authenticated user can accept the invite.
 */
export function InviteSignUpForm({
	inviteToken,
	inviteEmail,
}: InviteSignUpFormProps) {
	const router = useRouter()
	const [error, setError] = useState<string | null>(null)
	const [isLoading, setIsLoading] = useState(false)

	// Use useServerFn for client-side calls
	const signUp = useServerFn(signUpFn)

	const form = useForm<SignUpInput>({
		resolver: standardSchemaResolver(signUpSchema),
		defaultValues: {
			email: inviteEmail,
			firstName: "",
			lastName: "",
			password: "",
		},
	})

	const emailChanged =
		form.watch("email").toLowerCase() !== inviteEmail.toLowerCase()

	const onSubmit = async (data: SignUpInput) => {
		try {
			setIsLoading(true)
			setError(null)

			await signUp({ data })

			// After successful signup, redirect back to the invite page
			// The user is now authenticated and can accept the invite
			router.navigate({ to: `/compete/invite/${inviteToken}` })
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : "Sign-up failed"
			setError(errorMessage)
			console.error("Sign-up error:", err)
		} finally {
			setIsLoading(false)
		}
	}

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
				{error && (
					<Alert variant="destructive">
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				)}

				<FormField
					control={form.control}
					name="email"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Email</FormLabel>
							<FormControl>
								<Input type="email" disabled={isLoading} {...field} />
							</FormControl>
							<FormMessage />
							{emailChanged && (
								<p className="text-xs text-muted-foreground">
									This will update your invite email from {inviteEmail}
								</p>
							)}
						</FormItem>
					)}
				/>

				<div className="grid grid-cols-2 gap-3">
					<FormField
						control={form.control}
						name="firstName"
						render={({ field }) => (
							<FormItem>
								<FormLabel>First Name</FormLabel>
								<FormControl>
									<Input disabled={isLoading} {...field} />
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
									<Input disabled={isLoading} {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
				</div>

				<FormField
					control={form.control}
					name="password"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Password</FormLabel>
							<FormControl>
								<Input
									type="password"
									placeholder="Min 8 chars, uppercase, lowercase, number"
									disabled={isLoading}
									{...field}
								/>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				<div className="flex flex-col items-center gap-4 pt-2">
					<Captcha
						onSuccess={(token: string) => form.setValue("captchaToken", token)}
						validationError={form.formState.errors.captchaToken?.message}
					/>

					<Button
						type="submit"
						className="w-full"
						size="lg"
						disabled={isLoading}
					>
						{isLoading ? (
							<>
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								Creating Account...
							</>
						) : (
							<>
								<UserPlus className="mr-2 h-4 w-4" />
								Create Account & Join Team
							</>
						)}
					</Button>
				</div>
			</form>
		</Form>
	)
}
