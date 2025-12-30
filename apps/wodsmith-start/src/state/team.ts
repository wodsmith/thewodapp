import { useCallback, useState } from "react"
import type { KVSession } from "@/utils/kv-session"

// Team member type extracted from KVSession for type safety
export type TeamMember = NonNullable<KVSession["teams"]>[number]

/**
 * Custom hook for managing team switching state
 * This is a lightweight alternative to a global store
 */
export function useTeamSwitching() {
	const [isLoading, setIsLoading] = useState(false)

	const startSwitching = useCallback(() => setIsLoading(true), [])
	const finishSwitching = useCallback(() => setIsLoading(false), [])

	return {
		isLoading,
		startSwitching,
		finishSwitching,
	}
}

/**
 * Helper function to get the active team from a list of teams
 */
export function getActiveTeam(
	teams: TeamMember[] | undefined,
	activeTeamId: string | null,
): TeamMember | undefined {
	if (!teams || teams.length === 0) return undefined
	if (!activeTeamId) return teams[0]
	return teams.find((team) => team.id === activeTeamId) ?? teams[0]
}
