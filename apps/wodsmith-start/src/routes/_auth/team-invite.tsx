import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router'
import { useEffect, useRef, useTransition } from 'react'
import * as React from 'react'
import { toast } from 'sonner'
import { Button } from '~/components/ui/button'
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '~/components/ui/card'
import { Spinner } from '~/components/ui/spinner'
import { teamInviteSchema } from '~/schemas/team-invite.schema'
import { acceptTeamInviteAction } from '~/server-functions/auth'

export const Route = createFileRoute('/_auth/team-invite')({
	validateSearch: (search: Record<string, unknown>) => ({
		token: (search.token as string) || '',
	}),
	component: TeamInvitePage,
})

interface TeamInviteSearch {
	token?: string
}

function TeamInvitePage() {
	const navigate = useNavigate()
	const { token } = useSearch({ from: '/_auth/team-invite' })
	const hasCalledAcceptInvite = useRef(false)
	const [isPending, startTransition] = useTransition()
	const [error, setError] = React.useState<Error | null>(null)

	useEffect(() => {
		if (token && !hasCalledAcceptInvite.current) {
			const result = teamInviteSchema.safeParse({ token })
			if (result.success) {
				hasCalledAcceptInvite.current = true
				toast.loading('Processing your invitation...')
				startTransition(async () => {
					try {
						const data = await acceptTeamInviteAction(result.data)
						toast.dismiss()
						toast.success("You've successfully joined the team!")

						// Redirect to the team dashboard, with fallback to general dashboard
						setTimeout(() => {
							if (data && typeof data === 'object' && 'teamSlug' in data) {
								navigate({ to: `/settings/teams/${data.teamSlug}` })
							} else if (
								data &&
								typeof data === 'object' &&
								data.data &&
								'teamSlug' in data.data
							) {
								navigate({ to: `/settings/teams/${data.data.teamSlug}` })
							} else {
								// Fallback to dashboard if teamSlug is not found
								navigate({ to: '/settings' })
							}
						}, 500)
					} catch (error) {
						toast.dismiss()
						const err = error instanceof Error ? error : new Error('Failed to accept team invitation')
						setError(err)
						toast.error(err.message || 'Failed to accept team invitation')
					}
				})
			} else {
				toast.error('Invalid invitation token')
				navigate({ to: '/sign-in' })
			}
		}
	}, [token, navigate])

	if (isPending) {
		return (
			<div className="container mx-auto px-4 flex items-center justify-center min-h-screen">
				<Card className="w-full max-w-md">
					<CardHeader className="text-center">
						<div className="flex flex-col items-center space-y-4">
							<Spinner size="large" />
							<CardTitle>Accepting Invitation</CardTitle>
							<CardDescription>
								Please wait while we process your team invitation...
							</CardDescription>
						</div>
					</CardHeader>
				</Card>
			</div>
		)
	}

	if (error) {
		return (
			<div className="container mx-auto px-4 flex items-center justify-center min-h-screen">
				<Card className="w-full max-w-md">
					<CardHeader>
						<CardTitle>Invitation Error</CardTitle>
						<CardDescription>
							{error?.message || 'Failed to process the invitation'}
						</CardDescription>
					</CardHeader>
					<CardContent className="flex flex-col gap-4">
						<p className="text-sm text-muted-foreground">
							{error?.code === 'CONFLICT'
								? 'You are already a member of this team.'
								: error?.code === 'FORBIDDEN' &&
									  error?.message.includes('limit')
									? "You've reached the maximum number of teams you can join."
									: 'The invitation may have expired or been revoked.'}
						</p>
						<Button
							variant="outline"
							className="w-full"
							onClick={() => navigate({ to: '/settings/teams' })}
						>
							Go to Teams
						</Button>
					</CardContent>
				</Card>
			</div>
		)
	}

	if (!token) {
		return (
			<div className="container mx-auto px-4 flex items-center justify-center min-h-screen">
				<Card className="w-full max-w-md">
					<CardHeader>
						<CardTitle>Invalid Invitation Link</CardTitle>
						<CardDescription>
							The invitation link is invalid or has expired.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Button
							variant="outline"
							className="w-full"
							onClick={() => navigate({ to: '/settings/teams' })}
						>
							Go to Dashboard
						</Button>
					</CardContent>
				</Card>
			</div>
		)
	}

	return null
}
