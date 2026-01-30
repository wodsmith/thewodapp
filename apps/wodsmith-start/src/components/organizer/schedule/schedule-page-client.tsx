"use client"

import { useState } from "react"
import type { CompetitionVenue } from "@/db/schemas/competitions"
import type { HeatWithAssignments } from "@/server-fns/competition-heats-fns"
import type { CompetitionWorkout } from "@/server-fns/competition-workouts-fns"
import { HeatScheduleManager } from "./heat-schedule-manager"
import { VenuesSummary } from "./venues-summary"

interface Division {
	id: string
	label: string
	position: number
	registrationCount: number
	description: string | null
	feeCents: number | null
}

interface Registration {
	id: string
	teamName: string | null
	registeredAt: Date
	user: {
		id: string
		firstName: string | null
		lastName: string | null
	}
	division: {
		id: string
		label: string
	} | null
}

interface SchedulePageClientProps {
	competitionId: string
	organizingTeamId: string
	competitionStartDate: string | null // YYYY-MM-DD format
	initialVenues: CompetitionVenue[]
	events: CompetitionWorkout[]
	initialHeats: HeatWithAssignments[]
	divisions: Division[]
	registrations: Registration[]
}

export function SchedulePageClient({
	competitionId,
	organizingTeamId,
	competitionStartDate,
	initialVenues,
	events,
	initialHeats,
	divisions,
	registrations,
}: SchedulePageClientProps) {
	const [heats, setHeats] = useState(initialHeats)

	return (
		<div className="space-y-8">
			{/* Venues Summary */}
			<section>
				<h2 className="text-lg font-semibold mb-4">Venues</h2>
				<VenuesSummary competitionId={competitionId} venues={initialVenues} />
			</section>

			{/* Heat Schedule Manager */}
			<section>
				<h2 className="text-lg font-semibold mb-4">Heat Schedule</h2>
				<HeatScheduleManager
					competitionId={competitionId}
					organizingTeamId={organizingTeamId}
					competitionStartDate={competitionStartDate}
					events={events}
					venues={initialVenues}
					heats={heats}
					divisions={divisions}
					registrations={registrations}
					onHeatsChange={setHeats}
				/>
			</section>
		</div>
	)
}
