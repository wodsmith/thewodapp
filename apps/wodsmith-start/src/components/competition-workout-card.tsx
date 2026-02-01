"use client"

import { Link } from "@tanstack/react-router"
import {
	ArrowRight,
	Dumbbell,
	Hash,
	MapPin,
	Target,
	Timer,
	Trophy,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { DivisionDescription } from "@/server-fns/competition-workouts-fns"
import { getGoogleMapsUrl, hasAddressData } from "@/utils/address"

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
	// Get the selected division's scale info (if any)
	// Only show scale for the explicitly selected division - no fallback
	const targetDivision =
		selectedDivisionId && selectedDivisionId !== "default"
			? divisionDescriptions.find((d) => d.divisionId === selectedDivisionId)
			: null

	// Division scale is shown separately from base description
	const divisionScale = targetDivision?.description?.trim() || null
	const divisionLabel = targetDivision?.divisionLabel || null

	const formattedTimeCap = timeCap ? formatTime(timeCap) : null

	const schemeLabel = getSchemeLabel(scheme, timeCap)
	const hasMovementsOrTags =
		(movements && movements.length > 0) || (tags && tags.length > 0)

	return (
		<Card className="overflow-hidden border-l-4 border-l-primary/40 hover:border-l-primary transition-all">
			<div className="flex flex-col md:flex-row">
				{/* Hero Number & Header Section */}
				<div className="flex-1 p-4 sm:p-6">
					{/* Header - stacked on mobile, inline on desktop */}
					<div className="mb-4 sm:mb-6">
						{/* Mobile: stacked layout */}
						<div className="flex flex-col sm:flex-row sm:items-start sm:justify-between sm:gap-4">
							<div className="flex items-baseline gap-3 sm:items-start sm:gap-4">
								<span className="text-4xl sm:text-6xl font-black text-primary/70 leading-none select-none">
									{trackOrder.toString().padStart(2, "0")}
								</span>
								<div className="sm:pt-1">
									<h3 className="text-xl sm:text-2xl font-bold tracking-tight">
										{name}
									</h3>
									{sponsorName && (
										<div className="flex items-center gap-2 mt-1">
											{sponsorLogoUrl && (
												<img
													src={sponsorLogoUrl}
													alt={sponsorName}
													className="h-5 sm:h-6 w-auto object-contain"
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

							{/* Desktop View Details Button */}
							<Button
								variant="outline"
								size="sm"
								asChild
								className="hidden shrink-0 sm:flex"
							>
								<Link
									to="/compete/$slug/workouts/$eventId"
									params={{ slug, eventId }}
								>
									View Details
									<ArrowRight className="ml-2 h-4 w-4" />
								</Link>
							</Button>
						</div>
					</div>

					{/* Specs Row */}
					<div className="flex flex-wrap gap-2 mb-4 sm:mb-6">
						{formattedTimeCap && (
							<div
								className={cn(
									"inline-flex items-center gap-1 px-2 py-0.5 sm:gap-1.5 sm:px-3 sm:py-1 rounded-full text-xs sm:text-sm font-medium border",
									scheme === "time-with-cap"
										? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900"
										: "bg-secondary text-secondary-foreground border-transparent",
								)}
							>
								<Timer className="h-3 w-3 sm:h-4 sm:w-4" />
								{formattedTimeCap} Cap
							</div>
						)}
						<div className="inline-flex items-center gap-1 px-2 py-0.5 sm:gap-1.5 sm:px-3 sm:py-1 rounded-full text-xs sm:text-sm font-medium bg-secondary text-secondary-foreground">
							<Target className="h-3 w-3 sm:h-4 sm:w-4" />
							{schemeLabel}
						</div>
						{pointsMultiplier && pointsMultiplier !== 100 && (
							<div className="inline-flex items-center gap-1 px-2 py-0.5 sm:gap-1.5 sm:px-3 sm:py-1 rounded-full text-xs sm:text-sm font-medium bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900">
								<Trophy className="h-3 w-3 sm:h-4 sm:w-4" />
								{pointsMultiplier / 100}x
							</div>
						)}
						{roundsToScore && roundsToScore > 1 && (
							<div className="inline-flex items-center gap-1 px-2 py-0.5 sm:gap-1.5 sm:px-3 sm:py-1 rounded-full text-xs sm:text-sm font-medium bg-secondary text-secondary-foreground">
								<Hash className="h-3 w-3 sm:h-4 sm:w-4" />
								{roundsToScore} Rounds
							</div>
						)}
					</div>

					{/* Venue Section */}
					<div className="mb-4 sm:mb-6">
						{venue?.address && hasAddressData(venue.address) ? (
							(() => {
								const mapsUrl = getGoogleMapsUrl(venue.address)
								return (
									<div className="flex flex-wrap items-center gap-2 sm:gap-3">
										<div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground">
											<MapPin className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
											<span className="font-medium">{venue.name}</span>
										</div>
										{mapsUrl && (
											<Button
												variant="outline"
												size="sm"
												asChild
												className="h-7 text-xs sm:h-8 sm:text-sm"
											>
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
							<div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground italic">
								<MapPin className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
								<span>Venue to be announced</span>
							</div>
						)}
					</div>

					{/* Content Grid */}
					<div
						className={cn(
							"grid gap-4 sm:gap-6",
							hasMovementsOrTags ? "md:grid-cols-12" : "grid-cols-1",
						)}
					>
						{/* Description - Takes up majority */}
						<div
							className={cn(
								hasMovementsOrTags ? "md:col-span-8" : "col-span-1",
							)}
						>
							<div className="prose prose-sm max-w-none dark:prose-invert space-y-4">
								{/* Base workout description */}
								<p className="whitespace-pre-wrap text-sm sm:text-base leading-relaxed">
									{description || (
										<span className="italic text-muted-foreground">
											Details to be announced.
										</span>
									)}
								</p>

								{/* Division-specific scale info */}
								{divisionScale && (
									<div className="border-t pt-3 mt-3">
										<div className="flex items-start gap-2">
											<Badge
												variant="secondary"
												className="shrink-0 text-xs font-medium"
											>
												{divisionLabel || "Division"}
											</Badge>
											<p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
												{divisionScale}
											</p>
										</div>
									</div>
								)}
							</div>
						</div>

						{/* Side Panel for Movements ("Ingredients") */}
						{hasMovementsOrTags && (
							<div className="md:col-span-4 border-t md:border-t-0 md:border-l pt-3 sm:pt-4 md:pt-0 md:pl-6">
								{movements && movements.length > 0 && (
									<div>
										<h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 sm:mb-3 flex items-center gap-2">
											<Dumbbell className="h-3.5 w-3.5" />
											Movements
										</h4>
										<ul className="space-y-1.5 sm:space-y-2">
											{movements.map((m) => (
												<li
													key={m.id}
													className="text-xs sm:text-sm font-medium text-foreground/90 flex items-center justify-between"
												>
													{m.name}
												</li>
											))}
										</ul>
									</div>
								)}

								{tags && tags.length > 0 && (
									<div className="mt-4 sm:mt-6">
										<h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 sm:mb-3">
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

					{/* Mobile CTA - full width at bottom */}
					<Button variant="default" size="lg" asChild className="w-full mt-4 sm:hidden">
						<Link to="/compete/$slug/workouts/$eventId" params={{ slug, eventId }}>
							View Details
							<ArrowRight className="ml-2 h-4 w-4" />
						</Link>
					</Button>
				</div>
			</div>
		</Card>
	)
}
