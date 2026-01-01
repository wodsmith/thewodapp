import { createFileRoute } from "@tanstack/react-router"
import { Spinner } from "@/components/ui/spinner"
import { initiateGoogleSSOFn } from "@/server-fns/google-sso-fns"

export const Route = createFileRoute("/_auth/sso/google")({
	loader: async () => {
		// This will redirect to Google OAuth or throw an error
		await initiateGoogleSSOFn()
	},
	component: GoogleSSOPage,
})

/**
 * This component shows briefly while the loader is initiating the redirect
 */
function GoogleSSOPage() {
	return (
		<div className="container mx-auto px-4 flex items-center justify-center min-h-screen">
			<div className="flex flex-col items-center space-y-4">
				<Spinner size="large" />
				<p className="text-muted-foreground font-mono">
					Redirecting to Google...
				</p>
			</div>
		</div>
	)
}
