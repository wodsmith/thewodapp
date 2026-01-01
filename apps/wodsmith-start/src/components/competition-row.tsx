"use client"

import { CalendarIcon, ChevronDown, MapPinIcon } from "lucide-react"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { ListItem } from "@/components/ui/list-item"
import type { CompetitionWithOrganizingTeam } from "@/server-fns/competition-fns"
import { cn } from "@/utils/cn"
import {
	formatUTCDateFull,
	formatUTCDateShort,
	isSameUTCDay,
} from "@/utils/date-utils"

type CompetitionStatus =
	| "registration-open"
	| "active"
	| "coming-soon"
	| "registration-closed"
	| "past"

interface CompetitionRowProps {
	competition: CompetitionWithOrganizingTeam
	status: CompetitionStatus
	isAuthenticated: boolean
}

export function CompetitionRow({
	competition,
	status,
	isAuthenticated,
}: CompetitionRowProps) {
	const [isOpen, setIsOpen] = useState(false)

	const getStatusBadge = () => {
		switch (status) {
			case "active":
				return (
					<Badge variant="default" className="bg-green-600 shrink-0">
						Live
					</Badge>
				)
			case "registration-open":
				return (
					<Badge variant="default" className="shrink-0">
						Open
					</Badge>
				)
			case "registration-closed":
				return (
					<Badge variant="outline" className="shrink-0">
						Registration Closed
					</Badge>
				)
			case "coming-soon":
				return (
					<Badge variant="secondary" className="shrink-0">
						Soon
					</Badge>
				)
			case "past":
				return (
					<Badge variant="outline" className="shrink-0 text-muted-foreground">
						Past
					</Badge>
				)
		}
	}

	const getDeadlineBadge = () => {
		if (!competition.registrationClosesAt || status !== "registration-open")
			return null
		const deadline = new Date(competition.registrationClosesAt)
		const now = new Date()
		const daysLeft = Math.ceil(
			(deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
		)

		if (daysLeft <= 0) return null
		if (daysLeft <= 3) {
			return (
				<Badge variant="destructive" className="shrink-0">
					{daysLeft}d left
				</Badge>
			)
		}
		return null
	}

	const getRegistrationDateText = () => {
		if (!competition.registrationOpensAt && !competition.registrationClosesAt)
			return null

		const regOpens = competition.registrationOpensAt
			? new Date(competition.registrationOpensAt)
			: null
		const regCloses = competition.registrationClosesAt
			? new Date(competition.registrationClosesAt)
			: null
		const now = new Date()

		if (status === "coming-soon" && regOpens && regOpens > now) {
			return `Register: ${formatUTCDateShort(regOpens)}`
		}
		if (status === "registration-open" && regOpens && regCloses) {
			return `Register: ${formatUTCDateShort(regOpens)} - ${formatUTCDateShort(regCloses)}`
		}
		if (status === "registration-closed" && regCloses) {
			return `Closed: ${formatUTCDateShort(regCloses)}`
		}
		if (regCloses && regCloses > now) {
			return `Register by ${formatUTCDateShort(regCloses)}`
		}
		return null
	}

	const registrationText = getRegistrationDateText()

	return (
		<Collapsible open={isOpen} onOpenChange={setIsOpen}>
			<ListItem className="flex-col sm:flex-row sm:items-center border-b last:border-b-0">
				<ListItem.Content className="flex-1 min-w-0 w-full">
					<div className="flex items-center gap-3 w-full">
						{/* Status badges + registration dates */}
						<div className="flex items-center gap-2 shrink-0">
							{getStatusBadge()}
							{getDeadlineBadge()}
							{registrationText && (
								<span className="text-xs text-muted-foreground hidden sm:inline">
									{registrationText}
								</span>
							)}
						</div>

						{/* Competition name - links to detail page */}
						<a
							href={`/compete/${competition.slug}`}
							className="font-semibold hover:underline underline-offset-4 truncate min-w-0"
						>
							{competition.name}
						</a>

						{/* Event dates + gym - visible on larger screens */}
						<div className="hidden md:flex items-center gap-3 text-sm text-muted-foreground ml-auto shrink-0">
							<span className="flex items-center gap-1">
								<CalendarIcon className="h-3.5 w-3.5" />
								Event:{" "}
								{isSameUTCDay(competition.startDate, competition.endDate)
									? formatUTCDateShort(competition.startDate)
									: `${formatUTCDateShort(competition.startDate)} - ${formatUTCDateShort(competition.endDate)}`}
							</span>
							{competition.organizingTeam && (
								<span className="flex items-center gap-1">
									<MapPinIcon className="h-3.5 w-3.5" />
									{competition.organizingTeam.name}
								</span>
							)}
						</div>
					</div>

					{/* Mobile metadata */}
					<div className="flex md:hidden flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground mt-1">
						{registrationText && (
							<span className="text-xs">{registrationText}</span>
						)}
						<span className="flex items-center gap-1">
							<CalendarIcon className="h-3 w-3" />
							Event:{" "}
							{isSameUTCDay(competition.startDate, competition.endDate)
								? formatUTCDateShort(competition.startDate)
								: `${formatUTCDateShort(competition.startDate)} - ${formatUTCDateShort(competition.endDate)}`}
						</span>
						{competition.organizingTeam && (
							<span className="flex items-center gap-1 truncate">
								<MapPinIcon className="h-3 w-3 shrink-0" />
								<span className="truncate">
									{competition.organizingTeam.name}
								</span>
							</span>
						)}
					</div>
				</ListItem.Content>

				<ListItem.Actions className="w-full sm:w-auto mt-2 sm:mt-0">
					<div className="flex items-center gap-2">
						{/* View button */}
						<Button asChild size="sm" variant="secondary">
							<a href={`/compete/${competition.slug}`}>View</a>
						</Button>

						{/* Expand toggle */}
						<CollapsibleTrigger asChild>
							<Button variant="ghost" size="sm" className="px-2">
								<ChevronDown
									className={cn(
										"h-4 w-4 transition-transform",
										isOpen && "rotate-180",
									)}
								/>
								<span className="sr-only">Toggle details</span>
							</Button>
						</CollapsibleTrigger>
					</div>
				</ListItem.Actions>
			</ListItem>

			<CollapsibleContent>
				<div className="px-4 py-4 bg-muted/30 border-b space-y-3">
					{/* Description */}
					{competition.description && (
						<p className="text-sm text-muted-foreground">
							{competition.description}
						</p>
					)}

					{/* Registration info */}
					{status === "registration-open" &&
						competition.registrationClosesAt && (
							<p className="text-sm">
								<span className="text-muted-foreground">
									Registration closes:{" "}
								</span>
								<span className="font-medium">
									{formatUTCDateFull(competition.registrationClosesAt)}
								</span>
							</p>
						)}

					{status === "registration-closed" &&
						competition.registrationClosesAt && (
							<p className="text-sm">
								<span className="text-muted-foreground">
									Registration closed:{" "}
								</span>
								<span className="font-medium">
									{formatUTCDateFull(competition.registrationClosesAt)}
								</span>
							</p>
						)}

					{status === "coming-soon" && competition.registrationOpensAt && (
						<p className="text-sm">
							<span className="text-muted-foreground">
								Registration opens:{" "}
							</span>
							<span className="font-medium">
								{formatUTCDateFull(competition.registrationOpensAt)}
							</span>
						</p>
					)}

					{/* TODO: Workouts will be displayed here when relation exists */}

					{/* Registration CTA for unauthenticated users */}
					{status === "registration-open" && !isAuthenticated && (
						<div className="flex gap-2 pt-2">
							<a href="/sign-in?redirect=/compete">
								<Button size="sm">Sign In to Register</Button>
							</a>
							<a href="/sign-up?redirect=/compete">
								<Button size="sm" variant="outline">
									Create Account
								</Button>
							</a>
						</div>
					)}
				</div>
			</CollapsibleContent>
		</Collapsible>
	)
}
