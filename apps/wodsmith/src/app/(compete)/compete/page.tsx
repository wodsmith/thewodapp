import "server-only"
import type { Metadata } from "next"
import { Suspense } from "react"
import { getPublicCompetitions } from "@/server/competitions"
import { getSessionFromCookie } from "@/utils/auth"
import { CompetitionRow } from "./_components/competition-row"
import { CompetitionSearch } from "./_components/competition-search"
import { CompetitionSection } from "./_components/competition-section"

export const metadata: Metadata = {
	title: "Compete | WODsmith",
	description: "Browse and register for CrossFit competitions.",
}

interface CompetePageProps {
	searchParams: Promise<{ q?: string }>
}

export default async function CompetePage({ searchParams }: CompetePageProps) {
	const { q: searchQuery } = await searchParams
	const [competitions, session] = await Promise.all([
		getPublicCompetitions(),
		getSessionFromCookie(),
	])

	const isAuthenticated = !!session?.user
	const now = new Date()

	// Filter by search query if provided
	const filteredCompetitions = searchQuery
		? competitions.filter(
			(comp) =>
				comp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				comp.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
				comp.organizingTeam?.name
					.toLowerCase()
					.includes(searchQuery.toLowerCase()),
		)
		: competitions

	// Categorize competitions
	const registrationOpen = filteredCompetitions.filter((comp) => {
		const startDate = new Date(comp.startDate)
		const regOpens = comp.registrationOpensAt
			? new Date(comp.registrationOpensAt)
			: null
		const regCloses = comp.registrationClosesAt
			? new Date(comp.registrationClosesAt)
			: null

		// Registration is open if: starts in future AND registration window is active
		return (
			startDate > now &&
			regOpens &&
			regCloses &&
			regOpens <= now &&
			regCloses > now
		)
	})

	const active = filteredCompetitions.filter((comp) => {
		const startDate = new Date(comp.startDate)
		const endDate = new Date(comp.endDate)
		return startDate <= now && endDate >= now
	})

	const registrationClosed = filteredCompetitions.filter((comp) => {
		const startDate = new Date(comp.startDate)
		const regOpens = comp.registrationOpensAt
			? new Date(comp.registrationOpensAt)
			: null
		const regCloses = comp.registrationClosesAt
			? new Date(comp.registrationClosesAt)
			: null

		// Registration closed: starts in future AND reg window closed
		return (
			startDate > now &&
			regOpens &&
			regCloses &&
			regCloses <= now
		)
	})

	const comingSoon = filteredCompetitions.filter((comp) => {
		const startDate = new Date(comp.startDate)
		const regOpens = comp.registrationOpensAt
			? new Date(comp.registrationOpensAt)
			: null

		// Coming soon: starts in future AND (no reg window OR reg not yet open)
		return startDate > now && (!regOpens || regOpens > now)
	})

	const hasNoCompetitions =
		registrationOpen.length === 0 &&
		active.length === 0 &&
		registrationClosed.length === 0 &&
		comingSoon.length === 0

	return (
		<div className="flex flex-col gap-8">
			<div>
				<h1 className="text-3xl font-bold uppercase">All Competitions</h1>
				<p className="text-muted-foreground mt-1">
					Find and register for CrossFit competitions
				</p>
			</div>

			<Suspense>
				<CompetitionSearch />
			</Suspense>

			{hasNoCompetitions ? (
				<div className="text-center py-12">
					<p className="text-muted-foreground">
						{searchQuery
							? "No competitions match your search."
							: "No competitions available right now."}
					</p>
				</div>
			) : (
				<div className="space-y-8">
					<CompetitionSection
						title="Registration Open"
						count={registrationOpen.length}
						emptyMessage="No competitions accepting registrations right now."
					>
						{registrationOpen.map((comp) => (
							<CompetitionRow
								key={comp.id}
								competition={comp}
								status="registration-open"
								isAuthenticated={isAuthenticated}
							/>
						))}
					</CompetitionSection>

					<CompetitionSection
						title="Active Now"
						count={active.length}
						emptyMessage="No competitions in progress."
					>
						{active.map((comp) => (
							<CompetitionRow
								key={comp.id}
								competition={comp}
								status="active"
								isAuthenticated={isAuthenticated}
							/>
						))}
					</CompetitionSection>

					<CompetitionSection
						title="Registration Closed"
						count={registrationClosed.length}
						emptyMessage="No competitions with closed registration."
					>
						{registrationClosed.map((comp) => (
							<CompetitionRow
								key={comp.id}
								competition={comp}
								status="registration-closed"
								isAuthenticated={isAuthenticated}
							/>
						))}
					</CompetitionSection>

					<CompetitionSection
						title="Coming Soon"
						count={comingSoon.length}
						emptyMessage="No upcoming competitions scheduled."
					>
						{comingSoon.map((comp) => (
							<CompetitionRow
								key={comp.id}
								competition={comp}
								status="coming-soon"
								isAuthenticated={isAuthenticated}
							/>
						))}
					</CompetitionSection>
				</div>
			)}
		</div>
	)
}
