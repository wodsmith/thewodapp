import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useTransition } from 'react'
import * as React from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { Button } from '~/components/ui/button'
import { Captcha } from '~/components/captcha'
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '~/components/ui/card'
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from '~/components/ui/form'
import { Input } from '~/components/ui/input'
import { forgotPasswordSchema } from '~/schemas/forgot-password.schema'
import { forgotPasswordAction } from '~/server-functions/auth'
import { useConfigStore } from '~/state/config'
import { useSessionStore } from '~/state/session'
import type { z } from 'zod'

export const Route = createFileRoute('/_auth/forgot-password')({
	component: ForgotPasswordPage,
})

type ForgotPasswordSchema = z.infer<typeof forgotPasswordSchema>

function ForgotPasswordPage() {
	const navigate = useNavigate()
	const { session } = useSessionStore()
	const { isTurnstileEnabled } = useConfigStore()
	const [isPending, startTransition] = useTransition()
	const [isSuccess, setIsSuccess] = React.useState(false)

	const form = useForm<ForgotPasswordSchema>({
		resolver: zodResolver(forgotPasswordSchema),
	})

	const captchaToken = useWatch({ control: form.control, name: 'captchaToken' })

	const onSubmit = (data: ForgotPasswordSchema) => {
		toast.loading('Sending reset instructions...')
		startTransition(async () => {
			try {
				await forgotPasswordAction(data)
				toast.dismiss()
				toast.success('Reset instructions sent')
				setIsSuccess(true)
			} catch (error) {
				toast.dismiss()
				const message = error instanceof Error ? error.message : 'Failed to send reset instructions'
				toast.error(message)
			}
		})
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
							onClick={() => navigate({ to: '/sign-in' })}
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
						{session ? 'Change Password' : 'Forgot Password'}
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
										form.setValue('captchaToken', token)
									}
									validationError={form.formState.errors.captchaToken?.message}
								/>

								<Button
									type="submit"
									disabled={isPending || Boolean(isTurnstileEnabled && !captchaToken)}
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
						onClick={() => navigate({ to: '/settings' })}
					>
						Back to settings
					</Button>
				) : (
					<Button
						type="button"
						variant="link"
						className="w-full"
						onClick={() => navigate({ to: '/sign-in' })}
					>
						Back to login
					</Button>
				)}
			</div>
		</div>
	)
}
