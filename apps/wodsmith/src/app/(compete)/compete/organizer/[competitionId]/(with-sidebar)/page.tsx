import "server-only"
import { DollarSign, FileText, TrendingUp, Users } from "lucide-react"
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
import { getCompetitionRevenueStats } from "@/server/commerce"
import { getHeatsForCompetition } from "@/server/competition-heats"
import { getCompetitionWorkouts } from "@/server/competition-workouts"
import {
	getCompetition,
	getCompetitionRegistrations,
} from "@/server/competitions"
import { formatUTCDateFull } from "@/utils/date-utils"
import { QuickActionsEvents } from "./_components/quick-actions-events"
import { QuickActionsHeats } from "./_components/quick-actions-heats"

interface CompetitionDetailPageProps {
	params: Promise<{
		competitionId: string
	}>
}

export async function generateMetadata({
	params,
}: CompetitionDetailPageProps): Promise<Metadata> {
	const { competitionId } = await params
	const competition = await getCompetition(competitionId)

	if (!competition) {
		return {
			title: "Competition Not Found",
		}
	}

	return {
		title: `${competition.name} - Organizer`,
		description: `Manage ${competition.name}`,
	}
}

export default async function CompetitionDetailPage({
	params,
}: CompetitionDetailPageProps) {
	const { competitionId } = await params

	// Get competition (layout already validated access)
	const competition = await getCompetition(competitionId)

	if (!competition) {
		notFound()
	}

	// Fetch registrations, revenue stats, events, and heats
	const [registrations, revenueStats, events, heats] = await Promise.all([
		getCompetitionRegistrations(competitionId),
		getCompetitionRevenueStats(competitionId),
		getCompetitionWorkouts(competitionId),
		getHeatsForCompetition(competitionId),
	])

	// Note: formatDateTime uses local time for timestamps like createdAt
	const formatDateTime = (date: Date) => {
		return new Date(date).toLocaleDateString(undefined, {
			year: "numeric",
			month: "long",
			day: "numeric",
			hour: "numeric",
			minute: "2-digit",
		})
	}

	return (
		<div className="flex flex-col gap-6">
			{/* Quick Actions Row */}
			{events.length > 0 && (
				<div className="grid gap-4 md:grid-cols-2">
					<QuickActionsEvents
						events={events}
						organizingTeamId={competition.organizingTeamId}
					/>
					<QuickActionsHeats
						events={events}
						heats={heats}
						organizingTeamId={competition.organizingTeamId}
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
						<p className="text-sm text-muted-foreground whitespace-pre-wrap">
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
								Competition Dates
							</div>
							<div className="text-sm mt-1">
								{formatUTCDateFull(competition.startDate)} -{" "}
								{formatUTCDateFull(competition.endDate)}
							</div>
						</div>
						<div>
							<div className="text-sm font-medium text-muted-foreground">
								Slug
							</div>
							<div className="text-sm font-mono mt-1">{competition.slug}</div>
						</div>
					</div>

					<div>
						<div className="text-sm font-medium text-muted-foreground">
							Created
						</div>
						<div className="text-sm mt-1">
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
									<div className="text-sm mt-1">
										{formatDateTime(competition.registrationOpensAt)}
									</div>
								</div>
								<div>
									<div className="text-sm font-medium text-muted-foreground">
										Registration Closes
									</div>
									<div className="text-sm mt-1">
										{formatDateTime(competition.registrationClosesAt)}
									</div>
								</div>
							</div>
							<div>
								<div className="text-sm font-medium text-muted-foreground">
									Status
								</div>
								<div className="text-sm mt-1">
									{new Date() < new Date(competition.registrationOpensAt)
										? "Not yet open"
										: new Date() > new Date(competition.registrationClosesAt)
											? "Closed"
											: "Open"}
								</div>
							</div>
						</>
					) : (
						<div className="text-center py-6">
							<p className="text-sm text-muted-foreground">
								No registration window configured
							</p>
							<Link href={`/compete/organizer/${competition.id}/edit`}>
								<Button variant="outline" size="sm" className="mt-2">
									Configure Registration
								</Button>
							</Link>
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
						<Link href={`/compete/organizer/${competition.id}/athletes`}>
							<Button variant="outline" size="sm">
								<Users className="h-4 w-4 mr-2" />
								View All
							</Button>
						</Link>
					</CardHeader>
					<CardContent>
						{registrations.length === 0 ? (
							<div className="text-center py-8">
								<p className="text-muted-foreground text-sm">
									No athletes have registered yet
								</p>
							</div>
						) : (
							<div className="flex items-center gap-4">
								<div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/10">
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
						<Link href={`/compete/organizer/${competition.id}/revenue`}>
							<Button variant="outline" size="sm">
								<TrendingUp className="h-4 w-4 mr-2" />
								Details
							</Button>
						</Link>
					</CardHeader>
					<CardContent>
						{revenueStats.purchaseCount === 0 ? (
							<div className="text-center py-8">
								<p className="text-muted-foreground text-sm">
									No paid registrations yet
								</p>
							</div>
						) : (
							<div className="flex items-center gap-4">
								<div className="flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10">
									<DollarSign className="h-8 w-8 text-green-600" />
								</div>
								<div>
									<div className="text-3xl font-bold text-green-600">
										${(revenueStats.totalOrganizerNetCents / 100).toFixed(2)}
									</div>
									<div className="text-sm text-muted-foreground">
										net from {revenueStats.purchaseCount}{" "}
										{revenueStats.purchaseCount === 1
											? "purchase"
											: "purchases"}
									</div>
								</div>
							</div>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	)
}
