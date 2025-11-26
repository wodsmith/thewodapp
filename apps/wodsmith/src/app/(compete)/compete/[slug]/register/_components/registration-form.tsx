"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
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
import type { Competition, ScalingGroup, ScalingLevel, Team } from "@/db/schema"

const registrationSchema = z.object({
	divisionId: z.string().min(1, "Please select a division"),
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
		},
	})

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
		execute({
			competitionId: competition.id,
			userId,
			divisionId: data.divisionId,
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
											onValueChange={field.onChange}
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
														{level.label}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
										<FormDescription>
											You'll compete in this division for the entire competition
										</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>
						</CardContent>
					</Card>

					<div className="flex gap-4">
						<Button
							type="submit"
							disabled={isPending || !registrationOpen}
							className="flex-1"
						>
							{isPending ? "Registering..." : !registrationOpen ? "Registration Closed" : "Complete Registration"}
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
