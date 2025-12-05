"use client"

import {
	Calendar,
	ChevronDown,
	DollarSign,
	ExternalLink,
	HelpCircle,
	Trophy,
	Users,
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Separator } from "@/components/ui/separator"
import type {
	Competition,
	CompetitionGroup,
	Sponsor,
	SponsorGroup,
	Team,
} from "@/db/schema"

interface DivisionWithDetails {
	id: string
	label: string
	description: string | null
	registrationCount: number
	feeCents: number
	teamSize: number
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

			{/* Divisions Section */}
			<section>
				<div className="flex items-center gap-2 mb-4">
					<Users className="h-5 w-5 text-muted-foreground" />
					<h2 className="text-xl font-semibold">Divisions</h2>
				</div>
				<Separator className="mb-4" />
				{hasDivisions ? (
					<div className="space-y-3">
						{divisions.map((division) => {
							const priceLabel = formatPrice(division.feeCents)
							const hasDescription = !!division.description
							const athleteLabel = division.teamSize > 1 ? "teams" : "athletes"

							return (
								<Collapsible key={division.id}>
									<Card>
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
														<span className="text-xs text-muted-foreground">
															({division.registrationCount} {athleteLabel})
														</span>
														{hasDescription && (
															<ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
														)}
													</div>
													<span
														className={`text-sm font-medium ${division.feeCents === 0 ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}
													>
														{priceLabel}
													</span>
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
						})}
					</div>
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

			{/* Entry & Prizes */}
			<section>
				<div className="flex items-center gap-2 mb-4">
					<DollarSign className="h-5 w-5 text-muted-foreground" />
					<h2 className="text-xl font-semibold">Entry & Prizes</h2>
				</div>
				<Separator className="mb-4" />
				<Card className="border-dashed">
					<CardContent className="py-6 text-center">
						<p className="text-muted-foreground">
							Entry fees and prize information coming soon.
						</p>
					</CardContent>
				</Card>
			</section>

			{/* FAQ Section */}
			<section>
				<div className="flex items-center gap-2 mb-4">
					<HelpCircle className="h-5 w-5 text-muted-foreground" />
					<h2 className="text-xl font-semibold">Frequently Asked Questions</h2>
				</div>
				<Separator className="mb-4" />
				<Card className="border-dashed">
					<CardContent className="py-6 text-center">
						<p className="text-muted-foreground">
							FAQs will be added by the event organizer.
						</p>
					</CardContent>
				</Card>
			</section>

			{/* Sponsors Section */}
			<section>
				<div className="flex items-center gap-2 mb-4">
					<Trophy className="h-5 w-5 text-muted-foreground" />
					<h2 className="text-xl font-semibold">Sponsors</h2>
				</div>
				<Separator className="mb-4" />
				{hasSponsors ? (
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
				) : (
					<Card className="border-dashed">
						<CardContent className="py-6 text-center">
							<p className="text-muted-foreground">
								Sponsor information coming soon.
							</p>
						</CardContent>
					</Card>
				)}
			</section>
		</div>
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
						<Image
							src={sponsor.logoUrl}
							alt={sponsor.name}
							fill
							className="object-contain"
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
			<Link
				href={sponsor.website}
				target="_blank"
				rel="noopener noreferrer"
				className="block"
			>
				{content}
			</Link>
		)
	}

	return content
}
