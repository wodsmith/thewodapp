"use client"

import {
	Calendar,
	ChevronDown,
	ExternalLink,
	Trophy,
	Users,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Separator } from "@/components/ui/separator"
import type { Competition, CompetitionGroup } from "@/db/schemas/competitions"
import type { Sponsor, SponsorGroup } from "@/db/schemas/sponsors"
import type { Team } from "@/db/schemas/teams"

interface DivisionWithDetails {
	id: string
	label: string
	description: string | null
	registrationCount: number
	feeCents: number
	teamSize: number
	maxSpots: number | null
	spotsAvailable: number | null
	isFull: boolean
}

interface SponsorGroupWithSponsors extends SponsorGroup {
	sponsors: Sponsor[]
}

interface SponsorsData {
	groups: SponsorGroupWithSponsors[]
	ungroupedSponsors: Sponsor[]
}

interface EventDetailsContentProps {
	competition: Competition & {
		organizingTeam: Team | null
		group: CompetitionGroup | null
	}
	divisions?: DivisionWithDetails[]
	sponsors?: SponsorsData
	workoutsContent?: React.ReactNode
	scheduleContent?: React.ReactNode
}

function formatPrice(cents: number): string {
	if (cents === 0) return "Free"
	return `$${(cents / 100).toFixed(0)}`
}

export function EventDetailsContent({
	competition,
	divisions,
	sponsors,
	workoutsContent,
	scheduleContent,
}: EventDetailsContentProps) {
	const hasDivisions = divisions && divisions.length > 0
	const hasSponsors =
		sponsors &&
		(sponsors.groups.length > 0 || sponsors.ungroupedSponsors.length > 0)

	return (
		<div className="space-y-8">
			{/* About Section */}
			<section>
				<h2 className="text-xl font-semibold mb-4">About This Competition</h2>
				<Separator className="mb-4" />
				{competition.description ? (
					<div className="prose prose-sm max-w-none dark:prose-invert">
						<p className="whitespace-pre-wrap text-muted-foreground">
							{competition.description}
						</p>
					</div>
				) : (
					<p className="text-muted-foreground italic">
						Competition description coming soon.
					</p>
				)}
			</section>

			{/* Sponsors Section - only show if there are sponsors */}
			{hasSponsors && (
				<section>
					<div className="flex items-center gap-2 mb-4">
						<Trophy className="h-5 w-5 text-muted-foreground" />
						<h2 className="text-xl font-semibold">Sponsors</h2>
					</div>
					<Separator className="mb-4" />
					<div className="space-y-8">
						{/* Grouped sponsors */}
						{sponsors.groups.map((group) => {
							const isFeatured = group.sponsors.length === 1
							return (
								<div key={group.id}>
									<h3 className="text-lg font-medium mb-4">{group.name}</h3>
									<div
										className={`grid gap-4 ${
											isFeatured
												? "grid-cols-1 max-w-sm"
												: "grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
										}`}
									>
										{group.sponsors.map((sponsor) => (
											<SponsorCard
												key={sponsor.id}
												sponsor={sponsor}
												featured={isFeatured}
											/>
										))}
									</div>
								</div>
							)
						})}

						{/* Ungrouped sponsors */}
						{sponsors.ungroupedSponsors.length > 0 && (
							<div>
								{sponsors.groups.length > 0 && (
									<h3 className="text-lg font-medium mb-4">Partners</h3>
								)}
								<div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
									{sponsors.ungroupedSponsors.map((sponsor) => (
										<SponsorCard key={sponsor.id} sponsor={sponsor} />
									))}
								</div>
							</div>
						)}
					</div>
				</section>
			)}

			{/* Divisions Section */}
			<section>
				<div className="flex items-center gap-2 mb-4">
					<Users className="h-5 w-5 text-muted-foreground" />
					<h2 className="text-xl font-semibold">Divisions</h2>
				</div>
				<Separator className="mb-4" />
				{hasDivisions ? (
					<DivisionsGroupedByPrice divisions={divisions} />
				) : (
					<Card className="border-dashed">
						<CardContent className="py-6 text-center">
							<p className="text-muted-foreground">
								Division information coming soon.
							</p>
						</CardContent>
					</Card>
				)}
			</section>

			{/* Schedule Section */}
			<section>
				<div className="flex items-center gap-2 mb-4">
					<Calendar className="h-5 w-5 text-muted-foreground" />
					<h2 className="text-xl font-semibold">Schedule</h2>
				</div>
				<Separator className="mb-4" />
				{scheduleContent}
			</section>

			{/* Workouts Section */}
			{workoutsContent}
		</div>
	)
}

// Helper component for grouping divisions by price
function DivisionsGroupedByPrice({
	divisions,
}: { divisions: DivisionWithDetails[] }) {
	// Group divisions by price
	const freeDivisions = divisions.filter((d) => d.feeCents === 0)
	const paidDivisionsMap = new Map<number, DivisionWithDetails[]>()

	for (const div of divisions.filter((d) => d.feeCents > 0)) {
		const existing = paidDivisionsMap.get(div.feeCents) || []
		paidDivisionsMap.set(div.feeCents, [...existing, div])
	}

	// Sort paid tiers by price ascending
	const paidTiers = Array.from(paidDivisionsMap.entries()).sort(
		([a], [b]) => a - b,
	)

	return (
		<div className="space-y-6">
			{/* Free Tier */}
			{freeDivisions.length > 0 && (
				<div className="space-y-2">
					<div className="flex items-center gap-2">
						<span className="text-sm font-medium text-green-600 dark:text-green-400">
							Free
						</span>
						<span className="text-xs text-muted-foreground">
							({freeDivisions.length}{" "}
							{freeDivisions.length === 1 ? "division" : "divisions"})
						</span>
					</div>
					<div className="space-y-2 border-l-2 border-green-600/30 dark:border-green-400/30 pl-4">
						{freeDivisions.map((division) => (
							<DivisionRow key={division.id} division={division} />
						))}
					</div>
				</div>
			)}

			{/* Paid Tiers */}
			{paidTiers.map(([feeCents, tierDivisions]) => (
				<div key={feeCents} className="space-y-2">
					<div className="flex items-center gap-2">
						<span className="text-sm font-medium text-muted-foreground">
							{formatPrice(feeCents)}
						</span>
						<span className="text-xs text-muted-foreground">
							({tierDivisions.length}{" "}
							{tierDivisions.length === 1 ? "division" : "divisions"})
						</span>
					</div>
					<div className="space-y-2 border-l-2 border-border pl-4">
						{tierDivisions.map((division) => (
							<DivisionRow key={division.id} division={division} />
						))}
					</div>
				</div>
			))}
		</div>
	)
}

// Helper component for individual division row
function DivisionRow({ division }: { division: DivisionWithDetails }) {
	const hasDescription = !!division.description
	const athleteLabel = division.teamSize > 1 ? "teams" : "athletes"

	// Format spots display
	const spotsDisplay = division.maxSpots
		? `${division.registrationCount}/${division.maxSpots}`
		: `${division.registrationCount}`

	return (
		<Collapsible className="group">
			<Card className={division.isFull ? "opacity-60" : ""}>
				<CollapsibleTrigger asChild>
					<CardHeader
						className={`py-3 px-4 ${hasDescription ? "cursor-pointer hover:bg-muted/50" : ""}`}
					>
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2">
								<CardTitle className="text-base">
									{division.label}{" "}
									<span className="font-normal text-muted-foreground">
										{division.teamSize === 1
											? "(Indy)"
											: `(Teams of ${division.teamSize})`}
									</span>
								</CardTitle>
								{hasDescription && (
									<ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
								)}
							</div>
							<div className="flex items-center gap-2">
								{division.isFull ? (
									<span className="text-xs font-medium text-red-600 dark:text-red-400">
										SOLD OUT
									</span>
								) : division.maxSpots && division.spotsAvailable !== null ? (
									<span className="text-xs text-muted-foreground">
										{spotsDisplay} {athleteLabel}
										{division.spotsAvailable <= 5 && (
											<span className="ml-1 text-amber-600 dark:text-amber-400">
												({division.spotsAvailable} left)
											</span>
										)}
									</span>
								) : (
									<span className="text-xs text-muted-foreground">
										{spotsDisplay} {athleteLabel}
									</span>
								)}
							</div>
						</div>
					</CardHeader>
				</CollapsibleTrigger>
				{hasDescription && (
					<CollapsibleContent>
						<CardContent className="pt-0 pb-4 px-4">
							<p className="text-sm text-muted-foreground whitespace-pre-wrap">
								{division.description}
							</p>
						</CardContent>
					</CollapsibleContent>
				)}
			</Card>
		</Collapsible>
	)
}

// Helper component for sponsor display
function SponsorCard({
	sponsor,
	featured = false,
}: {
	sponsor: Sponsor
	featured?: boolean
}) {
	const content = (
		<Card
			className={`group transition-colors ${sponsor.website ? "hover:border-primary/50" : ""} ${featured ? "p-6" : ""}`}
		>
			<CardContent
				className={`flex flex-col items-center justify-center text-center ${featured ? "py-8" : "p-4"}`}
			>
				{sponsor.logoUrl ? (
					<div
						className={`relative w-full ${featured ? "h-24 md:h-32" : "h-16"}`}
					>
						<img
							src={sponsor.logoUrl}
							alt={sponsor.name}
							className="object-contain w-full h-full"
						/>
					</div>
				) : (
					<p className={`font-semibold ${featured ? "text-xl" : "text-base"}`}>
						{sponsor.name}
					</p>
				)}
				{sponsor.logoUrl && (
					<p
						className={`mt-2 font-medium text-muted-foreground ${featured ? "text-base" : "text-sm"}`}
					>
						{sponsor.name}
					</p>
				)}
				{sponsor.website && (
					<span className="mt-2 text-xs text-primary flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
						<ExternalLink className="h-3 w-3" />
						Visit Website
					</span>
				)}
			</CardContent>
		</Card>
	)

	if (sponsor.website) {
		return (
			<a
				href={sponsor.website}
				target="_blank"
				rel="noopener noreferrer"
				className="block"
			>
				{content}
			</a>
		)
	}

	return content
}
