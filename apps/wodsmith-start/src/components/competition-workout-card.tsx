"use client"

import { Link } from "@tanstack/react-router"
import { ArrowRight, Dumbbell, Hash, MapPin, Target, Timer, Trophy } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { getGoogleMapsUrl, hasAddressData } from "@/utils/address"
import type { DivisionDescription } from "@/server-fns/competition-workouts-fns"

interface CompetitionWorkoutCardProps {
	eventId: string
	slug: string
	trackOrder: number
	name: string
	scheme: string // e.g. "time", "amrap", etc. from DB enum
	description: string | null // Default description
	roundsToScore: number | null
	pointsMultiplier: number | null
	movements?: Array<{ id: string; name: string }>
	tags?: Array<{ id: string; name: string }>
	divisionDescriptions: DivisionDescription[]
	sponsorName?: string
	sponsorLogoUrl?: string | null
	selectedDivisionId?: string
	timeCap?: number | null // in seconds
	venue?: {
		id: string
		name: string
		address: {
			streetLine1?: string
			city?: string
			stateProvince?: string
			postalCode?: string
			countryCode?: string
		} | null
	} | null
}

function formatTime(seconds: number): string {
	const m = Math.floor(seconds / 60)
	const s = seconds % 60
	return `${m}:${s.toString().padStart(2, "0")}`
}

function getSchemeLabel(scheme: string, timeCap?: number | null): string {
	if (scheme === "time" || scheme === "time-with-cap") {
		return timeCap ? "For Time (Capped)" : "For Time"
	}
	if (scheme === "amrap") return "AMRAP"
	if (scheme === "emom") return "EMOM"
	if (scheme === "load") return "For Load"
	return scheme.replace(/-/g, " ").toUpperCase()
}

export function CompetitionWorkoutCard({
	eventId,
	slug,
	trackOrder,
	name,
	scheme,
	description,
	roundsToScore,
	pointsMultiplier,
	movements,
	tags,
	divisionDescriptions,
	sponsorName,
	sponsorLogoUrl,
	selectedDivisionId,
	timeCap,
	venue,
}: CompetitionWorkoutCardProps) {
	// Find RX division (position 0 is typically RX/hardest)
	const sortedDivisions = [...divisionDescriptions].sort(
		(a, b) => a.position - b.position,
	)
	const rxDivision = sortedDivisions.find((d) => d.position === 0)
	const rxDescription = rxDivision?.description

	// Determine description to display
	// If selectedDivisionId is provided (and not "default"), try to find that specific description.
	// If not found, fallback to RX description, then base description.
	const targetDivisionDesc =
		selectedDivisionId && selectedDivisionId !== "default"
			? divisionDescriptions.find((d) => d.divisionId === selectedDivisionId)
			: null

	const displayDescription =
		targetDivisionDesc?.description || rxDescription || description

	const formattedTimeCap = timeCap ? formatTime(timeCap) : null

	const schemeLabel = getSchemeLabel(scheme, timeCap)
	const hasMovementsOrTags =
		(movements && movements.length > 0) || (tags && tags.length > 0)

	return (
		<Card className="overflow-hidden border-l-4 border-l-primary/40 hover:border-l-primary transition-all">
			<div className="flex flex-col md:flex-row">
				{/* Hero Number & Header Section */}
				<div className="flex-1 p-6">
					{/* Header */}
					<div className="flex items-start justify-between gap-4 mb-6">
						<div className="flex items-start gap-4">
							<span className="text-6xl font-black text-primary/70 leading-none select-none -ml-1">
								{trackOrder.toString().padStart(2, "0")}
							</span>
							<div className="pt-1">
								<h3 className="text-2xl font-bold tracking-tight">{name}</h3>
								{sponsorName && (
									<div className="flex items-center gap-2 mt-1">
										{sponsorLogoUrl && (
											<img
												src={sponsorLogoUrl}
												alt={sponsorName}
												className="h-6 w-auto object-contain"
											/>
										)}
										{!sponsorLogoUrl && (
											<span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
												Presented by {sponsorName}
											</span>
										)}
									</div>
								)}
							</div>
						</div>

						{/* View Details Button */}
						<Button variant="outline" size="sm" asChild className="shrink-0">
							<Link
								to="/compete/$slug/workouts/$eventId"
								params={{ slug, eventId }}
							>
								View Details
								<ArrowRight className="ml-2 h-4 w-4" />
							</Link>
						</Button>
					</div>

					{/* Specs Row */}
					<div className="flex flex-wrap gap-3 mb-6">
						{formattedTimeCap && (
							<div
								className={cn(
									"inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border",
									scheme === "time-with-cap"
										? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900"
										: "bg-secondary text-secondary-foreground border-transparent",
								)}
							>
								<Timer className="h-4 w-4" />
								{formattedTimeCap} Cap
							</div>
						)}
						<div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-secondary text-secondary-foreground">
							<Target className="h-4 w-4" />
							{schemeLabel}
						</div>
						{pointsMultiplier && pointsMultiplier !== 100 && (
							<div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900">
								<Trophy className="h-4 w-4" />
								{pointsMultiplier / 100}x
							</div>
						)}
						{roundsToScore && roundsToScore > 1 && (
							<div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-secondary text-secondary-foreground">
								<Hash className="h-4 w-4" />
								{roundsToScore} Rounds
							</div>
						)}
					</div>

					{/* Venue Section */}
					<div className="mb-6">
						{venue && venue.address && hasAddressData(venue.address) ? (
							(() => {
								const mapsUrl = getGoogleMapsUrl(venue.address)
								return (
									<div className="flex items-center gap-3">
										<div className="flex items-center gap-2 text-sm text-muted-foreground">
											<MapPin className="h-4 w-4" />
											<span className="font-medium">{venue.name}</span>
										</div>
										{mapsUrl && (
											<Button variant="outline" size="sm" asChild>
												<a
													href={mapsUrl}
													target="_blank"
													rel="noopener noreferrer"
												>
													Get Directions
												</a>
											</Button>
										)}
									</div>
								)
							})()
						) : (
							<div className="flex items-center gap-2 text-sm text-muted-foreground italic">
								<MapPin className="h-4 w-4" />
								<span>Venue to be announced</span>
							</div>
						)}
					</div>

					{/* Content Grid */}
					<div
						className={cn(
							"grid gap-6",
							hasMovementsOrTags ? "md:grid-cols-12" : "grid-cols-1",
						)}
					>
						{/* Description - Takes up majority */}
						<div
							className={cn(
								hasMovementsOrTags ? "md:col-span-8" : "col-span-1",
							)}
						>
							<div className="prose prose-sm max-w-none dark:prose-invert">
								<p className="whitespace-pre-wrap text-base leading-relaxed">
									{displayDescription || (
										<span className="italic text-muted-foreground">
											Details to be announced.
										</span>
									)}
								</p>
							</div>
						</div>

						{/* Side Panel for Movements ("Ingredients") */}
						{hasMovementsOrTags && (
							<div className="md:col-span-4 border-t md:border-t-0 md:border-l pt-4 md:pt-0 md:pl-6">
								{movements && movements.length > 0 && (
									<div>
										<h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
											<Dumbbell className="h-3.5 w-3.5" />
											Movements
										</h4>
										<ul className="space-y-2">
											{movements.map((m) => (
												<li
													key={m.id}
													className="text-sm font-medium text-foreground/90 flex items-center justify-between"
												>
													{m.name}
												</li>
											))}
										</ul>
									</div>
								)}

								{tags && tags.length > 0 && (
									<div className="mt-6">
										<h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
											Tags
										</h4>
										<div className="flex flex-wrap gap-1.5">
											{tags.map((tag) => (
												<Badge
													key={tag.id}
													variant="secondary"
													className="text-xs font-normal"
												>
													{tag.name}
												</Badge>
											))}
										</div>
									</div>
								)}
							</div>
						)}
					</div>
				</div>
			</div>
		</Card>
	)
}
