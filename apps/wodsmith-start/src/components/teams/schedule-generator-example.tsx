// Example usage of the ScheduleGenerator component
// This file demonstrates how to use the schedule generator in your pages

import { ScheduleGenerator } from "./schedule-generator"

// Example 1: Basic usage with teamId
export function ExampleBasicUsage() {
	const teamId = "your-team-id-here"

	return <ScheduleGenerator teamId={teamId} />
}

// Example 2: Usage with both teamId and templateId
export function ExampleWithTemplate() {
	const teamId = "your-team-id-here"
	const templateId = "your-template-id-here"

	return <ScheduleGenerator teamId={teamId} templateId={templateId} />
}

// Example 3: Usage in a page component
export function TeamSchedulePage({ params }: { params: { teamId: string } }) {
	// You might fetch the templateId from your database or state
	const templateId = "template-123" // This could come from a form or database

	return (
		<div>
			<ScheduleGenerator teamId={params.teamId} templateId={templateId} />
		</div>
	)
}
