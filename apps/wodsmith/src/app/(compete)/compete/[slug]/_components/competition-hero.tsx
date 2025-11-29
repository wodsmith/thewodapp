import { Calendar, MapPin, Settings, Share2, Users } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { Competition, CompetitionGroup, Team } from "@/db/schema"

interface CompetitionHeroProps {
	competition: Competition & {
		organizingTeam: Team | null
		group: CompetitionGroup | null
	}
	registrationCount: number
	canManage?: boolean
}

function formatDateRange(startDate: Date | number, endDate: Date | number): string {
	const start = typeof startDate === "number" ? new Date(startDate) : startDate
	const end = typeof endDate === "number" ? new Date(endDate) : endDate

	const startMonth = start.toLocaleDateString("en-US", { month: "long" })
	const startDay = start.getDate()
	const endDay = end.getDate()
	const startYear = start.getFullYear()
	const endYear = end.getFullYear()

	// Same month
	if (start.getMonth() === end.getMonth() && startYear === endYear) {
		return `${startMonth} ${startDay}-${endDay}, ${startYear}`
	}

	// Different months
	const endMonth = end.toLocaleDateString("en-US", { month: "long" })
	if (startYear === endYear) {
		return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${startYear}`
	}
	return `${startMonth} ${startDay}, ${startYear} - ${endMonth} ${endDay}, ${endYear}`
}

export function CompetitionHero({ competition, registrationCount, canManage = false }: CompetitionHeroProps) {
	return (
		<div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white">
			<div className="container mx-auto px-4 py-8 md:py-12">
				<div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-8">
					{/* Event Logo Placeholder */}
					<div className="hidden md:flex h-36 w-36 shrink-0 items-center justify-center rounded-xl bg-slate-700/50 border border-slate-600 overflow-hidden">
						{competition.organizingTeam?.avatarUrl ? (
							<Image
								src={competition.organizingTeam.avatarUrl}
								alt={competition.name}
								width={144}
								height={144}
								className="h-full w-full object-cover"
								unoptimized
							/>
						) : (
							<span className="text-4xl font-bold text-slate-400">
								{competition.name.charAt(0)}
							</span>
						)}
					</div>

					{/* Event Details */}
					<div className="flex-1 space-y-4">
						<div className="flex items-start justify-between gap-4">
							<div className="space-y-1">
								{competition.group && (
									<p className="text-sm text-teal-400">{competition.group.name}</p>
								)}
								<h1 className="text-3xl font-bold md:text-4xl lg:text-5xl">
									{competition.name}
								</h1>
								<div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-2 text-slate-300">
									<span className="flex items-center gap-1.5">
										<Calendar className="h-4 w-4" />
										{formatDateRange(competition.startDate, competition.endDate)}
									</span>
									<span className="flex items-center gap-1.5">
										<MapPin className="h-4 w-4" />
										{competition.organizingTeam?.name || "Location TBA"}
									</span>
								</div>
							</div>
							<div className="flex items-center gap-2 shrink-0">
								{canManage && (
									<Link href={`/compete/organizer/${competition.id}`}>
										<Button
											variant="secondary"
											size="sm"
											className="bg-teal-600 text-white hover:bg-teal-500"
										>
											<Settings className="h-4 w-4 mr-1" />
											Manage
										</Button>
									</Link>
								)}
								<Button
									variant="ghost"
									size="icon"
									className="text-slate-400 hover:text-white hover:bg-slate-700"
								>
									<Share2 className="h-5 w-5" />
									<span className="sr-only">Share</span>
								</Button>
							</div>
						</div>

						{/* Quick Stats */}
						<div className="flex flex-wrap gap-2">
							<Badge variant="secondary" className="bg-slate-700/50 text-slate-200 hover:bg-slate-700">
								<Users className="mr-1 h-3 w-3" />
								{registrationCount} Athletes
							</Badge>
							{/* TODO: Add these badges when data is available */}
							{/* <Badge variant="secondary" className="bg-slate-700/50 text-slate-200">
								Teams of 2
							</Badge>
							<Badge variant="secondary" className="bg-slate-700/50 text-slate-200">
								6 Workouts
							</Badge> */}
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
