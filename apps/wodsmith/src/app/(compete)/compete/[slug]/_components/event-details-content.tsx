"use client"

import { ChevronDown, HelpCircle, Calendar, DollarSign, Dumbbell, Trophy, Users } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Separator } from "@/components/ui/separator"
import type { Competition, CompetitionGroup, Team } from "@/db/schema"

interface DivisionWithDetails {
	id: string
	label: string
	description: string | null
	registrationCount: number
	feeCents: number
	teamSize: number
}

interface EventDetailsContentProps {
	competition: Competition & {
		organizingTeam: Team | null
		group: CompetitionGroup | null
	}
	divisions?: DivisionWithDetails[]
}

function formatDateShort(date: Date | number): string {
	const d = typeof date === "number" ? new Date(date) : date
	return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
}

function formatPrice(cents: number): string {
	if (cents === 0) return "Free"
	return `$${(cents / 100).toFixed(0)}`
}

export function EventDetailsContent({ competition, divisions }: EventDetailsContentProps) {
	const hasDivisions = divisions && divisions.length > 0

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
											<CardHeader className={`py-3 px-4 ${hasDescription ? "cursor-pointer hover:bg-muted/50" : ""}`}>
												<div className="flex items-center justify-between">
													<div className="flex items-center gap-2">
														<CardTitle className="text-base">
															{division.label}{" "}
															<span className="font-normal text-muted-foreground">
																{division.teamSize === 1 ? "(Indy)" : `(Teams of ${division.teamSize})`}
															</span>
														</CardTitle>
														<span className="text-xs text-muted-foreground">
															({division.registrationCount} {athleteLabel})
														</span>
														{hasDescription && (
															<ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
														)}
													</div>
													<span className={`text-sm font-medium ${division.feeCents === 0 ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>
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
				<Card className="border-dashed">
					<CardContent className="py-6 text-center">
						<p className="text-muted-foreground">
							Detailed schedule coming soon.
						</p>
						<p className="text-sm text-muted-foreground mt-2">
							Competition dates: {formatDateShort(competition.startDate)}
							{competition.startDate !== competition.endDate && (
								<> - {formatDateShort(competition.endDate)}</>
							)}
						</p>
					</CardContent>
				</Card>
			</section>

			{/* Workouts Section */}
			<section>
				<div className="flex items-center gap-2 mb-4">
					<Dumbbell className="h-5 w-5 text-muted-foreground" />
					<h2 className="text-xl font-semibold">Workouts</h2>
				</div>
				<Separator className="mb-4" />
				<Card className="border-dashed">
					<CardContent className="py-6 text-center">
						<p className="text-muted-foreground">
							Workouts will be announced closer to the event.
						</p>
					</CardContent>
				</Card>
			</section>

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
				<Card className="border-dashed">
					<CardContent className="py-6 text-center">
						<p className="text-muted-foreground">
							Sponsor information coming soon.
						</p>
					</CardContent>
				</Card>
			</section>
		</div>
	)
}
