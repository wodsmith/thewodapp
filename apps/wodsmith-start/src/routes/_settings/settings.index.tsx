import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/_settings/settings/")({
	beforeLoad: () => {
		throw redirect({ to: "/settings/profile" })
	},
})
