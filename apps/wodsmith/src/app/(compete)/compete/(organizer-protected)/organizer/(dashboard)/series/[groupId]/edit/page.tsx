import "server-only"
import { ZSAError } from "@repo/zsa"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { OrganizerBreadcrumb } from "@/app/(compete)/compete/(organizer-protected)/organizer/_components/organizer-breadcrumb"
import { TEAM_PERMISSIONS } from "@/db/schema"
import { getCompetitionGroup } from "@/server/competitions"
import { requireTeamPermission } from "@/utils/team-auth"
import { OrganizerSeriesEditForm } from "./_components/organizer-series-edit-form"

interface EditSeriesPageProps {
	params: Promise<{
		groupId: string
	}>
}

export async function generateMetadata({
	params,
}: EditSeriesPageProps): Promise<Metadata> {
	const { groupId } = await params
	const group = await getCompetitionGroup(groupId)

	if (!group) {
		return {
			title: "Series Not Found",
		}
	}

	return {
		title: `Edit ${group.name} - Series`,
		description: `Edit series details for ${group.name}`,
	}
}

export default async function EditSeriesPage({ params }: EditSeriesPageProps) {
	const { groupId } = await params

	// Get series
	const group = await getCompetitionGroup(groupId)

	if (!group) {
		notFound()
	}

	// Check if user has permission on the organizing team
	try {
		await requireTeamPermission(
			group.organizingTeamId,
			TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
		)
	} catch (error) {
		if (
			error instanceof ZSAError &&
			(error.code === "NOT_AUTHORIZED" || error.code === "FORBIDDEN")
		) {
			notFound()
		}
		throw error
	}

	return (
		<div className="container mx-auto px-4 py-8">
			<div className="max-w-2xl mx-auto">
				{/* Header */}
				<div className="mb-8">
					<OrganizerBreadcrumb
						segments={[
							{ label: "Series", href: "/compete/organizer/series" },
							{
								label: group.name,
								href: `/compete/organizer/series/${groupId}`,
							},
							{ label: "Edit" },
						]}
					/>
					<h1 className="text-3xl font-bold">Edit Series</h1>
					<p className="text-muted-foreground mt-1">Update series details</p>
				</div>

				{/* Form */}
				<OrganizerSeriesEditForm group={group} />
			</div>
		</div>
	)
}
