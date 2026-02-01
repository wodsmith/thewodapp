/**
 * Success Claim Prompt Component
 * Shown after a guest successfully submits their registration data without authentication.
 * Prompts them to sign in or sign up to claim their registration.
 */

"use client"

import { Link } from "@tanstack/react-router"
import { CheckCircle2, LogIn, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

interface SuccessClaimPromptProps {
	teamName: string
	competitionName: string
	inviteToken: string
	emailHasAccount: boolean
}

export function SuccessClaimPrompt({
	teamName,
	competitionName,
	inviteToken,
	emailHasAccount,
}: SuccessClaimPromptProps) {
	const redirectUrl = `/compete/invite/${inviteToken}`

	return (
		<Card className="w-full max-w-md mx-auto">
			<CardContent className="pt-6">
				<div className="text-center">
					<div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
						<CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
					</div>

					<h2 className="text-2xl font-bold mb-2">Registration Complete!</h2>
					<p className="text-muted-foreground mb-6">
						Your registration details have been saved.
					</p>

					<div className="mb-6 p-4 rounded-lg bg-muted/50">
						<p className="text-sm font-medium text-foreground">
							Team: {teamName}
						</p>
						<p className="text-sm text-muted-foreground">
							Competition: {competitionName}
						</p>
					</div>

					<div className="space-y-3">
						{emailHasAccount ? (
							<>
								<Button asChild className="w-full" size="lg">
									<Link
										to="/sign-in"
										search={{
											redirect: redirectUrl,
										}}
									>
										<LogIn className="mr-2 h-4 w-4" />
										Sign In to Claim Registration
									</Link>
								</Button>
								<Button asChild variant="outline" className="w-full" size="lg">
									<Link
										to="/sign-up"
										search={{
											redirect: redirectUrl,
										}}
									>
										<UserPlus className="mr-2 h-4 w-4" />
										Create New Account
									</Link>
								</Button>
							</>
						) : (
							<>
								<Button asChild className="w-full" size="lg">
									<Link
										to="/sign-up"
										search={{
											redirect: redirectUrl,
										}}
									>
										<UserPlus className="mr-2 h-4 w-4" />
										Sign Up to Claim Registration
									</Link>
								</Button>
								<Button asChild variant="outline" className="w-full" size="lg">
									<Link
										to="/sign-in"
										search={{
											redirect: redirectUrl,
										}}
									>
										<LogIn className="mr-2 h-4 w-4" />
										Already Have an Account?
									</Link>
								</Button>
							</>
						)}
					</div>
				</div>
			</CardContent>
		</Card>
	)
}
