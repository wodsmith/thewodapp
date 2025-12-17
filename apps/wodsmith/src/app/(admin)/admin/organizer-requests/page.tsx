import "server-only"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { getAllOrganizerRequests } from "@/server/organizer-onboarding"
import { requireAdmin } from "@/utils/auth"
import { OrganizerRequestsTable } from "./_components/organizer-requests-table"

export const metadata: Metadata = {
	title: "Organizer Requests - Admin",
	description: "Review and manage organizer applications",
}

export default async function OrganizerRequestsPage() {
	const session = await requireAdmin({ doNotThrowError: true })
	if (!session) {
		notFound()
	}

	const requests = await getAllOrganizerRequests({ statusFilter: "all" })

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
