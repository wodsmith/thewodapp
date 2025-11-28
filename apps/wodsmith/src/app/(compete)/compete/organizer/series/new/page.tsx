import "server-only"
import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { getUserOrganizingTeams } from "@/utils/get-user-organizing-teams"
import { OrganizerSeriesForm } from "./_components/organizer-series-form"

export const metadata: Metadata = {
	title: "Create Series - Compete",
	description: "Create a new competition series",
}

interface NewSeriesPageProps {
	searchParams: Promise<{
		teamId?: string
	}>
}

export default async function NewSeriesPage({
	searchParams,
}: NewSeriesPageProps) {
	const { teamId: selectedTeamId } = await searchParams
	const organizingTeams = await getUserOrganizingTeams()

	// Use selected team or first team as default
	const activeTeamId = selectedTeamId || organizingTeams[0]?.id

	if (!activeTeamId) {
		return null // Layout handles no access case
	}

	return (
		<div className="container mx-auto px-4 py-8">
			<div className="max-w-2xl mx-auto">
				{/* Header */}
				<div className="mb-8">
					<Link
						href="/compete/organizer/series"
						className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
					>
						<ArrowLeft className="h-4 w-4" />
						Back to Series
					</Link>
					<h1 className="text-3xl font-bold">Create Series</h1>
					<p className="text-muted-foreground mt-1">
						Organize related competitions into a series
					</p>
				</div>

				{/* Form */}
				<OrganizerSeriesForm
					teams={organizingTeams}
					selectedTeamId={activeTeamId}
				/>
			</div>
		</div>
	)
}
