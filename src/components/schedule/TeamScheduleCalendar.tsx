"use client"

import React from "react"

interface ScheduledWorkout {
	id: string
	date: string
}

interface Props {
	teamId: string
}

export default function TeamScheduleCalendar({ teamId }: Props) {
	// TODO: fetch scheduled workouts via schedulingService.getScheduledWorkoutsForTeam
	const workouts: ScheduledWorkout[] = []

	return (
		<section className="space-y-2">
			<h2 className="text-xl font-semibold">Schedule</h2>
			{workouts.length === 0 ? (
				<p>No workouts scheduled.</p>
			) : (
				<ul>
					{workouts.map((w) => (
						<li key={w.id}>{w.date}</li>
					))}
				</ul>
			)}
		</section>
	)
}
