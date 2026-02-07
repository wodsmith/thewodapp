import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { CompetitionRow } from "@/components/competition-row"
import { CompetitionSearch } from "@/components/competition-search"
import { CompetitionSection } from "@/components/competition-section"
import { getSessionFn } from "@/server-fns/auth-fns"
import {
	type CompetitionWithOrganizingTeam,
	getPublicCompetitionsFn,
} from "@/server-fns/competition-fns"
import { getTodayInTimezone } from "@/utils/date-utils"

type CompeteSearch = {
	q?: string
	past?: boolean
}

export const Route = createFileRoute("/compete/")({
	component: CompetePage,
	staleTime: 30_000, // Cache for 30 seconds - competition list doesn't change frequently
	validateSearch: (search: Record<string, unknown>): CompeteSearch => ({
		q: typeof search.q === "string" ? search.q : undefined,
		past: search.past === "true" || search.past === true,
	}),
	loader: async () => {
		const [result, session] = await Promise.all([
			getPublicCompetitionsFn({ data: {} }),
			getSessionFn(),
		])
		return {
			competitions: result.competitions,
			isAuthenticated: session !== null,
		}
	},
})

// Helper to determine competition status
// Compares YYYY-MM-DD date strings using the competition's timezone
// so registration closes at 11:59pm in the competition's local time
function getCompetitionStatus(comp: CompetitionWithOrganizingTeam) {
	const { startDate, endDate, registrationOpensAt, registrationClosesAt } =
		comp
	const today = getTodayInTimezone(comp.timezone ?? "America/Denver")

	// Past if already ended (end date is before today)
	if (endDate < today) {
		return "past"
	}

	// Active if currently happening
	if (startDate <= today && endDate >= today) {
		return "active"
	}

	// Registration open if starts in future AND registration window is active
	if (
		startDate > today &&
		registrationOpensAt &&
		registrationClosesAt &&
		registrationOpensAt <= today &&
		registrationClosesAt >= today
	) {
		return "registration-open"
	}

	// Registration closed if starts in future AND reg window closed
	if (
		startDate > today &&
		registrationOpensAt &&
		registrationClosesAt &&
		registrationClosesAt < today
	) {
		return "registration-closed"
	}

	// Coming soon if starts in future AND (no reg window OR reg not yet open)
	if (startDate > today && (!registrationOpensAt || registrationOpensAt > today)) {
		return "coming-soon"
	}

	// Default fallback
	return "coming-soon"
}

type CompetitionStatus =
	| "registration-open"
	| "active"
	| "coming-soon"
	| "registration-closed"
	| "past"

function CompetePage() {
	const { competitions, isAuthenticated } = Route.useLoaderData()
	const { q: searchQuery, past } = Route.useSearch()
	const navigate = useNavigate({ from: Route.fullPath })
	const showPast = past === true

	// Handlers for search state updates
	const handleSearchChange = (value: string) => {
		navigate({
			search: (prev) => ({ ...prev, q: value || undefined }),
		})
	}

	const handleShowPastChange = (value: boolean) => {
		navigate({
			search: (prev) => ({ ...prev, past: value || undefined }),
		})
	}

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

	// Filter out past competitions unless showPast is true
	const visibleCompetitions = showPast
		? filteredCompetitions
		: filteredCompetitions.filter(
				(comp) => getCompetitionStatus(comp) !== "past",
			)

	// Sort competitions by start date
	const sortedCompetitions = [...visibleCompetitions].sort(
		(a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
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

			<CompetitionSearch
				search={searchQuery || ""}
				showPast={showPast}
				onSearchChange={handleSearchChange}
				onShowPastChange={handleShowPastChange}
			/>

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
							status={getCompetitionStatus(comp) as CompetitionStatus}
							isAuthenticated={isAuthenticated}
						/>
					))}
				</CompetitionSection>
			)}
		</div>
	)
}
