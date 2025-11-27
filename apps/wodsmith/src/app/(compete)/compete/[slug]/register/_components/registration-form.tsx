"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { useForm, useFieldArray } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { useServerAction } from "@repo/zsa-react"
import { registerForCompetitionAction } from "@/actions/competition-actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Users, User } from "lucide-react"
import type { Competition, ScalingGroup, ScalingLevel, Team } from "@/db/schema"

const teammateSchema = z.object({
	email: z.string().email("Valid email required"),
	firstName: z.string().max(255).optional(),
	lastName: z.string().max(255).optional(),
	affiliateName: z.string().max(255).optional(),
})

const registrationSchema = z.object({
	divisionId: z.string().min(1, "Please select a division"),
	// Team fields (validated based on division.teamSize)
	teamName: z.string().max(255).optional(),
	affiliateName: z.string().max(255).optional(),
	teammates: z.array(teammateSchema).optional(),
})

type FormValues = z.infer<typeof registrationSchema>

type Props = {
	competition: Competition & { organizingTeam: Team | null }
	scalingGroup: ScalingGroup & { scalingLevels: ScalingLevel[] }
	userId: string
	registrationOpen: boolean
	registrationOpensAt: Date | null
	registrationClosesAt: Date | null
}

export function RegistrationForm({
	competition,
	scalingGroup,
	userId,
	registrationOpen,
	registrationOpensAt,
	registrationClosesAt,
}: Props) {
	const router = useRouter()

	const form = useForm<FormValues>({
		resolver: zodResolver(registrationSchema),
		defaultValues: {
			divisionId: "",
			teamName: "",
			affiliateName: "",
			teammates: [],
		},
	})

	const { fields, replace } = useFieldArray({
		control: form.control,
		name: "teammates",
	})

	const selectedDivisionId = form.watch("divisionId")
	const selectedDivision = scalingGroup.scalingLevels.find(
		(level) => level.id === selectedDivisionId
	)
	const isTeamDivision = (selectedDivision?.teamSize ?? 1) > 1
	const teamSize = selectedDivision?.teamSize ?? 1
	const teammatesNeeded = teamSize - 1

	// Update teammates array when division changes
	const handleDivisionChange = (divisionId: string) => {
		form.setValue("divisionId", divisionId)
		const division = scalingGroup.scalingLevels.find((l) => l.id === divisionId)
		const newTeamSize = division?.teamSize ?? 1
		const newTeammatesNeeded = newTeamSize - 1

		if (newTeammatesNeeded > 0) {
			// Initialize teammates array with empty objects
			const currentTeammates = form.getValues("teammates") || []
			const newTeammates = Array.from({ length: newTeammatesNeeded }, (_, i) => ({
				email: currentTeammates[i]?.email ?? "",
				firstName: currentTeammates[i]?.firstName ?? "",
				lastName: currentTeammates[i]?.lastName ?? "",
				affiliateName: currentTeammates[i]?.affiliateName ?? "",
			}))
			replace(newTeammates)
		} else {
			replace([])
			form.setValue("teamName", "")
		}
	}

	const { execute, isPending } = useServerAction(registerForCompetitionAction, {
		onSuccess: () => {
			toast.success("Successfully registered for the competition!")
			router.push(`/compete/${competition.slug}`)
		},
		onError: ({ err }) => {
			toast.error(err?.message || "Failed to register for competition")
		},
	})

	const onSubmit = (data: FormValues) => {
		// Validate team fields for team divisions
		if (isTeamDivision) {
			if (!data.teamName?.trim()) {
				toast.error("Team name is required for team divisions")
				return
			}
			if (!data.teammates || data.teammates.length !== teammatesNeeded) {
				toast.error(`Please add ${teammatesNeeded} teammate(s)`)
				return
			}
			for (const teammate of data.teammates) {
				if (!teammate.email?.trim()) {
					toast.error("All teammate emails are required")
					return
				}
			}
		}

		execute({
			competitionId: competition.id,
			userId,
			divisionId: data.divisionId,
			teamName: isTeamDivision ? data.teamName : undefined,
			affiliateName: data.affiliateName || undefined,
			teammates: isTeamDivision ? data.teammates : undefined,
		})
	}

	const formatDate = (date: Date | number | null): string => {
		if (!date) return "TBA"
		const d = typeof date === "number" ? new Date(date) : date
		return d.toLocaleDateString("en-US", {
			weekday: "long",
			month: "long",
			day: "numeric",
			year: "numeric",
		})
	}

	const getRegistrationMessage = () => {
		if (!registrationOpensAt || !registrationClosesAt) {
			return "Registration dates have not been set yet."
		}

		const now = new Date()
		if (now < registrationOpensAt) {
			return `Registration opens ${formatDate(registrationOpensAt)} and closes ${formatDate(registrationClosesAt)}`
		}
		if (now > registrationClosesAt) {
			return `Registration was open from ${formatDate(registrationOpensAt)} to ${formatDate(registrationClosesAt)}`
		}
		return null
	}

	const registrationMessage = getRegistrationMessage()

	return (
		<div className="space-y-6">
			<div className="space-y-2">
				<h1 className="text-3xl font-bold">Register for Competition</h1>
				<p className="text-muted-foreground">{competition.name}</p>
			</div>

			{!registrationOpen && registrationMessage && (
				<Card className="border-yellow-500/50 bg-yellow-500/10">
					<CardContent className="pt-6">
						<p className="text-sm font-medium">{registrationMessage}</p>
					</CardContent>
				</Card>
			)}

			<Card>
				<CardHeader>
					<CardTitle>Competition Details</CardTitle>
				</CardHeader>
				<CardContent className="space-y-2">
					<div>
						<p className="text-muted-foreground text-sm">Competition Dates</p>
						<p className="font-medium">
							{formatDate(competition.startDate)} - {formatDate(competition.endDate)}
						</p>
					</div>
					<div>
						<p className="text-muted-foreground text-sm">Registration Window</p>
						<p className="font-medium">
							{formatDate(registrationOpensAt)} - {formatDate(registrationClosesAt)}
						</p>
					</div>
					<div>
						<p className="text-muted-foreground text-sm">Hosted By</p>
						<p className="font-medium">{competition.organizingTeam?.name || "TBA"}</p>
					</div>
				</CardContent>
			</Card>

			<Form {...form}>
				<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
					<Card>
						<CardHeader>
							<CardTitle>Select Your Division</CardTitle>
							<CardDescription>
								Choose the division that best matches your skill level
							</CardDescription>
						</CardHeader>
						<CardContent>
							<FormField
								control={form.control}
								name="divisionId"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Division</FormLabel>
										<Select
											onValueChange={handleDivisionChange}
											defaultValue={field.value}
											disabled={isPending || !registrationOpen}
										>
											<FormControl>
												<SelectTrigger>
													<SelectValue placeholder="Select a division" />
												</SelectTrigger>
											</FormControl>
											<SelectContent>
												{scalingGroup.scalingLevels.map((level) => (
													<SelectItem key={level.id} value={level.id}>
														<div className="flex items-center gap-2">
															{level.label}
															{(level.teamSize ?? 1) > 1 ? (
																<Badge variant="secondary" className="ml-1 text-xs">
																	<Users className="w-3 h-3 mr-1" />
																	{level.teamSize}
																</Badge>
															) : (
																<Badge variant="outline" className="ml-1 text-xs">
																	<User className="w-3 h-3 mr-1" />
																	Individual
																</Badge>
															)}
														</div>
													</SelectItem>
												))}
											</SelectContent>
										</Select>
										<FormDescription>
											{isTeamDivision
												? `Team division - requires ${teamSize} athletes (you + ${teammatesNeeded} teammate${teammatesNeeded > 1 ? "s" : ""})`
												: "Individual division - compete on your own"}
										</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>
						</CardContent>
					</Card>

					{/* Team Registration Fields */}
					{isTeamDivision && (
						<Card>
							<CardHeader>
								<CardTitle>Team Details</CardTitle>
								<CardDescription>
									Enter your team name and invite your teammates
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-6">
								<FormField
									control={form.control}
									name="teamName"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Team Name</FormLabel>
											<FormControl>
												<Input
													placeholder="Enter your team name"
													{...field}
													disabled={isPending || !registrationOpen}
												/>
											</FormControl>
											<FormDescription>
												This will be displayed on leaderboards
											</FormDescription>
											<FormMessage />
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name="affiliateName"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Your Affiliate (Optional)</FormLabel>
											<FormControl>
												<Input
													placeholder="e.g., CrossFit Downtown"
													{...field}
													disabled={isPending || !registrationOpen}
												/>
											</FormControl>
											<FormDescription>
												Your gym or affiliate name
											</FormDescription>
											<FormMessage />
										</FormItem>
									)}
								/>

								{/* Teammates */}
								<div className="space-y-4">
									<div className="flex items-center justify-between">
										<h4 className="text-sm font-medium">Teammates</h4>
										<Badge variant="outline">
											{fields.length} of {teammatesNeeded} added
										</Badge>
									</div>

									{fields.map((field, index) => (
										<Card key={field.id} className="p-4">
											<div className="space-y-4">
												<div className="flex items-center gap-2">
													<Users className="w-4 h-4 text-muted-foreground" />
													<span className="font-medium">Teammate {index + 1}</span>
												</div>

												<FormField
													control={form.control}
													name={`teammates.${index}.email`}
													render={({ field }) => (
														<FormItem>
															<FormLabel>Email *</FormLabel>
															<FormControl>
																<Input
																	type="email"
																	placeholder="teammate@email.com"
																	{...field}
																	disabled={isPending || !registrationOpen}
																/>
															</FormControl>
															<FormMessage />
														</FormItem>
													)}
												/>

												<div className="grid grid-cols-2 gap-4">
													<FormField
														control={form.control}
														name={`teammates.${index}.firstName`}
														render={({ field }) => (
															<FormItem>
																<FormLabel>First Name</FormLabel>
																<FormControl>
																	<Input
																		placeholder="First name"
																		{...field}
																		disabled={isPending || !registrationOpen}
																	/>
																</FormControl>
																<FormMessage />
															</FormItem>
														)}
													/>

													<FormField
														control={form.control}
														name={`teammates.${index}.lastName`}
														render={({ field }) => (
															<FormItem>
																<FormLabel>Last Name</FormLabel>
																<FormControl>
																	<Input
																		placeholder="Last name"
																		{...field}
																		disabled={isPending || !registrationOpen}
																	/>
																</FormControl>
																<FormMessage />
															</FormItem>
														)}
													/>
												</div>

												<FormField
													control={form.control}
													name={`teammates.${index}.affiliateName`}
													render={({ field }) => (
														<FormItem>
															<FormLabel>Affiliate (Optional)</FormLabel>
															<FormControl>
																<Input
																	placeholder="e.g., CrossFit Downtown"
																	{...field}
																	disabled={isPending || !registrationOpen}
																/>
															</FormControl>
															<FormMessage />
														</FormItem>
													)}
												/>
											</div>
										</Card>
									))}

									<p className="text-sm text-muted-foreground">
										Teammates will receive an email invitation to join your team.
										They must accept the invite to complete their registration.
									</p>
								</div>
							</CardContent>
						</Card>
					)}

					<div className="flex gap-4">
						<Button
							type="submit"
							disabled={isPending || !registrationOpen}
							className="flex-1"
						>
							{isPending
								? "Registering..."
								: !registrationOpen
									? "Registration Closed"
									: isTeamDivision
										? "Register Team"
										: "Complete Registration"}
						</Button>
						<Button
							type="button"
							variant="outline"
							onClick={() => router.push(`/compete/${competition.slug}`)}
							disabled={isPending}
						>
							Cancel
						</Button>
					</div>
				</form>
			</Form>
		</div>
	)
}
