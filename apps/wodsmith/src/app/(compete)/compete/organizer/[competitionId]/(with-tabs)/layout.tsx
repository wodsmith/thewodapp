import "server-only"
import { eq } from "drizzle-orm"
import { notFound } from "next/navigation"
import { getDb } from "@/db"
import { competitionGroupsTable } from "@/db/schema"
import { getCompetition } from "@/server/competitions"
import { OrganizerBreadcrumb } from "../../_components/organizer-breadcrumb"
import { CompetitionHeader } from "../_components/competition-header"
import { CompetitionTabs } from "../_components/competition-tabs"

interface CompetitionTabsLayoutProps {
	children: React.ReactNode
	params: Promise<{
		competitionId: string
	}>
}

export default async function CompetitionTabsLayout({
	children,
	params,
}: CompetitionTabsLayoutProps) {
	const { competitionId } = await params
	const db = getDb()

	// Get competition (parent layout already validated access)
	const competition = await getCompetition(competitionId)

	if (!competition) {
		notFound()
	}

	// Fetch group for series-aware breadcrumbs
	const group = competition.groupId
		? await db.query.competitionGroupsTable.findFirst({
				where: eq(competitionGroupsTable.id, competition.groupId),
			})
		: null

	// Build breadcrumb segments - always show series if competition belongs to one
	const breadcrumbSegments = group
		? [
				{ label: "Series", href: "/compete/organizer/series" },
				{ label: group.name, href: `/compete/organizer/series/${group.id}` },
				{ label: competition.name },
			]
		: [{ label: competition.name }]

	return (
		<div className="container mx-auto px-4 py-8">
			<div className="flex flex-col gap-6">
				{/* Breadcrumb */}
				<OrganizerBreadcrumb segments={breadcrumbSegments} />

				{/* Competition Header */}
				<CompetitionHeader
					competition={{
						id: competition.id,
						name: competition.name,
						slug: competition.slug,
						description: competition.description,
						startDate: competition.startDate,
						endDate: competition.endDate,
						registrationOpensAt: competition.registrationOpensAt,
						registrationClosesAt: competition.registrationClosesAt,
						visibility: competition.visibility,
						status: competition.status,
					}}
				/>

				{/* Navigation Tabs */}
				<CompetitionTabs competitionId={competition.id} />

				{/* Page Content */}
				{children}
			</div>
		</div>
	)
}
