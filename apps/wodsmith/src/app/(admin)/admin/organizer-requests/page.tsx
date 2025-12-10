import "server-only"
import type { Metadata } from "next"
import { PageHeader } from "@/components/page-header"
import { requireAdmin } from "@/utils/auth"
import { getPendingOrganizerRequests } from "@/server/organizer-onboarding"
import { OrganizerRequestsTable } from "./_components/organizer-requests-table"

export const metadata: Metadata = {
	title: "Organizer Requests - Admin",
	description: "Review and manage organizer applications",
}

export default async function OrganizerRequestsPage() {
	await requireAdmin()

	const requests = await getPendingOrganizerRequests()

	return (
		<div className="max-w-4xl">
			<PageHeader
				items={[
					{ href: "/admin", label: "Admin" },
					{ href: "/admin/organizer-requests", label: "Organizer Requests" },
				]}
			/>

			<div className="space-y-6">
				<div>
					<h1 className="text-3xl font-bold">Organizer Requests</h1>
					<p className="mt-1 text-muted-foreground">
						Review applications from teams wanting to host competitions
					</p>
				</div>

				<OrganizerRequestsTable requests={requests} />
			</div>
		</div>
	)
}
