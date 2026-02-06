import { create } from "zustand"
import { combine } from "zustand/middleware"

interface OnboardingEntry {
	key: string
	completed: boolean
	completedAt: Date | null
	metadata: string | null
}

interface OnboardingState {
	entries: Map<string, OnboardingEntry>
	isLoaded: boolean
}

interface OnboardingActions {
	hydrate: (
		states: Array<{
			key: string
			completed: boolean
			completedAt: Date | null
			metadata: string | null
		}>,
	) => void
	setCompleted: (key: string, completed: boolean) => void
	isCompleted: (key: string) => boolean
	reset: () => void
}

const initialState: OnboardingState = {
	entries: new Map<string, OnboardingEntry>(),
	isLoaded: false,
}

export const useOnboardingStore = create(
	combine(
		initialState,
		(set, get) =>
			({
				hydrate: (states) => {
					const entries = new Map<string, OnboardingEntry>()
					for (const state of states) {
						entries.set(state.key, {
							key: state.key,
							completed: state.completed,
							completedAt: state.completedAt,
							metadata: state.metadata,
						})
					}
					set({ entries, isLoaded: true })
				},

				setCompleted: (key, completed) =>
					set((state) => {
						const entries = new Map(state.entries)
						entries.set(key, {
							key,
							completed,
							completedAt: completed ? new Date() : null,
							metadata: entries.get(key)?.metadata ?? null,
						})
						return { entries }
					}),

				isCompleted: (key) => {
					return get().entries.get(key)?.completed ?? false
				},

				reset: () => set(initialState),
			}) as OnboardingActions,
	),
)
