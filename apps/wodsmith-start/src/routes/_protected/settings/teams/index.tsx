import { createFileRoute, Link } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { AlertCircle, Mail, Plus } from "lucide-react"
import * as React from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button, buttonVariants } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import type { Team } from "@/db/schema"
import { resendVerificationFn } from "@/server-fns/auth-fns"
import { getUserTeamsFn } from "@/server-fns/team-settings-fns"
import { cn } from "@/utils/cn"

export const Route = createFileRoute("/_protected/settings/teams/")({
	component: TeamsPage,
	loader: async () => {
		try {
			const result = await getUserTeamsFn()

			if (!result.success) {
				return { teams: [] as Team[], emailNotVerified: false }
			}

			return { teams: result.data, emailNotVerified: false }
		} catch (error) {
			// Check if error is due to unverified email
			if (error instanceof Error && error.message === "Email not verified") {
				return { teams: [] as Team[], emailNotVerified: true }
			}
			throw error
		}
	},
})

function TeamsPage() {
	const { teams, emailNotVerified } = Route.useLoaderData()

	if (emailNotVerified) {
		return <EmailVerificationRequired />
	}

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader className="flex flex-row items-center justify-between space-y-0">
					<div>
						<CardTitle>Your Teams</CardTitle>
						<CardDescription>
							You are a member of the following teams.
						</CardDescription>
					</div>
					<Link
						to="/settings/teams/create"
						className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
					>
						<Plus className="h-4 w-4 mr-2" />
						Create New Team
					</Link>
				</CardHeader>
				<CardContent>
					<div className="space-y-1">
						{teams.length > 0 ? (
							teams.map((team) => (
								<div
									key={team.id}
									className={cn(
										"flex items-center justify-between gap-4 px-3 py-2 rounded-md border transition-colors",
										"bg-background hover:bg-accent border-border",
									)}
								>
									<Link
										to="/settings/teams/$teamSlug"
										params={{ teamSlug: team.slug }}
										className="flex-1 font-medium"
									>
										{team.name}
									</Link>
								</div>
							))
						) : (
							<div className="text-center py-8">
								<p className="text-muted-foreground mb-4">
									You are not a member of any teams.
								</p>
								<Link
									to="/settings/teams/create"
									className={cn(buttonVariants({ variant: "default" }))}
								>
									<Plus className="h-4 w-4 mr-2" />
									Create your first team
								</Link>
							</div>
						)}
					</div>
				</CardContent>
			</Card>
		</div>
	)
}

function EmailVerificationRequired() {
	const [isResending, setIsResending] = React.useState(false)
	const [resendSuccess, setResendSuccess] = React.useState(false)
	const [resendError, setResendError] = React.useState<string | null>(null)
	const resendVerification = useServerFn(resendVerificationFn)

	const handleResendVerification = async () => {
		setIsResending(true)
		setResendError(null)
		try {
			const result = await resendVerification()
			if (result.success) {
				setResendSuccess(true)
			} else {
				setResendError("Failed to send verification email")
			}
		} catch {
			setResendError("Failed to send verification email")
		} finally {
			setIsResending(false)
		}
	}

	return (
		<div className="space-y-6">
			<Alert variant="destructive">
				<AlertCircle className="h-4 w-4" />
				<AlertTitle>Email Verification Required</AlertTitle>
				<AlertDescription>
					You need to verify your email address before you can create or manage
					teams. Please check your inbox for a verification email.
				</AlertDescription>
			</Alert>

			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Mail className="h-5 w-5" />
						Verify Your Email
					</CardTitle>
					<CardDescription>
						We sent a verification link to your email address. Click the link to
						verify your account and unlock team features.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					{resendSuccess ? (
						<Alert>
							<Mail className="h-4 w-4" />
							<AlertTitle>Verification Email Sent</AlertTitle>
							<AlertDescription>
								We've sent a new verification email. Please check your inbox and
								spam folder.
							</AlertDescription>
						</Alert>
					) : (
						<>
							{resendError && (
								<Alert variant="destructive">
									<AlertCircle className="h-4 w-4" />
									<AlertDescription>{resendError}</AlertDescription>
								</Alert>
							)}
							<p className="text-sm text-muted-foreground">
								Didn't receive the email? Check your spam folder or request a
								new one.
							</p>
							<Button
								onClick={handleResendVerification}
								disabled={isResending}
								variant="outline"
							>
								{isResending ? "Sending..." : "Resend Verification Email"}
							</Button>
						</>
					)}
				</CardContent>
			</Card>
		</div>
	)
}
