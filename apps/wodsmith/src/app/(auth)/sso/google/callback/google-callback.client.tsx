"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useRef } from "react"
import { toast } from "sonner"
import { useServerAction } from "@repo/zsa-react"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { REDIRECT_AFTER_SIGN_IN } from "@/constants"
import { googleSSOCallbackSchema } from "@/schemas/google-sso-callback.schema"
import { googleSSOCallbackAction } from "./google-callback.action"

export default function GoogleCallbackClientComponent() {
	const router = useRouter()
	const searchParams = useSearchParams()
	const code = searchParams.get("code")
	const state = searchParams.get("state")
	const hasCalledCallback = useRef(false)

	const {
		execute: handleCallback,
		isPending,
		error,
	} = useServerAction(googleSSOCallbackAction, {
		onError: (error) => {
			toast.dismiss()
			toast.error(error.err?.message || "Failed to sign in with Google")
		},
		onStart: () => {
			toast.loading("Signing you in with Google...")
		},
		onSuccess: () => {
			toast.dismiss()
			toast.success("Signed in successfully")
			window.location.href = REDIRECT_AFTER_SIGN_IN
		},
	})

	useEffect(() => {
		if (code && state && !hasCalledCallback.current) {
			const result = googleSSOCallbackSchema.safeParse({ code, state })
			if (result.success) {
				hasCalledCallback.current = true
				handleCallback(result.data)
			} else {
				toast.error("Invalid callback parameters")
				router.push("/sign-in")
			}
		}
	}, [code, state, handleCallback, router])

	if (isPending) {
		return (
			<div className="container mx-auto px-4 flex items-center justify-center min-h-screen">
				<Card className="w-full max-w-md">
					<CardHeader className="text-center">
						<div className="flex flex-col items-center space-y-4">
							<Spinner size="large" />
							<CardTitle>Signing in with Google</CardTitle>
							<CardDescription>
								Please wait while we complete your sign in...
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
						<CardTitle>Sign in failed</CardTitle>
						<CardDescription>
							{error?.message || "Failed to sign in with Google"}
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Button
							variant="outline"
							className="w-full"
							onClick={() => router.push("/sign-in")}
						>
							Back to sign in
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
					<CardTitle>Invalid callback</CardTitle>
					<CardDescription>
						The sign in callback is invalid or has expired. Please try signing
						in again.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Button
						variant="outline"
						className="w-full"
						onClick={() => router.push("/sign-in")}
					>
						Back to sign in
					</Button>
				</CardContent>
			</Card>
		</div>
	)
}
