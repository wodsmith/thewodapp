import { NextResponse } from "next/server"
import { getUserWorkouts } from "@/server/workouts"
import { getActiveOrPersonalTeamId, getSessionFromCookie } from "@/utils/auth"

export async function GET(request: Request) {
	try {
		const session = await getSessionFromCookie()
		if (!session?.user?.id) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
		}

		const { searchParams } = new URL(request.url)
		const query = searchParams.get("q") || ""

		// Get team from authenticated session instead of trusting query param
		const teamId = await getActiveOrPersonalTeamId(session.user.id)
		if (!teamId) {
			return NextResponse.json({ error: "No active team" }, { status: 400 })
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
