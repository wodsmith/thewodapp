import "server-only"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ZSAError } from "@repo/zsa"
import { TEAM_PERMISSIONS } from "@/db/schema"
import { getCompetitionDivisionsWithCounts } from "@/server/competition-divisions"
import { getCompetition } from "@/server/competitions"
import { listScalingGroups } from "@/server/scaling-groups"
import { requireTeamPermission } from "@/utils/team-auth"
import { OrganizerBreadcrumb } from "../../_components/organizer-breadcrumb"
import { OrganizerDivisionManager } from "./_components/organizer-division-manager"

interface CompetitionDivisionsPageProps {
	params: Promise<{
		competitionId: string
	}>
}

export async function generateMetadata({
	params,
}: CompetitionDivisionsPageProps): Promise<Metadata> {
	const { competitionId } = await params
	const competition = await getCompetition(competitionId)

	if (!competition) {
		return {
			title: "Competition Not Found",
		}
	}

	return {
		title: `${competition.name} - Divisions`,
		description: `Manage divisions for ${competition.name}`,
	}
}

export default async function CompetitionDivisionsPage({
	params,
}: CompetitionDivisionsPageProps) {
	const { competitionId } = await params

	// Get competition
	const competition = await getCompetition(competitionId)

	if (!competition) {
		notFound()
	}

	// Check if user has permission on the organizing team
	try {
		await requireTeamPermission(
			competition.organizingTeamId,
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

	// Parallel fetch: divisions with counts and available scaling groups
	const [{ scalingGroupId, divisions }, scalingGroups] = await Promise.all([
		getCompetitionDivisionsWithCounts({ competitionId }),
		listScalingGroups({ teamId: competition.organizingTeamId, includeSystem: true }),
	])

	return (
		<div className="container mx-auto px-4 py-8">
			<div className="flex flex-col gap-6">
				{/* Header */}
				<div>
					<OrganizerBreadcrumb
						segments={[
							{ label: competition.name, href: `/compete/organizer/${competition.id}` },
							{ label: "Divisions" },
						]}
					/>
					<h1 className="text-3xl font-bold">Competition Divisions</h1>
					<p className="text-muted-foreground mt-1">
						Manage the divisions for this competition
					</p>
				</div>

				{/* Navigation Tabs */}
				<div className="border-b">
					<nav className="flex gap-4">
						<Link
							href={`/compete/organizer/${competition.id}`}
							className="px-4 py-2 border-b-2 border-transparent hover:border-muted-foreground/50 text-muted-foreground hover:text-foreground transition-colors"
						>
							Overview
						</Link>
						<span className="px-4 py-2 border-b-2 border-primary font-medium">
							Divisions
						</span>
						<Link
							href={`/compete/organizer/${competition.id}/athletes`}
							className="px-4 py-2 border-b-2 border-transparent hover:border-muted-foreground/50 text-muted-foreground hover:text-foreground transition-colors"
						>
							Athletes
						</Link>
					</nav>
				</div>

				<OrganizerDivisionManager
					key={scalingGroupId ?? "no-divisions"}
					teamId={competition.organizingTeamId}
					competitionId={competition.id}
					divisions={divisions}
					scalingGroupId={scalingGroupId}
					scalingGroups={scalingGroups}
				/>
			</div>
		</div>
	)
}
