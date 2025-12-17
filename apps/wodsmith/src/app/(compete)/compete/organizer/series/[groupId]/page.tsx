import "server-only"
import { ZSAError } from "@repo/zsa"
import { Plus } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import { TEAM_PERMISSIONS } from "@/db/schema"
import { getCompetitionGroup, getCompetitions } from "@/server/competitions"
import { requireTeamPermission } from "@/utils/team-auth"
import { OrganizerBreadcrumb } from "../../_components/organizer-breadcrumb"
import { OrganizerCompetitionsList } from "../../_components/organizer-competitions-list"
import { OrganizerSeriesActions } from "./_components/organizer-series-actions"

interface SeriesDetailPageProps {
	params: Promise<{
		groupId: string
	}>
}

export async function generateMetadata({
	params,
}: SeriesDetailPageProps): Promise<Metadata> {
	const { groupId } = await params
	const group = await getCompetitionGroup(groupId)

	if (!group) {
		return {
			title: "Series Not Found",
		}
	}

	return {
		title: `${group.name} - Series`,
		description: group.description || `Manage ${group.name} series`,
	}
}

export default async function SeriesDetailPage({
	params,
}: SeriesDetailPageProps) {
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

	// Get all competitions in this series
	const allCompetitions = await getCompetitions(group.organizingTeamId)
	const seriesCompetitions = allCompetitions.filter(
		(c) => c.groupId === groupId,
	)

	return (
		<div className="container mx-auto px-4 py-8">
			<div className="flex flex-col gap-6">
				{/* Header */}
				<div>
					<OrganizerBreadcrumb
						segments={[
							{ label: "Series", href: "/compete/organizer/series" },
							{ label: group.name },
						]}
					/>
					<div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
						<div>
							<h1 className="text-3xl font-bold">{group.name}</h1>
							{group.description && (
								<p className="text-muted-foreground mt-1">
									{group.description}
								</p>
							)}
						</div>
						<div className="flex items-center gap-2">
							<Link href={`/compete/organizer/new?groupId=${groupId}`}>
								<Button>
									<Plus className="h-4 w-4 mr-2" />
									Add Competition
								</Button>
							</Link>
							<OrganizerSeriesActions
								groupId={groupId}
								organizingTeamId={group.organizingTeamId}
								competitionCount={seriesCompetitions.length}
							/>
						</div>
					</div>
				</div>

				{/* Series Info Card */}
				<Card>
					<CardHeader>
						<CardTitle>Series Details</CardTitle>
						<CardDescription>Information about this series</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="grid gap-4 md:grid-cols-2">
							<div>
								<div className="text-sm font-medium text-muted-foreground">
									Slug
								</div>
								<div className="text-sm font-mono mt-1">{group.slug}</div>
							</div>
							<div>
								<div className="text-sm font-medium text-muted-foreground">
									Competitions
								</div>
								<div className="text-sm mt-1">
									{seriesCompetitions.length} competition
									{seriesCompetitions.length !== 1 ? "s" : ""}
								</div>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Competitions in Series */}
				<div>
					<h2 className="text-xl font-bold mb-4">Competitions in Series</h2>
					<OrganizerCompetitionsList
						competitions={seriesCompetitions}
						groups={[{ ...group, competitionCount: seriesCompetitions.length }]}
						teamId={group.organizingTeamId}
					/>
				</div>
			</div>
		</div>
	)
}
