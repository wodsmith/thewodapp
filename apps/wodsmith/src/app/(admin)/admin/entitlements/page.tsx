import "server-only"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { requireAdmin } from "@/utils/auth"
import { EntitlementsManagementClient } from "./_components/entitlements-management-client"

export const metadata: Metadata = {
	title: "Entitlements Management",
	description: "Manage team plans and entitlement overrides",
}

export default async function EntitlementsManagementPage() {
	const session = await requireAdmin({ doNotThrowError: true })
	if (!session) {
		notFound()
	}

	return (
		<>
			<PageHeader
				items={[
					{ href: "/admin", label: "Admin" },
					{ href: "/admin/entitlements", label: "Entitlements" },
				]}
			/>
			<div className="container mx-auto px-5 py-8">
				<div className="mb-8">
					<h1 className="text-3xl font-bold tracking-tight mb-2">
						Entitlements Management
					</h1>
					<p className="text-muted-foreground">
						Manage team plans, view usage, and add entitlement overrides for all
						teams in the system.
					</p>
				</div>

				<EntitlementsManagementClient />
			</div>
		</>
	)
}
