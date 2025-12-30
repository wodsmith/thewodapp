import "server-only"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { getAllCompetitionsForAdmin } from "@/server/competitions"
import { requireAdmin } from "@/utils/auth"
import { AdminCompetitionsTable } from "./_components/admin-competitions-table"

export const metadata: Metadata = {
	title: "Competitions - Admin",
	description: "View and manage all competitions across all organizers",
}

export default async function AdminCompetitionsPage() {
	const session = await requireAdmin({ doNotThrowError: true })
	if (!session) {
		notFound()
	}

	const competitions = await getAllCompetitionsForAdmin()

	return (
		<div className="max-w-6xl">
			<PageHeader
				items={[
					{ href: "/admin", label: "Admin" },
					{ href: "/admin/competitions", label: "Competitions" },
				]}
			/>

			<div className="space-y-6">
				<div>
					<h1 className="text-3xl font-bold">All Competitions</h1>
					<p className="mt-1 text-muted-foreground">
						Browse and manage competitions from all organizers
					</p>
				</div>

				<AdminCompetitionsTable competitions={competitions} />
			</div>
		</div>
	)
}
