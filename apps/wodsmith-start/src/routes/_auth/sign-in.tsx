import { createFileRoute, redirect, useSearch } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { startAuthentication } from '@simplewebauthn/browser'
import { KeyIcon } from 'lucide-react'
import posthog from 'posthog-js'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { useServerAction } from '@repo/zsa-react'
import { Button } from '~/components/ui/button'
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormMessage,
} from '~/components/ui/form'
import { Input } from '~/components/ui/input'
import SeparatorWithText from '~/components/separator-with-text'
import SSOButtons from '../_components/sso-buttons'
import { signInSchema, type SignInSchema } from '~/schemas/signin.schema'
import { signInAction } from '~/server-functions/auth'
import {
	generateAuthenticationOptionsAction,
	verifyAuthenticationAction,
} from '~/server-functions/passkey'
import { REDIRECT_AFTER_SIGN_IN } from '~/constants'
import Link from '~/components/link'

export const Route = createFileRoute('/_auth/sign-in')({
	validateSearch: (search: Record<string, unknown>) => ({
		redirect: (search.redirect as string) ?? REDIRECT_AFTER_SIGN_IN,
	}),
	component: SignInPage,
})

interface SignInSearch {
	redirect?: string
}

function SignInPage() {
	const { redirect: redirectPath } = useSearch({ from: '/_auth/sign-in' })
	const form = useForm<SignInSchema>({
		resolver: zodResolver(signInSchema),
	})

	const { execute: signIn } = useServerAction(signInAction, {
		onError: (error) => {
			toast.dismiss()
			toast.error(error.err?.message)
			posthog.capture('user_signed_in_failed', {
				error_message: error.err?.message,
				auth_method: 'email_password',
			})
		},
		onStart: () => {
			toast.loading('Signing you in...')
		},
		onSuccess: (result) => {
			toast.dismiss()
			toast.success('Signed in successfully')
			const userId = result?.data?.userId
			if (userId) {
				posthog.identify(userId, {
					email: form.getValues('email'),
				})
			}
			posthog.capture('user_signed_in', {
				auth_method: 'email_password',
				user_id: userId,
			})
			window.location.href = redirectPath
		},
	})

	const { execute: generateOptions } = useServerAction(
		generateAuthenticationOptionsAction,
		{
			onError: (error) => {
				toast.dismiss()
				toast.error(error.err?.message || 'Failed to get authentication options')
			},
		},
	)

	const { execute: verifyAuthentication } = useServerAction(
		verifyAuthenticationAction,
		{
			onError: (error) => {
				toast.dismiss()
				toast.error(error.err?.message || 'Authentication failed')
				posthog.capture('user_signed_in_failed', {
					error_message: error.err?.message,
					auth_method: 'passkey',
				})
			},
			onSuccess: (result) => {
				toast.dismiss()
				toast.success('Authentication successful')
				if (result?.data?.userId) {
					posthog.identify(result.data.userId)
				}
				posthog.capture('user_signed_in', {
					auth_method: 'passkey',
					user_id: result?.data?.userId,
				})
				window.location.href = redirectPath
			},
		},
	)

	const [isAuthenticating, setIsAuthenticating] = useState(false)

	const onSubmit = (data: SignInSchema) => {
		signIn(data)
	}

	const handlePasskeyAuth = async () => {
		try {
			setIsAuthenticating(true)
			toast.loading('Authenticating with passkey...')

			const [options] = await generateOptions({})

			if (!options) {
				throw new Error('Failed to get authentication options')
			}

			const authenticationResponse = await startAuthentication({
				optionsJSON: options,
			})

			await verifyAuthentication({
				response: authenticationResponse,
				challenge: options.challenge,
			})
		} catch (error) {
			console.error('Passkey authentication error:', error)
			toast.dismiss()
			toast.error('Authentication failed')
		} finally {
			setIsAuthenticating(false)
		}
	}

	return (
		<div className="min-h-[90vh] flex flex-col items-center px-4 justify-center bg-background my-6 md:my-10">
			<div className="w-full max-w-md space-y-8 p-8 bg-background border-4 border-black dark:border-primary shadow-[8px_8px_0px_0px] dark:shadow-primary">
				<div className="text-center">
					<h2 className="mt-2 text-3xl md:text-4xl font-mono font-bold tracking-tight dark:text-primary uppercase">
						SIGN IN
					</h2>
					<p className="mt-4 text-black dark:text-primary font-mono">
						OR{' '}
						<Link
							to="/sign-up"
							search={{ redirect: redirectPath }}
							className="font-bold dark:text-primary underline hover:no-underline"
						>
							CREATE ACCOUNT
						</Link>
					</p>
				</div>

				<div className="space-y-4">
					<SSOButtons isSignIn />

					<Button
						onClick={handlePasskeyAuth}
						disabled={isAuthenticating}
						className="w-full"
					>
						<KeyIcon className="w-5 h-5 mr-2" />
						SIGN IN WITH PASSKEY
					</Button>
				</div>

				<SeparatorWithText>
					<span className="uppercase dark:text-primary font-mono font-bold text-sm">
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
										<Input type="password" placeholder="PASSWORD" {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<Button type="submit" className="w-full">
							SIGN IN
						</Button>
					</form>
				</Form>
			</div>

			<div className="mt-8">
				<p className="text-center text-sm dark:text-primary font-mono">
					<Link
						to="/forgot-password"
						className="font-bold dark:text-primary underline hover:no-underline uppercase"
					>
						FORGOT PASSWORD?
					</Link>
				</p>
			</div>
		</div>
	)
}
