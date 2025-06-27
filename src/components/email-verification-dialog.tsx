"use client"

import { Alert } from "@heroui/react"
import type { Route } from "next"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { useServerAction } from "zsa-react"
import { resendVerificationAction } from "@/app/(auth)/resend-verification.action"
import { Button } from "@/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"
import { EMAIL_VERIFICATION_TOKEN_EXPIRATION_SECONDS } from "@/constants"
import { useSessionStore } from "@/state/session"
import isProd from "@/utils/is-prod"

const pagesToBypass: Route[] = [
	"/verify-email",
	"/sign-in",
	"/sign-up",
	"/",
	"/privacy",
	"/terms",
	"/reset-password",
	"/forgot-password",
]

export function EmailVerificationDialog() {
	const { session } = useSessionStore()
	const [lastResendTime, setLastResendTime] = useState<number | null>(null)
	const pathname = usePathname()

	const { execute: resendVerification, status } = useServerAction(
		resendVerificationAction,
		{
			onError: (error) => {
				toast.dismiss()
				toast.error(error.err?.message)
			},
			onStart: () => {
				toast.loading("Sending verification email...")
			},
			onSuccess: () => {
				toast.dismiss()
				toast.success("Verification email sent")
				setLastResendTime(Date.now())
			},
		},
	)

	// Don't show the dialog if the user is not logged in, if their email is already verified,
	// or if we're on the verify-email page
	if (
		!session ||
		session.user.emailVerified ||
		pagesToBypass.includes(pathname as Route)
	) {
		return null
	}

	const canResend = !lastResendTime || Date.now() - lastResendTime > 60000 // 1 minute cooldown
	const isLoading = status === "pending"

	return (
		<Dialog
			open
			modal
			onOpenChange={(newState) => {
				if (newState === false) {
					toast.warning("Please verify your email before you continue")
				}
			}}
		>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Verify your email</DialogTitle>
					<DialogDescription>
						Please verify your email address to access all features. We sent a
						verification link to {session.user.email}. The verification link
						will expire in{" "}
						{Math.floor(EMAIL_VERIFICATION_TOKEN_EXPIRATION_SECONDS / 3600)}{" "}
						hours.
						{!isProd && (
							<Alert
								color="warning"
								title="Development mode"
								description="You can find the verification link in the console."
								className="mt-4 mb-2"
							/>
						)}
					</DialogDescription>
				</DialogHeader>
				<div className="flex flex-col gap-4">
					<Button
						onClick={() => resendVerification()}
						disabled={isLoading || !canResend}
					>
						{isLoading
							? "Sending..."
							: !canResend
								? "Please wait 1 minute before resending"
								: "Resend verification email"}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	)
}
