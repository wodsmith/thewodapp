import { createFileRoute, Link, useRouter } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { z } from "zod"
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
import { handleGoogleSSOCallbackFn } from "@/server-fns/google-sso-fns"

// Search params schema for validation
const searchSchema = z.object({
	code: z.string().optional(),
	state: z.string().optional(),
})

export const Route = createFileRoute("/_auth/sso/google/callback")({
	validateSearch: (search: Record<string, unknown>) =>
		searchSchema.parse(search),
	beforeLoad: async ({ search }) => {
		const code = search.code || ""
		const state = search.state || ""

		// Handle the callback on the server
		const result = await handleGoogleSSOCallbackFn({
			data: {
				code,
				state,
			},
		})

		// If we get here, there was an error (success redirects automatically)
		return { error: result?.error || null }
	},
	component: GoogleCallbackPage,
})

function GoogleCallbackPage() {
	const router = useRouter()
	const { code, state } = Route.useSearch()
	const routeContext = Route.useRouteContext() as { error: string | null }
	const [isLoading, setIsLoading] = useState(true)

	useEffect(() => {
		// Short delay to show loading state
		const timer = setTimeout(() => setIsLoading(false), 500)
		return () => clearTimeout(timer)
	}, [])

	// Show loading state
	if (isLoading && !routeContext.error) {
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

	// Show error state
	if (routeContext.error) {
		return (
			<div className="container mx-auto px-4 flex items-center justify-center min-h-screen">
				<Card className="w-full max-w-md">
					<CardHeader>
						<CardTitle>Sign in failed</CardTitle>
						<CardDescription>
							{routeContext.error || "Failed to sign in with Google"}
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Button
							variant="outline"
							className="w-full"
							onClick={() =>
								router.navigate({
									to: "/sign-in",
									search: { redirect: REDIRECT_AFTER_SIGN_IN },
								})
							}
						>
							Back to sign in
						</Button>
					</CardContent>
				</Card>
			</div>
		)
	}

	// Fallback - invalid callback (no code/state)
	if (!code || !state) {
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
						<Link to="/sign-in" search={{ redirect: REDIRECT_AFTER_SIGN_IN }}>
							<Button variant="outline" className="w-full">
								Back to sign in
							</Button>
						</Link>
					</CardContent>
				</Card>
			</div>
		)
	}

	// This shouldn't be reached - successful login redirects in beforeLoad
	return null
}
