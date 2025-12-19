"use client"

import { useCallback, useState } from "react"
import type { CompetitionVenue } from "@/db/schema"
import type { HeatWithAssignments } from "@/server/competition-heats"
import type { CompetitionWorkout } from "@/server/competition-workouts"
import { HeatScheduleManager } from "./heat-schedule-manager"
import { VenueManager } from "./venue-manager"

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
	competitionStartDate: Date | null
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
	const [venues, setVenues] = useState(initialVenues)
	const [heats, setHeats] = useState(initialHeats)

	// Handle venue updates and propagate to heats
	const handleVenueUpdate = useCallback((updatedVenue: CompetitionVenue) => {
		setVenues((prev) =>
			prev.map((v) => (v.id === updatedVenue.id ? updatedVenue : v)),
		)

		// Update heats that use this venue
		setHeats((prev) =>
			prev.map((heat) => {
				if (heat.venueId === updatedVenue.id) {
					return { ...heat, venue: updatedVenue }
				}
				return heat
			}),
		)
	}, [])

	const handleVenueCreate = useCallback((newVenue: CompetitionVenue) => {
		setVenues((prev) => [...prev, newVenue])
	}, [])

	const handleVenueDelete = useCallback((venueId: string) => {
		setVenues((prev) => prev.filter((v) => v.id !== venueId))
		// Heats with this venue will have venue set to null via FK cascade
		setHeats((prev) =>
			prev.map((heat) => {
				if (heat.venueId === venueId) {
					return { ...heat, venue: null }
				}
				return heat
			}),
		)
	}, [])

	return (
		<div className="space-y-8">
			{/* Venue Manager */}
			<section>
				<h2 className="text-lg font-semibold mb-4">Venues</h2>
				<VenueManager
					competitionId={competitionId}
					organizingTeamId={organizingTeamId}
					venues={venues}
					onVenueUpdate={handleVenueUpdate}
					onVenueCreate={handleVenueCreate}
					onVenueDelete={handleVenueDelete}
				/>
			</section>

			{/* Heat Schedule Manager */}
			<section>
				<h2 className="text-lg font-semibold mb-4">Heat Schedule</h2>
				<HeatScheduleManager
					competitionId={competitionId}
					organizingTeamId={organizingTeamId}
					competitionStartDate={competitionStartDate}
					events={events}
					venues={venues}
					heats={heats}
					divisions={divisions}
					registrations={registrations}
					onHeatsChange={setHeats}
				/>
			</section>
		</div>
	)
}
