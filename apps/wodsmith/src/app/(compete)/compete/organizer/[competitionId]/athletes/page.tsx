import "server-only"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ZSAError } from "@repo/zsa"
import { TEAM_PERMISSIONS } from "@/db/schema"
import { getCompetitionDivisionsWithCounts } from "@/server/competition-divisions"
import { getCompetition, getCompetitionRegistrations } from "@/server/competitions"
import { requireTeamPermission } from "@/utils/team-auth"
import { OrganizerBreadcrumb } from "../../_components/organizer-breadcrumb"
import { OrganizerRegistrationList } from "./_components/organizer-registration-list"

interface CompetitionAthletesPageProps {
	params: Promise<{
		competitionId: string
	}>
	searchParams: Promise<{
		division?: string
	}>
}

export async function generateMetadata({
	params,
}: CompetitionAthletesPageProps): Promise<Metadata> {
	const { competitionId } = await params
	const competition = await getCompetition(competitionId)

	if (!competition) {
		return {
			title: "Competition Not Found",
		}
	}

	return {
		title: `${competition.name} - Athletes`,
		description: `Manage athletes for ${competition.name}`,
	}
}

export default async function CompetitionAthletesPage({
	params,
	searchParams,
}: CompetitionAthletesPageProps) {
	const { competitionId } = await params
	const { division: divisionFilter } = await searchParams

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

	// Parallel fetch: registrations and divisions for filtering
	const [registrations, { divisions }] = await Promise.all([
		getCompetitionRegistrations(competitionId, divisionFilter),
		getCompetitionDivisionsWithCounts({ competitionId }),
	])

	return (
		<div className="container mx-auto px-4 py-8">
			<div className="flex flex-col gap-6">
				{/* Header */}
				<div>
					<OrganizerBreadcrumb
						segments={[
							{ label: competition.name, href: `/compete/organizer/${competition.id}` },
							{ label: "Athletes" },
						]}
					/>
					<h1 className="text-3xl font-bold">Registered Athletes</h1>
					<p className="text-muted-foreground mt-1">
						{registrations.length} registration{registrations.length !== 1 ? "s" : ""}
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
						<Link
							href={`/compete/organizer/${competition.id}/divisions`}
							className="px-4 py-2 border-b-2 border-transparent hover:border-muted-foreground/50 text-muted-foreground hover:text-foreground transition-colors"
						>
							Divisions
						</Link>
						<Link
							href={`/compete/organizer/${competition.id}/events`}
							className="px-4 py-2 border-b-2 border-transparent hover:border-muted-foreground/50 text-muted-foreground hover:text-foreground transition-colors"
						>
							Events
						</Link>
						<span className="px-4 py-2 border-b-2 border-primary font-medium">
							Athletes
						</span>
					</nav>
				</div>

				<OrganizerRegistrationList
					competitionId={competition.id}
					registrations={registrations}
					divisions={divisions}
					currentDivisionFilter={divisionFilter}
				/>
			</div>
		</div>
	)
}
