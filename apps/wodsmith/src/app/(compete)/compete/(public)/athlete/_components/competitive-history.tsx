import { Calendar, MapPin, Trophy, Users } from "lucide-react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"

type CompetitionRegistration = {
	id: string
	registeredAt: Date | number
	teamName: string | null
	competition: {
		id: string
		name: string
		slug: string
		startDate: Date | number | null
		endDate: Date | number | null
		organizingTeam: {
			name: string
		} | null
	} | null
	division: {
		label: string
		teamSize: number
	} | null
	athleteTeam?: {
		name: string
	} | null
}

type CompetitiveHistoryProps = {
	registrations: CompetitionRegistration[]
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

export function CompetitiveHistory({ registrations }: CompetitiveHistoryProps) {
	if (registrations.length === 0) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Competitive History</CardTitle>
					<CardDescription>
						Your competition participation history
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="text-muted-foreground flex flex-col items-center justify-center py-12 text-center">
						<Trophy className="mb-4 h-12 w-12 opacity-20" />
						<p className="text-lg font-medium">No competitions yet</p>
						<p className="mt-1 text-sm">
							Register for a competition to start building your competitive
							history
						</p>
						<Button asChild className="mt-4">
							<Link href="/compete">Browse Competitions</Link>
						</Button>
					</div>
				</CardContent>
			</Card>
		)
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Competitive History</CardTitle>
				<CardDescription>
					{registrations.length}{" "}
					{registrations.length === 1 ? "competition" : "competitions"}
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="space-y-4">
					{registrations.map((registration) => {
						if (!registration.competition) return null
						const isTeamRegistration =
							(registration.division?.teamSize ?? 1) > 1

						return (
							<div
								key={registration.id}
								className="border-b last:border-b-0 pb-4 last:pb-0"
							>
								<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
									<div className="flex-1">
										<h3 className="font-semibold">
											<Link
												href={`/compete/${registration.competition.slug}`}
												className="hover:underline"
											>
												{registration.competition.name}
											</Link>
										</h3>

										{isTeamRegistration &&
											(registration.teamName ||
												registration.athleteTeam?.name) && (
												<p className="text-sm text-muted-foreground mt-1">
													<Users className="inline h-3 w-3 mr-1" />
													{registration.teamName ||
														registration.athleteTeam?.name}
												</p>
											)}

										<div className="mt-2 flex flex-wrap gap-3 text-sm">
											<div className="text-muted-foreground flex items-center gap-1">
												<Calendar className="h-3 w-3" />
												<span>
													{formatDate(registration.competition.startDate)}
												</span>
											</div>

											{registration.division && (
												<Badge variant="outline">
													{registration.division.label}
												</Badge>
											)}

											{registration.competition.organizingTeam && (
												<div className="text-muted-foreground flex items-center gap-1">
													<MapPin className="h-3 w-3" />
													<span>
														{registration.competition.organizingTeam.name}
													</span>
												</div>
											)}
										</div>
									</div>

									<div className="flex gap-2">
										{isTeamRegistration && (
											<Button asChild variant="outline" size="sm">
												<Link
													href={`/compete/${registration.competition.slug}/teams/${registration.id}`}
												>
													<Users className="h-3 w-3 mr-1" />
													Team
												</Link>
											</Button>
										)}
										<Button asChild variant="outline" size="sm">
											<Link href={`/compete/${registration.competition.slug}`}>
												View Event
											</Link>
										</Button>
									</div>
								</div>
							</div>
						)
					})}
				</div>
			</CardContent>
		</Card>
	)
}
