import { HelpCircle, Calendar, DollarSign, Dumbbell, Trophy, Users } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import type { Competition, CompetitionGroup, Team, ScalingLevel } from "@/db/schema"

interface DivisionFees {
	defaultFeeCents: number
	divisionFees: Array<{
		divisionId: string
		divisionLabel: string | undefined
		feeCents: number
	}>
}

interface EventDetailsContentProps {
	competition: Competition & {
		organizingTeam: Team | null
		group: CompetitionGroup | null
	}
	divisions?: ScalingLevel[]
	divisionFees?: DivisionFees
}

function formatDateShort(date: Date | number): string {
	const d = typeof date === "number" ? new Date(date) : date
	return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
}

function formatPrice(cents: number): string {
	if (cents === 0) return "Free"
	return `$${(cents / 100).toFixed(0)}`
}

export function EventDetailsContent({ competition, divisions, divisionFees }: EventDetailsContentProps) {
	const hasDivisions = divisions && divisions.length > 0

	// Helper to get fee for a specific division
	const getDivisionFee = (divisionId: string): number => {
		const override = divisionFees?.divisionFees.find(f => f.divisionId === divisionId)
		if (override) return override.feeCents
		return divisionFees?.defaultFeeCents ?? 0
	}

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
							const feeCents = getDivisionFee(division.id)
							const priceLabel = formatPrice(feeCents)
							return (
								<Card key={division.id}>
									<CardHeader className="py-3 px-4">
										<div className="flex items-center justify-between">
											<CardTitle className="text-base">{division.label}</CardTitle>
											<span className={`text-sm font-medium ${feeCents === 0 ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>
												{priceLabel}
											</span>
										</div>
									</CardHeader>
								</Card>
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
