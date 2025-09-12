import { create } from "zustand"
import { persist } from "zustand/middleware"

interface TeamContextState {
	currentTeamId: string | null
	setCurrentTeam: (teamId: string) => void
	clearCurrentTeam: () => void
}

/**
 * Store for managing the current team context
 * Persisted to localStorage to maintain selection across page refreshes
 */
export const useTeamContext = create<TeamContextState>()(
	persist(
		(set) => ({
			currentTeamId: null,
			setCurrentTeam: (teamId: string) => set({ currentTeamId: teamId }),
			clearCurrentTeam: () => set({ currentTeamId: null }),
		}),
		{
			name: "team-context",
		},
	),
)
