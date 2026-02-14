import { create } from "zustand"
import { combine } from "zustand/middleware"

export interface SubmissionWindow {
	id: string
	submissionOpensAt: string | null
	submissionClosesAt: string | null
}

interface SubmissionWindowsState {
	windows: SubmissionWindow[]
	workoutAssignments: Map<string, string[]> // windowId -> workoutIds[]
	isDirty: boolean
}

interface SubmissionWindowsActions {
	setWindows: (windows: SubmissionWindow[]) => void
	addWindow: (window: SubmissionWindow) => void
	removeWindow: (windowId: string) => void
	updateWindow: (windowId: string, updates: Partial<SubmissionWindow>) => void
	assignWorkout: (windowId: string, workoutId: string) => void
	unassignWorkout: (windowId: string, workoutId: string) => void
	reset: () => void
	markClean: () => void
}

const initialState: SubmissionWindowsState = {
	windows: [],
	workoutAssignments: new Map<string, string[]>(),
	isDirty: false,
}

export const useSubmissionWindowsStore = create(
	combine(
		initialState,
		(set) =>
			({
				setWindows: (windows: SubmissionWindow[]) =>
					set({ windows, isDirty: false }),

				addWindow: (window: SubmissionWindow) =>
					set((state) => ({
						windows: [...state.windows, window],
						isDirty: true,
					})),

				removeWindow: (windowId: string) =>
					set((state) => {
						const newAssignments = new Map(state.workoutAssignments)
						newAssignments.delete(windowId)
						return {
							windows: state.windows.filter((w) => w.id !== windowId),
							workoutAssignments: newAssignments,
							isDirty: true,
						}
					}),

				updateWindow: (windowId: string, updates: Partial<SubmissionWindow>) =>
					set((state) => ({
						windows: state.windows.map((w) =>
							w.id === windowId ? { ...w, ...updates } : w,
						),
						isDirty: true,
					})),

				assignWorkout: (windowId: string, workoutId: string) =>
					set((state) => {
						const newAssignments = new Map(state.workoutAssignments)
						const current = newAssignments.get(windowId) || []
						if (!current.includes(workoutId)) {
							newAssignments.set(windowId, [...current, workoutId])
						}
						return {
							workoutAssignments: newAssignments,
							isDirty: true,
						}
					}),

				unassignWorkout: (windowId: string, workoutId: string) =>
					set((state) => {
						const newAssignments = new Map(state.workoutAssignments)
						const current = newAssignments.get(windowId) || []
						newAssignments.set(
							windowId,
							current.filter((id) => id !== workoutId),
						)
						return {
							workoutAssignments: newAssignments,
							isDirty: true,
						}
					}),

				reset: () => set(initialState),

				markClean: () => set({ isDirty: false }),
			}) as SubmissionWindowsActions,
	),
)
