import "server-only"

import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { getDb } from "@/db"
import { getHeatsForWorkout } from "@/server/competition-heats"
import { getCompetitionWorkouts } from "@/server/competition-workouts"
import { getCompetition } from "@/server/competitions"
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
		getCompetitionWorkouts(db, competition.id),
		getJudgeVolunteers(db, competition.competitionTeamId),
	])

	// Get heats for all events
	const allHeats = await Promise.all(
		events.map((event) => getHeatsForWorkout(event.id)),
	)
	const heats = allHeats.flat()

	// Get judge assignments for all events
	const allAssignments = await Promise.all(
		events.map((event) => getJudgeHeatAssignments(db, event.id)),
	)
	const judgeAssignments = allAssignments.flat()

	return (
		<JudgeSchedulingContainer
			competitionId={competition.id}
			organizingTeamId={competition.organizingTeamId}
			events={events}
			heats={heats}
			judges={judges}
			judgeAssignments={judgeAssignments}
		/>
	)
}
