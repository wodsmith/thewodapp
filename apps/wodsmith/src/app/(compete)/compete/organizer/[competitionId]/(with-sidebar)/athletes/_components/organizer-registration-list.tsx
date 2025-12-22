"use client"

import { Calendar, Mail, Users } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table"
import type { Waiver } from "@/db/schemas/waivers"
import { WaiverStatusBadge } from "./waiver-status-badge"

interface TeamMember {
	id: string
	userId: string
	roleId: string | null
	user: {
		id: string
		firstName: string | null
		lastName: string | null
		email: string | null
		avatar: string | null
	} | null
}

interface WaiverSignature {
	id: string
	waiverId: string
	userId: string
	signedAt: Date
}

interface Registration {
	id: string
	registeredAt: Date
	teamName: string | null
	pendingTeammates: string | null
	userId: string
	user: {
		id: string
		firstName: string | null
		lastName: string | null
		email: string | null
		avatar: string | null
		gender: string | null
		dateOfBirth: Date | null
	} | null
	division: {
		id: string
		label: string
		teamSize: number
	} | null
	athleteTeam: {
		id: string
		memberships?: TeamMember[]
		[key: string]: unknown
	} | null
	waiverSignatures?: WaiverSignature[]
}

interface Division {
	id: string
	label: string
	registrationCount: number
}

interface OrganizerRegistrationListProps {
	competitionId: string
	registrations: Registration[]
	divisions: Division[]
	waivers: Waiver[]
	currentDivisionFilter?: string
	currentWaiverStatusFilter?: "all" | "complete" | "pending"
}

export function OrganizerRegistrationList({
	competitionId,
	registrations,
	divisions,
	waivers,
	currentDivisionFilter,
	currentWaiverStatusFilter,
}: OrganizerRegistrationListProps) {
	const router = useRouter()
	const searchParams = useSearchParams()

	const handleDivisionChange = (value: string) => {
		const params = new URLSearchParams(searchParams.toString())
		if (value === "all") {
			params.delete("division")
		} else {
			params.set("division", value)
		}
		router.push(
			`/compete/organizer/${competitionId}/athletes?${params.toString()}`,
		)
	}

	const handleWaiverStatusChange = (value: string) => {
		const params = new URLSearchParams(searchParams.toString())
		if (value === "all") {
			params.delete("waiverStatus")
		} else {
			params.set("waiverStatus", value)
		}
		router.push(
			`/compete/organizer/${competitionId}/athletes?${params.toString()}`,
		)
	}

	const formatDate = (date: Date) => {
		return new Date(date).toLocaleDateString(undefined, {
			year: "numeric",
			month: "short",
			day: "numeric",
		})
	}

	const getInitials = (firstName: string | null, lastName: string | null) => {
		const first = firstName?.[0] || ""
		const last = lastName?.[0] || ""
		return (first + last).toUpperCase() || "?"
	}

	const getPendingCount = (pendingTeammates: string | null): number => {
		if (!pendingTeammates) return 0
		try {
			const pending = JSON.parse(pendingTeammates) as unknown[]
			return pending.length
		} catch {
			return 0
		}
	}

	// Check if a registration has all required waivers signed
	const hasAllWaiversSigned = (registration: Registration): boolean => {
		const requiredWaivers = waivers.filter((w) => w.required)
		if (requiredWaivers.length === 0) return true

		const signedWaiverIds =
			registration.waiverSignatures?.map((s) => s.waiverId) ?? []
		return requiredWaivers.every((w) => signedWaiverIds.includes(w.id))
	}

	// Filter registrations by waiver status
	const filteredRegistrations = registrations.filter((registration) => {
		if (!currentWaiverStatusFilter || currentWaiverStatusFilter === "all") {
			return true
		}

		const allSigned = hasAllWaiversSigned(registration)

		if (currentWaiverStatusFilter === "complete") {
			return allSigned
		}

		if (currentWaiverStatusFilter === "pending") {
			return !allSigned
		}

		return true
	})

	if (
		registrations.length === 0 &&
		!currentDivisionFilter &&
		!currentWaiverStatusFilter
	) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>No Registrations</CardTitle>
					<CardDescription>
						No athletes have registered for this competition yet.
					</CardDescription>
				</CardHeader>
			</Card>
		)
	}

	return (
		<div className="flex flex-col gap-4">
			{/* Filters */}
			<div className="flex items-center gap-4">
				<Select
					value={currentDivisionFilter || "all"}
					onValueChange={handleDivisionChange}
				>
					<SelectTrigger className="w-[200px]">
						<SelectValue placeholder="All Divisions" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All Divisions</SelectItem>
						{divisions.map((division) => (
							<SelectItem key={division.id} value={division.id}>
								{division.label} ({division.registrationCount})
							</SelectItem>
						))}
					</SelectContent>
				</Select>

				{waivers.some((w) => w.required) && (
					<Select
						value={currentWaiverStatusFilter || "all"}
						onValueChange={handleWaiverStatusChange}
					>
						<SelectTrigger className="w-[200px]">
							<SelectValue placeholder="All Waiver Statuses" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Waiver Statuses</SelectItem>
							<SelectItem value="complete">Complete</SelectItem>
							<SelectItem value="pending">Pending</SelectItem>
						</SelectContent>
					</Select>
				)}
			</div>

			{filteredRegistrations.length === 0 ? (
				<Card>
					<CardHeader>
						<CardTitle>No Registrations</CardTitle>
						<CardDescription>
							No athletes match the selected filters.
						</CardDescription>
					</CardHeader>
				</Card>
			) : (
				<Card>
					<CardContent className="p-0">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead className="w-[50px]">#</TableHead>
									<TableHead>Athlete</TableHead>
									<TableHead>Division</TableHead>
									<TableHead>Team</TableHead>
									<TableHead>Waivers</TableHead>
									<TableHead>
										<span className="flex items-center gap-1">
											<Calendar className="h-3.5 w-3.5" />
											Registered
										</span>
									</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{filteredRegistrations.map((registration, index) => {
									const pendingCount = getPendingCount(
										registration.pendingTeammates,
									)
									const isTeamDivision =
										(registration.division?.teamSize ?? 1) > 1

									// Get teammates (non-captain members)
									const teammates =
										registration.athleteTeam?.memberships?.filter(
											(m) => m.userId !== registration.userId && m.user,
										) ?? []

									return (
										<TableRow key={registration.id}>
											<TableCell className="text-muted-foreground font-mono text-sm align-top pt-4">
												{index + 1}
											</TableCell>
											<TableCell>
												<div className="flex flex-col gap-2">
													{/* Captain */}
													<div className="flex items-center gap-3">
														<Avatar className="h-8 w-8">
															<AvatarImage
																src={registration.user?.avatar ?? undefined}
																alt={`${registration.user?.firstName ?? ""} ${registration.user?.lastName ?? ""}`}
															/>
															<AvatarFallback className="text-xs">
																{getInitials(
																	registration.user?.firstName ?? null,
																	registration.user?.lastName ?? null,
																)}
															</AvatarFallback>
														</Avatar>
														<div className="flex flex-col">
															<span className="font-medium">
																{registration.user?.firstName ?? ""}{" "}
																{registration.user?.lastName ?? ""}
																{isTeamDivision && (
																	<span className="text-xs text-muted-foreground ml-1">
																		(captain)
																	</span>
																)}
															</span>
															<span className="text-xs text-muted-foreground flex items-center gap-1">
																<Mail className="h-3 w-3" />
																{registration.user?.email}
															</span>
														</div>
													</div>
													{/* Teammates */}
													{teammates.length > 0 && (
														<div className="ml-11 flex flex-col gap-1">
															{teammates.map((member) => (
																<div
																	key={member.id}
																	className="flex items-center gap-2 text-sm text-muted-foreground"
																>
																	<Avatar className="h-5 w-5">
																		<AvatarImage
																			src={member.user?.avatar ?? undefined}
																			alt={`${member.user?.firstName ?? ""} ${member.user?.lastName ?? ""}`}
																		/>
																		<AvatarFallback className="text-[10px]">
																			{getInitials(
																				member.user?.firstName ?? null,
																				member.user?.lastName ?? null,
																			)}
																		</AvatarFallback>
																	</Avatar>
																	<span>
																		{member.user?.firstName ?? ""}{" "}
																		{member.user?.lastName ?? ""}
																	</span>
																</div>
															))}
														</div>
													)}
												</div>
											</TableCell>
											<TableCell className="align-top pt-4">
												<Badge variant="outline">
													{registration.division?.label ?? "Unknown"}
												</Badge>
											</TableCell>
											<TableCell className="align-top pt-4">
												{isTeamDivision ? (
													<div className="flex flex-col gap-1">
														<span className="font-medium">
															{registration.teamName ?? "—"}
														</span>
														{pendingCount > 0 && (
															<span className="text-xs text-amber-600 flex items-center gap-1">
																<Users className="h-3 w-3" />
																{pendingCount} pending
															</span>
														)}
													</div>
												) : (
													<span className="text-muted-foreground">—</span>
												)}
											</TableCell>
											<TableCell className="align-top pt-4">
												<WaiverStatusBadge
													requiredWaivers={waivers}
													signedWaiverIds={
														registration.waiverSignatures?.map(
															(s) => s.waiverId,
														) ?? []
													}
												/>
											</TableCell>
											<TableCell className="text-muted-foreground text-sm align-top pt-4">
												{formatDate(registration.registeredAt)}
											</TableCell>
										</TableRow>
									)
								})}
							</TableBody>
						</Table>
					</CardContent>
				</Card>
			)}
		</div>
	)
}
