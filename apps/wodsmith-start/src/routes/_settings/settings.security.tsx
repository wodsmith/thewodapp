import { createFileRoute } from "@tanstack/react-router"
import { PasskeysList } from "~/components/settings/passkey"
import { getCurrentUserPasskeysFn } from "~/server-functions/passkeys"

export const Route = createFileRoute("/_settings/settings/security")({
	loader: async () => getCurrentUserPasskeysFn(),
	component: SecurityPage,
})

function SecurityPage() {
	const data = Route.useLoaderData()

	if (!data.isAuthenticated) return <div>Not authenticated</div>

	return (
		<div className="container max-w-4xl space-y-8">
			<PasskeysList
				passkeys={data.passkeys}
				currentPasskeyId={data.currentPasskeyId}
				email={data.email ?? ""}
			/>
		</div>
	)
}
