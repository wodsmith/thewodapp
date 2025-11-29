import { NextResponse } from "next/server"
import { getActiveOrPersonalTeamId, getSessionFromCookie } from "@/utils/auth"
import { getUserWorkouts } from "@/server/workouts"

export async function GET(request: Request) {
	try {
		const session = await getSessionFromCookie()
		if (!session?.user?.id) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
		}

		const { searchParams } = new URL(request.url)
		const query = searchParams.get("q") || ""
		const teamId = searchParams.get("teamId")

		if (!teamId) {
			return NextResponse.json({ error: "Team ID required" }, { status: 400 })
		}

		// Get workouts for the team
		const workouts = await getUserWorkouts({
			teamId,
			search: query,
			limit: 50,
		})

		return NextResponse.json({ workouts })
	} catch (error) {
		console.error("Error searching workouts:", error)
		return NextResponse.json(
			{ error: "Failed to search workouts" },
			{ status: 500 },
		)
	}
}
