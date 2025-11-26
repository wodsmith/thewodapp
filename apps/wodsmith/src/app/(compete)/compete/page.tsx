import { Calendar, MapPin } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { getAllPublicCompetitions } from "@/server/competitions"

export const metadata: Metadata = {
	title: "Compete - Find CrossFit Competitions",
	description: "Browse and register for CrossFit competitions near you.",
	openGraph: {
		type: "website",
		title: "Compete - Find CrossFit Competitions",
		description: "Browse and register for CrossFit competitions near you.",
		images: [
			{
				url: `/api/og?title=${encodeURIComponent("Compete")}`,
				width: 1200,
				height: 630,
				alt: "Compete",
			},
		],
	},
	twitter: {
		card: "summary_large_image",
		title: "Compete - Find CrossFit Competitions",
		description: "Browse and register for CrossFit competitions near you.",
		images: [`/api/og?title=${encodeURIComponent("Compete")}`],
	},
}

function formatDate(date: Date | number | null): string {
	if (!date) return "TBA"
	const d = typeof date === "number" ? new Date(date) : date
	return d.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	})
}

function getCompetitionStatus(
	startDate: Date | number | null,
	endDate: Date | number | null,
	registrationOpensAt: Date | number | null,
	registrationClosesAt: Date | number | null,
): { label: string; variant: "default" | "secondary" | "destructive" | "outline" } {
	const now = new Date()

	if (startDate) {
		const start = typeof startDate === "number" ? new Date(startDate) : startDate
		if (start > now) {
			// Competition hasn't started yet
			if (registrationOpensAt && registrationClosesAt) {
				const regOpen = typeof registrationOpensAt === "number" ? new Date(registrationOpensAt) : registrationOpensAt
				const regClose = typeof registrationClosesAt === "number" ? new Date(registrationClosesAt) : registrationClosesAt

				if (regOpen > now) {
					return { label: "Registration Opens Soon", variant: "secondary" }
				}
				if (regClose < now) {
					return { label: "Registration Closed", variant: "destructive" }
				}
				return { label: "Registration Open", variant: "default" }
			}
			return { label: "Upcoming", variant: "outline" }
		}
	}

	if (endDate) {
		const end = typeof endDate === "number" ? new Date(endDate) : endDate
		if (end < now) {
			return { label: "Completed", variant: "secondary" }
		}
		return { label: "In Progress", variant: "default" }
	}

	return { label: "Upcoming", variant: "outline" }
}

export default async function CompetePage() {
	const competitions = await getAllPublicCompetitions()

	// Group competitions by status
	const upcoming = competitions.filter(c => {
		const start = c.startDate ? (typeof c.startDate === "number" ? new Date(c.startDate) : c.startDate) : null
		return start && start > new Date()
	})

	const inProgress = competitions.filter(c => {
		const start = c.startDate ? (typeof c.startDate === "number" ? new Date(c.startDate) : c.startDate) : null
		const end = c.endDate ? (typeof c.endDate === "number" ? new Date(c.endDate) : c.endDate) : null
		const now = new Date()
		return start && end && start <= now && end >= now
	})

	const completed = competitions.filter(c => {
		const end = c.endDate ? (typeof c.endDate === "number" ? new Date(c.endDate) : c.endDate) : null
		return end && end < new Date()
	})

	return (
		<div className="mx-auto max-w-7xl space-y-8">
			<div className="space-y-2">
				<h1 className="text-4xl font-bold">Find Competitions</h1>
				<p className="text-muted-foreground text-lg">
					Browse and register for CrossFit competitions
				</p>
			</div>

			{competitions.length === 0 ? (
				<Card>
					<CardContent className="flex flex-col items-center justify-center py-12">
						<p className="text-muted-foreground text-lg">
							No competitions available yet. Check back soon!
						</p>
					</CardContent>
				</Card>
			) : (
				<>
					{upcoming.length > 0 && (
						<section className="space-y-4">
							<h2 className="text-2xl font-semibold">Upcoming Competitions</h2>
							<div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
								{upcoming.map(competition => {
									const status = getCompetitionStatus(
										competition.startDate,
										competition.endDate,
										competition.registrationOpensAt,
										competition.registrationClosesAt,
									)

									return (
										<Card key={competition.id} className="flex flex-col">
											<CardHeader>
												<div className="flex items-start justify-between gap-2">
													<CardTitle className="line-clamp-2">{competition.name}</CardTitle>
													<Badge variant={status.variant}>{status.label}</Badge>
												</div>
												{competition.group && (
													<CardDescription>{competition.group.name}</CardDescription>
												)}
											</CardHeader>
											<CardContent className="flex-1 space-y-3">
												<div className="flex items-center gap-2 text-sm">
													<Calendar className="h-4 w-4" />
													<span>
														{formatDate(competition.startDate)} - {formatDate(competition.endDate)}
													</span>
												</div>
												<div className="flex items-center gap-2 text-sm">
													<MapPin className="h-4 w-4" />
													<span>{competition.organizingTeam?.name || "TBA"}</span>
												</div>
												{competition.description && (
													<p className="text-muted-foreground line-clamp-3 text-sm">
														{competition.description}
													</p>
												)}
											</CardContent>
											<CardFooter>
												<Button asChild className="w-full">
													<Link href={`/compete/${competition.slug}`}>
														View Details
													</Link>
												</Button>
											</CardFooter>
										</Card>
									)
								})}
							</div>
						</section>
					)}

					{inProgress.length > 0 && (
						<section className="space-y-4">
							<h2 className="text-2xl font-semibold">In Progress</h2>
							<div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
								{inProgress.map(competition => {
									const status = getCompetitionStatus(
										competition.startDate,
										competition.endDate,
										competition.registrationOpensAt,
										competition.registrationClosesAt,
									)

									return (
										<Card key={competition.id} className="flex flex-col">
											<CardHeader>
												<div className="flex items-start justify-between gap-2">
													<CardTitle className="line-clamp-2">{competition.name}</CardTitle>
													<Badge variant={status.variant}>{status.label}</Badge>
												</div>
												{competition.group && (
													<CardDescription>{competition.group.name}</CardDescription>
												)}
											</CardHeader>
											<CardContent className="flex-1 space-y-3">
												<div className="flex items-center gap-2 text-sm">
													<Calendar className="h-4 w-4" />
													<span>
														{formatDate(competition.startDate)} - {formatDate(competition.endDate)}
													</span>
												</div>
												<div className="flex items-center gap-2 text-sm">
													<MapPin className="h-4 w-4" />
													<span>{competition.organizingTeam?.name || "TBA"}</span>
												</div>
												{competition.description && (
													<p className="text-muted-foreground line-clamp-3 text-sm">
														{competition.description}
													</p>
												)}
											</CardContent>
											<CardFooter>
												<Button asChild className="w-full">
													<Link href={`/compete/${competition.slug}`}>
														View Details
													</Link>
												</Button>
											</CardFooter>
										</Card>
									)
								})}
							</div>
						</section>
					)}

					{completed.length > 0 && (
						<section className="space-y-4">
							<h2 className="text-2xl font-semibold">Past Competitions</h2>
							<div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
								{completed.map(competition => {
									const status = getCompetitionStatus(
										competition.startDate,
										competition.endDate,
										competition.registrationOpensAt,
										competition.registrationClosesAt,
									)

									return (
										<Card key={competition.id} className="flex flex-col opacity-75">
											<CardHeader>
												<div className="flex items-start justify-between gap-2">
													<CardTitle className="line-clamp-2">{competition.name}</CardTitle>
													<Badge variant={status.variant}>{status.label}</Badge>
												</div>
												{competition.group && (
													<CardDescription>{competition.group.name}</CardDescription>
												)}
											</CardHeader>
											<CardContent className="flex-1 space-y-3">
												<div className="flex items-center gap-2 text-sm">
													<Calendar className="h-4 w-4" />
													<span>
														{formatDate(competition.startDate)} - {formatDate(competition.endDate)}
													</span>
												</div>
												<div className="flex items-center gap-2 text-sm">
													<MapPin className="h-4 w-4" />
													<span>{competition.organizingTeam?.name || "TBA"}</span>
												</div>
												{competition.description && (
													<p className="text-muted-foreground line-clamp-3 text-sm">
														{competition.description}
													</p>
												)}
											</CardContent>
											<CardFooter>
												<Button asChild variant="secondary" className="w-full">
													<Link href={`/compete/${competition.slug}`}>
														View Results
													</Link>
												</Button>
											</CardFooter>
										</Card>
									)
								})}
							</div>
						</section>
					)}
				</>
			)}
		</div>
	)
}
