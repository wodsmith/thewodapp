import { createServerFn } from "@tanstack/react-start"
import { getSessionFromCookie } from "~/utils/auth.server"

export const getDefaultTeamContextFn = createServerFn("GET", async () => {
	const session = await getSessionFromCookie()
	const defaultTeam = session?.teams?.[0]
	if (!session || !defaultTeam) {
		return {
			isAuthenticated: false,
			userTeamIds: [] as string[],
			teamId: null as string | null,
			teamName: "",
		}
	}

	return {
		isAuthenticated: true,
		userTeamIds: session.teams?.map((t) => t.id) ?? [],
		teamId: defaultTeam.id,
		teamName: defaultTeam.name ?? "",
	}
})


