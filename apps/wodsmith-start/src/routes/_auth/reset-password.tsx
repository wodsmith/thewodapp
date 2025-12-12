import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router'
import { useEffect, useTransition } from 'react'
import * as React from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Button } from '~/components/ui/button'
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
import { resetPasswordSchema, type ResetPasswordSchema } from '~/schemas/reset-password.schema'
import { resetPasswordAction } from '~/server-functions/auth'

export const Route = createFileRoute('/_auth/reset-password')({
	validateSearch: (search: Record<string, unknown>) => ({
		token: (search.token as string) || '',
	}),
	component: ResetPasswordPage,
})

interface ResetPasswordSearch {
	token?: string
}

function ResetPasswordPage() {
	const navigate = useNavigate()
	const { token } = useSearch({ from: '/_auth/reset-password' })
	const [isPending, startTransition] = useTransition()
	const [isSuccess, setIsSuccess] = React.useState(false)

	const form = useForm<ResetPasswordSchema>({
		resolver: zodResolver(resetPasswordSchema),
		defaultValues: {
			token: token || '',
			password: '',
			confirmPassword: '',
		},
	})

	useEffect(() => {
		if (token) {
			form.setValue('token', token)
		}
	}, [token, form.setValue])

	const onSubmit = (data: ResetPasswordSchema) => {
		toast.loading('Resetting password...')
		startTransition(async () => {
			try {
				await resetPasswordAction(data)
				toast.dismiss()
				toast.success('Password reset successfully')
				setIsSuccess(true)
			} catch (error) {
				toast.dismiss()
				const message = error instanceof Error ? error.message : 'Failed to reset password'
				toast.error(message)
			}
		})
	}

	if (isSuccess) {
		return (
			<div className="container mx-auto px-4 flex items-center justify-center min-h-screen">
				<Card className="w-full max-w-md">
					<CardHeader>
						<CardTitle>Password Reset Successfully</CardTitle>
						<CardDescription>
							Your password has been reset. You can now log in with your new
							password.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Button
							variant="outline"
							className="w-full"
							onClick={() => navigate({ to: '/sign-in' })}
						>
							Go to Login
						</Button>
					</CardContent>
				</Card>
			</div>
		)
	}

	return (
		<div className="container mx-auto px-4 flex items-center justify-center min-h-screen">
			<Card className="w-full max-w-md">
				<CardHeader>
					<CardTitle>Reset Password</CardTitle>
					<CardDescription>Enter your new password below.</CardDescription>
				</CardHeader>
				<CardContent>
					<Form {...form}>
						<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
							<FormField
								control={form.control}
								name="password"
								render={({ field }) => (
									<FormItem>
										<FormLabel>New Password</FormLabel>
										<FormControl>
											<Input type="password" disabled={isPending} {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="confirmPassword"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Confirm Password</FormLabel>
										<FormControl>
											<Input type="password" disabled={isPending} {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<Button type="submit" disabled={isPending} className="w-full">
								Reset Password
							</Button>
						</form>
					</Form>
				</CardContent>
			</Card>
		</div>
	)
}
