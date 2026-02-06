/**
 * Competition Organizer Overview Page
 *
 * Dashboard/overview page for organizers to see competition stats,
 * details, and quick actions including publishing controls.
 *
 * This file uses top-level imports for server-only modules.
 */

import { createFileRoute, getRouteApi, Link } from "@tanstack/react-router"
import { FileText, TrendingUp, Users } from "lucide-react"
import { useEffect } from "react"
import { SetupChecklist } from "@/components/setup-checklist"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import { getChecklistStatusFn } from "@/server-fns/checklist-fns"
import { getCompetitionRevenueStatsFn } from "@/server-fns/commerce-fns"
import {
	getCompetitionByIdFn,
	getCompetitionRegistrationsFn,
} from "@/server-fns/competition-detail-fns"
import { getCompetitionEventsFn } from "@/server-fns/competition-event-fns"
import { getHeatsForCompetitionFn } from "@/server-fns/competition-heats-fns"
import { getCompetitionWorkoutsFn } from "@/server-fns/competition-workouts-fns"
import {
	type AllEventsResultsStatusResponse,
	getDivisionResultsStatusFn,
} from "@/server-fns/division-results-fns"
import { getOnboardingStateFn } from "@/server-fns/onboarding-fns"
import { useOnboardingStore } from "@/state/onboarding"
import {
	formatUTCDateFull,
	getLocalDateKey,
	isSameUTCDay,
} from "@/utils/date-utils"
import { QuickActionsDivisionResults } from "./-components/quick-actions-division-results"
import { QuickActionsEvents } from "./-components/quick-actions-events"
import { QuickActionsHeats } from "./-components/quick-actions-heats"
import { QuickActionsSubmissionWindows } from "./-components/quick-actions-submission-windows"

// Get parent route API to access its loader data
const parentRoute = getRouteApi("/compete/organizer/$competitionId")

export const Route = createFileRoute("/compete/organizer/$competitionId/")({
	component: CompetitionOverviewPage,
	loader: async ({ params }) => {
		// Get competition from parent route to access organizingTeamId
		// We need to fetch it here since we can't access parent loader data in child loader
		const { competition } = await getCompetitionByIdFn({
			data: { competitionId: params.competitionId },
		})

		if (!competition) {
			throw new Error("Competition not found")
		}

		const isOnline = competition.competitionType === "online"

		// Parallel fetch: registrations, revenue stats, events, heats/submission windows, division results, checklist, and onboarding state
		const [
			registrationsResult,
			revenueResult,
			eventsResult,
			heatsResult,
			divisionResultsResult,
			competitionEventsResult,
			checklistStatus,
			onboardingResult,
		] = await Promise.all([
			getCompetitionRegistrationsFn({
				data: { competitionId: params.competitionId },
			}),
			getCompetitionRevenueStatsFn({
				data: { competitionId: params.competitionId },
			}),
			getCompetitionWorkoutsFn({
				data: {
					competitionId: params.competitionId,
					teamId: competition.organizingTeamId,
				},
			}),
			// Only fetch heats for in-person competitions
			isOnline
				? Promise.resolve({ heats: [] })
				: getHeatsForCompetitionFn({
						data: { competitionId: params.competitionId },
					}),
			getDivisionResultsStatusFn({
				data: {
					competitionId: params.competitionId,
					organizingTeamId: competition.organizingTeamId,
				},
			}),
			// Fetch competition events (submission windows) for online competitions
			isOnline
				? getCompetitionEventsFn({
						data: { competitionId: params.competitionId },
					})
				: Promise.resolve({ events: [] }),
			getChecklistStatusFn({
				data: {
					competitionId: params.competitionId,
					organizingTeamId: competition.organizingTeamId,
				},
			}),
			getOnboardingStateFn({
				data: {
					teamId: competition.organizingTeamId,
					competitionId: params.competitionId,
				},
			}),
		])

		return {
			registrations: registrationsResult.registrations,
			revenueStats: revenueResult.stats,
			events: eventsResult.workouts,
			heats: heatsResult.heats,
			// When called without eventId, the server returns AllEventsResultsStatusResponse
			divisionResults: divisionResultsResult as AllEventsResultsStatusResponse,
			organizingTeamId: competition.organizingTeamId,
			competitionEvents: competitionEventsResult.events,
			isOnline,
			timezone: competition.timezone || "America/Denver",
			checklistStatus,
			onboardingStates: onboardingResult.states,
		}
	},
})

function formatCents(cents: number): string {
	return `$${(cents / 100).toFixed(2)}`
}

function CompetitionOverviewPage() {
	const {
		registrations,
		revenueStats,
		events,
		heats,
		divisionResults,
		organizingTeamId,
		competitionEvents,
		isOnline,
		timezone,
		checklistStatus,
		onboardingStates,
	} = Route.useLoaderData()
	// Get competition from parent layout loader data
	const { competition } = parentRoute.useLoaderData()

	// Hydrate onboarding store from server data
	const hydrate = useOnboardingStore((s) => s.hydrate)
	const isLoaded = useOnboardingStore((s) => s.isLoaded)
	useEffect(() => {
		if (!isLoaded) {
			hydrate(onboardingStates)
		}
	}, [hydrate, isLoaded, onboardingStates])

	// Format datetime for display (local time for timestamps, or YYYY-MM-DD strings)
	const formatDateTime = (date: string | Date) => {
		// Handle YYYY-MM-DD string format
		if (typeof date === "string") {
			const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/)
			if (match) {
				const [, yearStr, monthStr, dayStr] = match
				const year = Number(yearStr)
				const month = Number(monthStr)
				const day = Number(dayStr)
				const months = [
					"January",
					"February",
					"March",
					"April",
					"May",
					"June",
					"July",
					"August",
					"September",
					"October",
					"November",
					"December",
				]
				return `${months[month - 1]} ${day}, ${year}`
			}
		}
		return new Date(date).toLocaleDateString(undefined, {
			year: "numeric",
			month: "long",
			day: "numeric",
			hour: "numeric",
			minute: "2-digit",
		})
	}

	// Calculate registration status using string comparison for YYYY-MM-DD dates
	const getRegistrationStatusText = () => {
		if (!competition.registrationOpensAt || !competition.registrationClosesAt) {
			return null
		}
		const todayStr = getLocalDateKey(new Date())
		if (todayStr < competition.registrationOpensAt) {
			return "Not yet open"
		}
		if (todayStr > competition.registrationClosesAt) {
			return "Closed"
		}
		return "Open"
	}

	return (
		<>
			{/* Setup Checklist */}
			<SetupChecklist
				competitionId={competition.id}
				teamId={organizingTeamId}
				checklistStatus={checklistStatus}
				competitionSlug={competition.slug}
			/>

			{/* Publishing Controls - Full Width Stacked Layout */}
			{events.length > 0 && (
				<div className="space-y-4">
					{/* Division Results - Full Width */}
					{divisionResults.totalCombinations > 0 && (
						<QuickActionsDivisionResults
							competitionId={competition.id}
							organizingTeamId={organizingTeamId}
							divisionResults={divisionResults}
						/>
					)}

					{/* Submission Windows (online) or Heat Schedules (in-person) */}
					{isOnline ? (
						<QuickActionsSubmissionWindows
							competitionId={competition.id}
							events={events}
							competitionEvents={competitionEvents}
							timezone={timezone}
						/>
					) : (
						<QuickActionsHeats
							events={events}
							heats={heats}
							organizingTeamId={organizingTeamId}
							competitionSlug={competition.slug}
						/>
					)}

					{/* Events - Full Width */}
					<QuickActionsEvents
						events={events}
						organizingTeamId={organizingTeamId}
						competitionId={competition.id}
					/>
				</div>
			)}

			{/* Description Card */}
			{competition.description && (
				<Card>
					<CardHeader className="flex flex-row items-center gap-2 pb-3">
						<FileText className="h-5 w-5 text-muted-foreground" />
						<CardTitle>Description</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="whitespace-pre-wrap text-sm text-muted-foreground">
							{competition.description}
						</p>
					</CardContent>
				</Card>
			)}

			{/* Competition Details Card */}
			<Card>
				<CardHeader>
					<CardTitle>Competition Details</CardTitle>
					<CardDescription>
						Basic information about this competition
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="grid gap-4 md:grid-cols-2">
						<div>
							<div className="text-sm font-medium text-muted-foreground">
								{isSameUTCDay(competition.startDate, competition.endDate)
									? "Competition Date"
									: "Competition Dates"}
							</div>
							<div className="mt-1 text-sm">
								{isSameUTCDay(competition.startDate, competition.endDate)
									? formatUTCDateFull(competition.startDate)
									: `${formatUTCDateFull(competition.startDate)} - ${formatUTCDateFull(competition.endDate)}`}
							</div>
						</div>
						<div>
							<div className="text-sm font-medium text-muted-foreground">
								Slug
							</div>
							<div className="mt-1 font-mono text-sm">{competition.slug}</div>
						</div>
					</div>

					<div>
						<div className="text-sm font-medium text-muted-foreground">
							Created
						</div>
						<div className="mt-1 text-sm">
							{formatDateTime(competition.createdAt)}
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Registration Window Card */}
			<Card>
				<CardHeader>
					<CardTitle>Registration</CardTitle>
					<CardDescription>Registration window and settings</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					{competition.registrationOpensAt &&
					competition.registrationClosesAt ? (
						<>
							<div className="grid gap-4 md:grid-cols-2">
								<div>
									<div className="text-sm font-medium text-muted-foreground">
										Registration Opens
									</div>
									<div className="mt-1 text-sm">
										{formatDateTime(competition.registrationOpensAt)}
									</div>
								</div>
								<div>
									<div className="text-sm font-medium text-muted-foreground">
										Registration Closes
									</div>
									<div className="mt-1 text-sm">
										{formatDateTime(competition.registrationClosesAt)}
									</div>
								</div>
							</div>
							<div>
								<div className="text-sm font-medium text-muted-foreground">
									Status
								</div>
								<div className="mt-1 text-sm">
									{getRegistrationStatusText()}
								</div>
							</div>
						</>
					) : (
						<div className="py-6 text-center">
							<p className="text-sm text-muted-foreground">
								No registration window configured
							</p>
							<a href={`/compete/organizer/${competition.id}/edit`}>
								<Button variant="outline" size="sm" className="mt-2">
									Configure Registration
								</Button>
							</a>
						</div>
					)}
				</CardContent>
			</Card>

			{/* Stats Row */}
			<div className="grid gap-4 md:grid-cols-2">
				{/* Registrations Card */}
				<Card>
					<CardHeader className="flex flex-row items-center justify-between">
						<div>
							<CardTitle>Registrations</CardTitle>
							<CardDescription>Athletes registered</CardDescription>
						</div>
						<Link
							to="/compete/organizer/$competitionId/athletes"
							params={{ competitionId: competition.id }}
						>
							<Button variant="outline" size="sm">
								<Users className="mr-2 h-4 w-4" />
								View All
							</Button>
						</Link>
					</CardHeader>
					<CardContent>
						{registrations.length === 0 ? (
							<div className="py-8 text-center">
								<p className="text-sm text-muted-foreground">
									No athletes have registered yet
								</p>
							</div>
						) : (
							<div className="flex items-center gap-4">
								<div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
									<Users className="h-8 w-8 text-primary" />
								</div>
								<div>
									<div className="text-3xl font-bold">
										{registrations.length}
									</div>
									<div className="text-sm text-muted-foreground">
										{registrations.length === 1
											? "registration"
											: "registrations"}
									</div>
								</div>
							</div>
						)}
					</CardContent>
				</Card>

				{/* Revenue Summary Card */}
				<Card>
					<CardHeader className="flex flex-row items-center justify-between">
						<div>
							<CardTitle>Revenue</CardTitle>
							<CardDescription>Paid registrations</CardDescription>
						</div>
						<Link
							to="/compete/organizer/$competitionId/revenue"
							params={{ competitionId: competition.id }}
						>
							<Button variant="outline" size="sm">
								<TrendingUp className="mr-2 h-4 w-4" />
								Details
							</Button>
						</Link>
					</CardHeader>
					<CardContent>
						{revenueStats.purchaseCount > 0 ? (
							<div className="space-y-3">
								<div className="flex items-center justify-between">
									<span className="text-sm text-muted-foreground">
										Gross Revenue
									</span>
									<span className="font-medium">
										{formatCents(revenueStats.totalGrossCents)}
									</span>
								</div>
								<div className="flex items-center justify-between">
									<span className="text-sm text-muted-foreground">
										Your Net Revenue
									</span>
									<span className="font-bold text-green-600">
										{formatCents(revenueStats.totalOrganizerNetCents)}
									</span>
								</div>
								<div className="pt-2 border-t">
									<div className="text-sm text-muted-foreground">
										{revenueStats.purchaseCount} paid{" "}
										{revenueStats.purchaseCount === 1
											? "registration"
											: "registrations"}
									</div>
								</div>
							</div>
						) : (
							<div className="py-4 text-center">
								<p className="text-sm text-muted-foreground">
									No paid registrations yet
								</p>
							</div>
						)}
					</CardContent>
				</Card>
			</div>
		</>
	)
}
