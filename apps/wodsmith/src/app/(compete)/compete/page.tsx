import "server-only"
import type { Metadata } from "next"
import { Suspense } from "react"
import { getPublicCompetitions, getUserUpcomingRegisteredCompetitions } from "@/server/competitions"
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

// Helper to determine competition status
function getCompetitionStatus(comp: any, now: Date) {
	const startDate = new Date(comp.startDate)
	const endDate = new Date(comp.endDate)
	const regOpens = comp.registrationOpensAt ? new Date(comp.registrationOpensAt) : null
	const regCloses = comp.registrationClosesAt ? new Date(comp.registrationClosesAt) : null

	// Active if currently happening
	if (startDate <= now && endDate >= now) {
		return "active"
	}

	// Registration open if starts in future AND registration window is active
	if (
		startDate > now &&
		regOpens &&
		regCloses &&
		regOpens <= now &&
		regCloses > now
	) {
		return "registration-open"
	}

	// Registration closed if starts in future AND reg window closed
	if (
		startDate > now &&
		regOpens &&
		regCloses &&
		regCloses <= now
	) {
		return "registration-closed"
	}

	// Coming soon if starts in future AND (no reg window OR reg not yet open)
	if (startDate > now && (!regOpens || regOpens > now)) {
		return "coming-soon"
	}

	// Default fallback
	return "coming-soon"
}

export default async function CompetePage({ searchParams }: CompetePageProps) {
	const { q: searchQuery } = await searchParams
	const session = await getSessionFromCookie()

	const isAuthenticated = !!session?.user
	const userId = session?.user?.id

	// Fetch competitions and user registrations in parallel
	const [allCompetitions, registeredCompetitions] = await Promise.all([
		getPublicCompetitions(),
		userId ? getUserUpcomingRegisteredCompetitions(userId) : Promise.resolve([]),
	])

	const now = new Date()

	// Filter by search query if provided
	const filteredCompetitions = searchQuery
		? allCompetitions.filter(
			(comp) =>
				comp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				comp.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
				comp.organizingTeam?.name
					.toLowerCase()
					.includes(searchQuery.toLowerCase()),
		)
		: allCompetitions

	// Create a set of registered competition IDs for easy filtering
	const registeredCompIds = new Set(registeredCompetitions.map(c => c.id))

	// Filter out registered competitions from main list
	const unregisteredCompetitions = filteredCompetitions.filter(
		comp => !registeredCompIds.has(comp.id)
	)

	// Sort competitions by start date
	const sortedCompetitions = [...unregisteredCompetitions].sort(
		(a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
	)

	const hasNoCompetitions = sortedCompetitions.length === 0

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

			{/* Registered Competitions Section */}
			{registeredCompetitions.length > 0 && (
				<CompetitionSection
					title="Your Registered Competitions"
					count={registeredCompetitions.length}
				>
					{registeredCompetitions.map((comp) => (
						<CompetitionRow
							key={comp.id}
							competition={comp}
							status={getCompetitionStatus(comp, now) as any}
							isAuthenticated={isAuthenticated}
						/>
					))}
				</CompetitionSection>
			)}

			{/* All Competitions Section */}
			{hasNoCompetitions ? (
				<div className="text-center py-12">
					<p className="text-muted-foreground">
						{searchQuery
							? "No competitions match your search."
							: "No competitions available right now."}
					</p>
				</div>
			) : (
				<CompetitionSection
					title="All Competitions"
					count={sortedCompetitions.length}
				>
					{sortedCompetitions.map((comp) => (
						<CompetitionRow
							key={comp.id}
							competition={comp}
							status={getCompetitionStatus(comp, now) as any}
							isAuthenticated={isAuthenticated}
						/>
					))}
				</CompetitionSection>
			)}
		</div>
	)
}
