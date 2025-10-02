"use client"

import { generateScheduleAction } from "@/actions/generate-schedule-actions"
import { getScheduleTemplatesByTeam } from "@/actions/schedule-template-actions"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import { useServerAction } from "zsa-react"

interface Team {
	id: string
	name: string
}

interface Template {
	id: string
	name: string
	teamId: string
}

interface TestGenerateScheduleClientProps {
	teams: Team[]
	templates: Template[]
	defaultTeamId: string
}

export function TestGenerateScheduleClient({
	teams,
	templates: initialTemplates,
	defaultTeamId,
}: TestGenerateScheduleClientProps) {
	const [selectedTeamId, setSelectedTeamId] = useState(defaultTeamId)
	const [selectedTemplateId, setSelectedTemplateId] = useState(
		initialTemplates[0]?.id || "",
	)
	const [templates, setTemplates] = useState(initialTemplates)
	const [result, setResult] = useState<string | null>(null)
	const [weekStartDate, setWeekStartDate] = useState("2024-01-08")

	const { execute, isPending, error } = useServerAction(generateScheduleAction)
	const { execute: fetchTemplates, isPending: isFetchingTemplates } =
		useServerAction(getScheduleTemplatesByTeam)

	const handleTeamChange = async (teamId: string) => {
		setSelectedTeamId(teamId)
		setSelectedTemplateId("")
		setTemplates([])

		if (teamId) {
			try {
				const [teamTemplates, error] = await fetchTemplates({ teamId })
				if (error) {
					console.error("Error fetching templates:", error)
					setTemplates([])
				} else if (teamTemplates) {
					setTemplates(teamTemplates)
					setSelectedTemplateId(teamTemplates[0]?.id || "")
				}
			} catch (err) {
				console.error("Error fetching templates:", err)
				setTemplates([])
			}
		}
	}

	const handleTest = async () => {
		if (!selectedTeamId || !selectedTemplateId) {
			setResult("Error: Please select both a team and template")
			return
		}

		try {
			const testData = {
				templateId: selectedTemplateId,
				locationId: "test-location-id", // TODO: Add location selection to test component
				weekStartDate: new Date(weekStartDate),
				teamId: selectedTeamId,
			}

			console.log("Testing generateScheduleAction with:", testData)

			const result = await execute(testData)
			console.log("Result:", result)
			setResult(JSON.stringify(result, null, 2))
		} catch (err) {
			console.error("Error:", err)
			setResult(`Error: ${err instanceof Error ? err.message : String(err)}`)
		}
	}

	return (
		<div className="space-y-6">
			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				<div>
					<label
						htmlFor="team-select"
						className="block text-sm font-medium mb-2"
					>
						Team
					</label>
					<select
						id="team-select"
						value={selectedTeamId}
						onChange={(e) => handleTeamChange(e.target.value)}
						className="w-full p-2 border rounded-md"
					>
						<option value="">Select a team...</option>
						{teams.map((team) => (
							<option key={team.id} value={team.id}>
								{team.name}
							</option>
						))}
					</select>
				</div>

				<div>
					<label
						htmlFor="template-select"
						className="block text-sm font-medium mb-2"
					>
						Template
					</label>
					<select
						id="template-select"
						value={selectedTemplateId}
						onChange={(e) => setSelectedTemplateId(e.target.value)}
						disabled={isFetchingTemplates || templates.length === 0}
						className="w-full p-2 border rounded-md"
					>
						<option value="">
							{isFetchingTemplates
								? "Loading templates..."
								: templates.length === 0
									? "No templates found"
									: "Select a template..."}
						</option>
						{templates.map((template) => (
							<option key={template.id} value={template.id}>
								{template.name}
							</option>
						))}
					</select>
				</div>
			</div>

			<div>
				<label htmlFor="date-input" className="block text-sm font-medium mb-2">
					Week Start Date
				</label>
				<input
					id="date-input"
					type="date"
					value={weekStartDate}
					onChange={(e) => setWeekStartDate(e.target.value)}
					className="w-full p-2 border rounded-md"
				/>
			</div>

			<div className="bg-gray-50 p-4 rounded-md">
				<h3 className="font-medium mb-2">Test Data Preview:</h3>
				<pre className="text-sm text-gray-600">
					{JSON.stringify(
						{
							templateId: selectedTemplateId || "not selected",
							weekStartDate: weekStartDate,
							teamId: selectedTeamId || "not selected",
						},
						null,
						2,
					)}
				</pre>
			</div>

			<Button
				onClick={handleTest}
				disabled={isPending || !selectedTeamId || !selectedTemplateId}
				className="w-full"
			>
				{isPending ? "Generating..." : "Test Generate Schedule"}
			</Button>

			{error && (
				<div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
					<strong>Error:</strong> {error.message}
				</div>
			)}

			{result && (
				<div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
					<strong>Result:</strong>
					<pre className="mt-2 text-sm overflow-auto whitespace-pre-wrap">
						{result}
					</pre>
				</div>
			)}
		</div>
	)
}
