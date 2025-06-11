import CreateTrackForm from "@/components/tracks/CreateTrackForm"
import { TEAM_PERMISSIONS } from "@/db/schema"
import { getSessionFromCookie } from "@/utils/auth"
import { redirect } from "next/navigation"

export default async function Page() {
	const session = await getSessionFromCookie()

	if (!session) {
		redirect("/sign-in")
	}

	const teams = (session.teams || []).filter((team) =>
		team.permissions.includes(TEAM_PERMISSIONS.SCHEDULE_WORKOUTS),
	)

	console.log(session.teams)

	if (!teams.length) {
		return (
			<main className="container mx-auto p-4">
				<h1 className="text-2xl font-semibold mb-4">
					Create Programming Track
				</h1>
				<p>You don't have permission to schedule workouts for any team.</p>
			</main>
		)
	}

	return (
		<main className="container mx-auto p-4 h-screen">
			<h1 className="text-2xl font-semibold mb-4">Create Programming Track</h1>
			<CreateTrackForm teams={teams.map((t) => ({ id: t.id, name: t.name }))} />
		</main>
	)
}
