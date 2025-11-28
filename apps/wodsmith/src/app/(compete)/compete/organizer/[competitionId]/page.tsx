import "server-only"
import { eq } from "drizzle-orm"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ExternalLink, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import { getDb } from "@/db"
import { TEAM_PERMISSIONS, competitionGroupsTable } from "@/db/schema"
import { getCompetition, getCompetitionRegistrations } from "@/server/competitions"
import { requireTeamPermission } from "@/utils/team-auth"
import { OrganizerBreadcrumb } from "../_components/organizer-breadcrumb"
import { OrganizerCompetitionActions } from "./_components/organizer-competition-actions"

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
	const db = getDb()

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
	} catch {
		notFound()
	}

	// Fetch group and registrations in parallel
	const [group, registrations] = await Promise.all([
		competition.groupId
			? db.query.competitionGroupsTable.findFirst({
					where: eq(competitionGroupsTable.id, competition.groupId),
				})
			: Promise.resolve(null),
		getCompetitionRegistrations(competitionId),
	])

	const formatDate = (date: Date) => {
		return new Date(date).toLocaleDateString(undefined, {
			year: "numeric",
			month: "long",
			day: "numeric",
		})
	}

	const formatDateTime = (date: Date) => {
		return new Date(date).toLocaleDateString(undefined, {
			year: "numeric",
			month: "long",
			day: "numeric",
			hour: "numeric",
			minute: "2-digit",
		})
	}

	// Build breadcrumb segments
	const breadcrumbSegments = group
		? [
				{ label: "Series", href: "/compete/organizer/series" },
				{ label: group.name, href: `/compete/organizer/series/${group.id}` },
				{ label: competition.name },
			]
		: [{ label: competition.name }]

	return (
		<div className="container mx-auto px-4 py-8">
			<div className="flex flex-col gap-6">
				{/* Breadcrumb and Header */}
				<div>
					<OrganizerBreadcrumb segments={breadcrumbSegments} />
					<div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
						<div className="flex-1 min-w-0">
							<h1 className="text-3xl font-bold">{competition.name}</h1>
							{competition.description && (
								<p className="text-muted-foreground mt-2">
									{competition.description}
								</p>
							)}
						</div>
						<div className="flex items-center gap-2 shrink-0">
							<Link href={`/compete/${competition.slug}`}>
								<Button variant="outline" size="sm">
									<ExternalLink className="h-4 w-4 mr-2" />
									View Public Page
								</Button>
							</Link>
							<OrganizerCompetitionActions
								competitionId={competition.id}
								organizingTeamId={competition.organizingTeamId}
							/>
						</div>
					</div>
				</div>

				{/* Navigation Tabs */}
				<div className="border-b">
					<nav className="flex gap-4">
						<span className="px-4 py-2 border-b-2 border-primary font-medium">
							Overview
						</span>
						<Link
							href={`/compete/organizer/${competition.id}/divisions`}
							className="px-4 py-2 border-b-2 border-transparent hover:border-muted-foreground/50 text-muted-foreground hover:text-foreground transition-colors"
						>
							Divisions
						</Link>
						<Link
							href={`/compete/organizer/${competition.id}/athletes`}
							className="px-4 py-2 border-b-2 border-transparent hover:border-muted-foreground/50 text-muted-foreground hover:text-foreground transition-colors"
						>
							Athletes
						</Link>
					</nav>
				</div>

				{/* Competition Details Card */}
				<Card>
					<CardHeader>
						<CardTitle>Competition Details</CardTitle>
						<CardDescription>Basic information about this competition</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="grid gap-4 md:grid-cols-2">
							<div>
								<div className="text-sm font-medium text-muted-foreground">
									Competition Dates
								</div>
								<div className="text-sm mt-1">
									{formatDate(competition.startDate)} -{" "}
									{formatDate(competition.endDate)}
								</div>
							</div>
							<div>
								<div className="text-sm font-medium text-muted-foreground">
									Slug
								</div>
								<div className="text-sm font-mono mt-1">{competition.slug}</div>
							</div>
						</div>

						{group && (
							<div>
								<div className="text-sm font-medium text-muted-foreground">
									Series
								</div>
								<div className="text-sm mt-1">
									<Link
										href={`/compete/organizer/series/${group.id}`}
										className="text-primary hover:underline"
									>
										{group.name}
									</Link>
								</div>
							</div>
						)}

						<div>
							<div className="text-sm font-medium text-muted-foreground">
								Created
							</div>
							<div className="text-sm mt-1">{formatDateTime(competition.createdAt)}</div>
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
						{competition.registrationOpensAt && competition.registrationClosesAt ? (
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

				{/* Registrations Card */}
				<Card>
					<CardHeader className="flex flex-row items-center justify-between">
						<div>
							<CardTitle>Registrations</CardTitle>
							<CardDescription>Athletes registered for this competition</CardDescription>
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
									<div className="text-3xl font-bold">{registrations.length}</div>
									<div className="text-sm text-muted-foreground">
										{registrations.length === 1 ? "registration" : "registrations"}
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
