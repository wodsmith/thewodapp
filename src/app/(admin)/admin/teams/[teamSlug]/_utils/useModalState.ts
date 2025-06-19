import { useCallback, useState } from "react"

export function useModalState() {
	// Form state
	const [classTimes, setClassTimes] = useState("")
	const [teamNotes, setTeamNotes] = useState("")
	const [scalingGuidance, setScalingGuidance] = useState("")

	// Reset function
	const resetFormData = useCallback(() => {
		setClassTimes("")
		setTeamNotes("")
		setScalingGuidance("")
	}, [])

	// Set form data (useful for editing)
	const setFormData = useCallback(
		(data: {
			classTimes: string
			teamNotes: string
			scalingGuidance: string
		}) => {
			setClassTimes(data.classTimes)
			setTeamNotes(data.teamNotes)
			setScalingGuidance(data.scalingGuidance)
		},
		[],
	)

	// Get form data
	const getFormData = useCallback(() => {
		return {
			classTimes,
			teamNotes,
			scalingGuidance,
		}
	}, [classTimes, teamNotes, scalingGuidance])

	return {
		// State
		classTimes,
		teamNotes,
		scalingGuidance,
		// Setters
		setClassTimes,
		setTeamNotes,
		setScalingGuidance,
		// Utils
		resetFormData,
		setFormData,
		getFormData,
	}
}
