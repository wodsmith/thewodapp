import "server-only"

import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { getDb } from "@/db"
import { getHeatsForWorkout } from "@/server/competition-heats"
import { getCompetitionWorkouts } from "@/server/competition-workouts"
import { getCompetition } from "@/server/competitions"
import {
	getActiveVersion,
	getVersionHistory,
} from "@/server/judge-assignments"
import { getRotationsForEvent } from "@/server/judge-rotations"
import {
	getJudgeHeatAssignments,
	getJudgeVolunteers,
} from "@/server/judge-scheduling"

import { JudgeSchedulingContainer } from "./_components/judge-scheduling-container"

interface JudgeSchedulingPageProps {
	params: Promise<{
		competitionId: string
	}>
}

export async function generateMetadata({
	params,
}: JudgeSchedulingPageProps): Promise<Metadata> {
	const { competitionId } = await params
	const competition = await getCompetition(competitionId)

	if (!competition) {
		return {
			title: "Competition Not Found",
		}
	}

	return {
		title: `${competition.name} - Judge Scheduling`,
		description: `Assign judges to heats for ${competition.name}`,
	}
}

export default async function JudgeSchedulingPage({
	params,
}: JudgeSchedulingPageProps) {
	const { competitionId } = await params

	// Get competition (layout already validated access)
	const competition = await getCompetition(competitionId)

	if (!competition) {
		notFound()
	}

	const db = getDb()

	// Parallel fetch: events, judges, heats
	const [events, judges] = await Promise.all([
		getCompetitionWorkouts(competition.id),
		getJudgeVolunteers(db, competition.competitionTeamId),
	])

	// Get heats for all events
	const allHeats = await Promise.all(
		events.map((event) => getHeatsForWorkout(event.id)),
	)
	const heats = allHeats.flat()

	// Get judge assignments, rotations, and version data for all events
	const [allAssignments, allRotationResults, allVersionHistory, allActiveVersions] = await Promise.all([
		Promise.all(events.map((event) => getJudgeHeatAssignments(db, event.id))),
		Promise.all(events.map((event) => getRotationsForEvent(db, event.id))),
		Promise.all(events.map((event) => getVersionHistory(db, event.id))),
		Promise.all(events.map((event) => getActiveVersion(db, event.id))),
	])
	const judgeAssignments = allAssignments.flat()
	// Extract rotations from the new { rotations, eventDefaults } return type
	const rotations = allRotationResults.flatMap((result) => result.rotations)
	// Build event defaults map for each event
	const eventDefaultsMap = new Map(
		events.map((event, index) => {
			const result = allRotationResults[index]
			return [
				event.id,
				result?.eventDefaults ?? {
					defaultHeatsCount: null,
					defaultLaneShiftPattern: null,
				},
			]
		}),
	)
	// Build version history map for each event
	const versionHistoryMap = new Map(
		events.map((event, index) => [event.id, allVersionHistory[index] ?? []]),
	)
	// Build active version map for each event
	const activeVersionMap = new Map(
		events.map((event, index) => [event.id, allActiveVersions[index] ?? null]),
	)

	return (
		<JudgeSchedulingContainer
			competitionId={competition.id}
			organizingTeamId={competition.organizingTeamId}
			events={events}
			heats={heats}
			judges={judges}
			judgeAssignments={judgeAssignments}
			rotations={rotations}
			eventDefaultsMap={eventDefaultsMap}
			versionHistoryMap={versionHistoryMap}
			activeVersionMap={activeVersionMap}
			competitionDefaultHeats={competition.defaultHeatsPerRotation ?? 4}
			competitionDefaultPattern={
				(competition.defaultLaneShiftPattern as
					| "stay"
					| "shift_right"
					| "shift_left") ?? "shift_right"
			}
		/>
	)
}
