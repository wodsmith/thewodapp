import "server-only"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { requireAdmin } from "@/utils/auth"
import { ConfigManagementClient } from "./_components/config-management-client"

export const metadata: Metadata = {
	title: "Entitlements Configuration",
	description: "Manage global features, limits, and plan configurations",
}

export default async function EntitlementsConfigPage() {
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
					{ href: "/admin/entitlements/config", label: "Configuration" },
				]}
			/>
			<div className="container mx-auto px-5 py-8">
				<div className="mb-8">
					<h1 className="text-3xl font-bold tracking-tight mb-2">
						Entitlements Configuration
					</h1>
					<p className="text-muted-foreground">
						Manage global features, limits, and configure which features and
						limits are available in each plan.
					</p>
				</div>

				<ConfigManagementClient />
			</div>
		</>
	)
}
