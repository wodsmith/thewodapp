import { Link } from "@tanstack/react-router"
import {
	Calendar,
	ExternalLink,
	Eye,
	EyeOff,
	Pencil,
	UserPlus,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatDateStringFull, isSameDateString } from "@/utils/date-utils"

interface CompetitionHeaderProps {
	competition: {
		id: string
		name: string
		slug: string
		description: string | null
		startDate: string // YYYY-MM-DD format
		endDate: string // YYYY-MM-DD format
		registrationOpensAt: string | null // YYYY-MM-DD format
		registrationClosesAt: string | null // YYYY-MM-DD format
		visibility: "public" | "private"
		status: "draft" | "published"
	}
}

function formatDateTime(date: string): string {
	return formatDateStringFull(date) || date
}

function getRegistrationStatus(
	opensAt: string | null,
	closesAt: string | null,
): { label: string; variant: "default" | "secondary" | "destructive" } | null {
	if (!opensAt || !closesAt) return null

	// Get today as YYYY-MM-DD for comparison
	const now = new Date()
	const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`

	if (todayStr < opensAt) {
		return { label: "Not Yet Open", variant: "secondary" }
	}
	if (todayStr > closesAt) {
		return { label: "Closed", variant: "destructive" }
	}
	return { label: "Open", variant: "default" }
}

export function CompetitionHeader({ competition }: CompetitionHeaderProps) {
	const registrationStatus = getRegistrationStatus(
		competition.registrationOpensAt,
		competition.registrationClosesAt,
	)

	return (
		<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
			<div className="min-w-0 flex-1">
				<h1 className="text-3xl font-bold">{competition.name}</h1>
				<div className="mt-2 flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:gap-4">
					<div className="flex items-center gap-2">
						{competition.status === "draft" ? (
							<Badge variant="secondary" className="shrink-0">
								Draft
							</Badge>
						) : (
							<Badge variant="default" className="shrink-0 bg-green-600">
								Published
							</Badge>
						)}
						{competition.visibility === "private" ? (
							<Badge variant="secondary" className="shrink-0">
								<EyeOff className="mr-1 h-3 w-3" />
								Private
							</Badge>
						) : (
							<Badge variant="outline" className="shrink-0">
								<Eye className="mr-1 h-3 w-3" />
								Public
							</Badge>
						)}
						{registrationStatus && (
							<Badge variant={registrationStatus.variant}>
								{registrationStatus.label}
							</Badge>
						)}
					</div>
					<div className="flex items-center gap-2">
						<Calendar className="h-4 w-4" />
						<span>
							{isSameDateString(competition.startDate, competition.endDate)
								? formatDateStringFull(competition.startDate)
								: `${formatDateStringFull(competition.startDate)} - ${formatDateStringFull(competition.endDate)}`}
						</span>
					</div>
					{competition.registrationOpensAt &&
						competition.registrationClosesAt && (
							<div className="flex items-center gap-2">
								<UserPlus className="h-4 w-4" />
								<span>
									Registration:{" "}
									{formatDateTime(competition.registrationOpensAt)} -{" "}
									{formatDateTime(competition.registrationClosesAt)}
								</span>
							</div>
						)}
				</div>
			</div>
			<div className="flex shrink-0 items-center gap-2">
				<a href={`/compete/organizer/${competition.id}/edit`}>
					<Button variant="outline" size="sm">
						<Pencil className="mr-2 h-4 w-4" />
						Edit
					</Button>
				</a>
				<Link to="/compete/$slug" params={{ slug: competition.slug }}>
					<Button variant="outline" size="sm">
						<ExternalLink className="mr-2 h-4 w-4" />
						View Public Page
					</Button>
				</Link>
			</div>
		</div>
	)
}
