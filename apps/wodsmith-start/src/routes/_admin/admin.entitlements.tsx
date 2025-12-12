import { createFileRoute } from "@tanstack/react-router"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card"

export const Route = createFileRoute("/_admin/admin/entitlements")({
	component: AdminEntitlementsPage,
})

function AdminEntitlementsPage() {
	return (
		<div className="max-w-4xl">
			<div className="mb-8">
				<h1 className="text-3xl font-bold tracking-tight">
					Entitlements Management
				</h1>
				<p className="text-muted-foreground mt-2">
					Manage team plans, view usage, and add entitlement overrides for all
					teams in the system.
				</p>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Team Entitlements</CardTitle>
					<CardDescription>
						Manage plan assignments and feature overrides
					</CardDescription>
				</CardHeader>
				<CardContent>
					<p className="text-sm text-muted-foreground">
						Entitlements management interface coming soon...
					</p>
				</CardContent>
			</Card>
		</div>
	)
}
