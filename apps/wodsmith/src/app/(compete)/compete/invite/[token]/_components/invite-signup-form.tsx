"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { useServerAction } from "@repo/zsa-react"
import { Captcha } from "@/components/captcha"
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
import { useConfigStore } from "@/state/config"
import { inviteSignUpAction } from "./invite-signup.actions"

const formSchema = z.object({
	email: z.string().email(),
	firstName: z.string().min(2, "First name required"),
	lastName: z.string().min(2, "Last name required"),
	password: z.string().min(6, "Password must be at least 6 characters"),
	captchaToken: z.string().optional(),
})

type FormValues = z.infer<typeof formSchema>

type Props = {
	inviteToken: string
	inviteEmail: string
}

export function InviteSignUpForm({ inviteToken, inviteEmail }: Props) {
	const { isTurnstileEnabled } = useConfigStore()

	const form = useForm<FormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			email: inviteEmail,
			firstName: "",
			lastName: "",
			password: "",
		},
	})

	const captchaToken = useWatch({
		control: form.control,
		name: "captchaToken",
	})

	const currentEmail = useWatch({
		control: form.control,
		name: "email",
	})

	const emailChanged = currentEmail?.toLowerCase() !== inviteEmail.toLowerCase()

	const { execute, isPending } = useServerAction(inviteSignUpAction, {
		// Server action uses redirect() so onSuccess won't be called
		// This prevents race condition where page re-renders with "Already Accepted"
		onError: ({ err }) => {
			toast.error(err?.message || "Failed to create account")
		},
	})

	const onSubmit = (data: FormValues) => {
		execute({
			...data,
			inviteToken,
			captchaToken: data.captchaToken || "",
		})
	}

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
				<FormField
					control={form.control}
					name="email"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Email</FormLabel>
							<FormControl>
								<Input type="email" {...field} />
							</FormControl>
							{emailChanged && (
								<p className="text-xs text-muted-foreground">
									This will update your invite email from {inviteEmail}
								</p>
							)}
							<FormMessage />
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
									<Input {...field} />
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
									<Input {...field} />
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
								<Input type="password" {...field} />
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
						disabled={isPending || Boolean(isTurnstileEnabled && !captchaToken)}
					>
						{isPending ? "Creating Account..." : "Create Account & Join Team"}
					</Button>
				</div>
			</form>
		</Form>
	)
}
