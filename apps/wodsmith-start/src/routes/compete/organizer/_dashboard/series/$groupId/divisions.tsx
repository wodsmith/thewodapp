import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { ArrowLeft, Plus, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { SeriesDivisionMapper } from "@/components/series-division-mapper"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import { usePostHog } from "@/lib/posthog"
import {
	createSeriesTemplateFn,
	getSeriesDivisionMappingsFn,
	setSeriesTemplateFn,
	type SeriesDivisionMappingData,
	type SeriesTemplateData,
} from "@/server-fns/series-division-mapping-fns"

export const Route = createFileRoute(
	"/compete/organizer/_dashboard/series/$groupId/divisions",
)({
	component: SeriesDivisionsPage,
	loader: async ({ params }) => {
		const result = await getSeriesDivisionMappingsFn({
			data: { groupId: params.groupId },
		})
		return result
	},
})

function SeriesDivisionsPage() {
	const { groupId } = Route.useParams()
	const loaderData = Route.useLoaderData()
	const router = useRouter()
	const navigate = useNavigate()
	const { posthog } = usePostHog()

	const [template, setTemplate] = useState<SeriesTemplateData | null>(
		loaderData.template,
	)
	const [competitionMappings, setCompetitionMappings] = useState<
		SeriesDivisionMappingData[]
	>(loaderData.competitionMappings)
	const [selectedSourceGroup, setSelectedSourceGroup] = useState<string>("")
	const [isCreatingTemplate, setIsCreatingTemplate] = useState(false)

	const setTemplateFnHook = useServerFn(setSeriesTemplateFn)
	const createTemplateFnHook = useServerFn(createSeriesTemplateFn)

	const [flagEnabled, setFlagEnabled] = useState(() =>
		posthog.isFeatureEnabled("competition-global-leaderboard"),
	)

	useEffect(() => {
		const unsubscribe = posthog.onFeatureFlags(() => {
			setFlagEnabled(
				posthog.isFeatureEnabled("competition-global-leaderboard"),
			)
		})
		return unsubscribe
	}, [posthog])

	useEffect(() => {
		if (flagEnabled === false) {
			navigate({
				to: "/compete/organizer/series/$groupId",
				replace: true,
				params: { groupId },
			})
		}
	}, [flagEnabled, groupId, navigate])

	if (flagEnabled === false) return null

	const refreshData = async () => {
		await router.invalidate()
		const refreshed = await getSeriesDivisionMappingsFn({
			data: { groupId },
		})
		setTemplate(refreshed.template)
		setCompetitionMappings(refreshed.competitionMappings)
	}

	const handleCreateFromExisting = async () => {
		if (!selectedSourceGroup) return
		setIsCreatingTemplate(true)
		try {
			await setTemplateFnHook({
				data: {
					groupId,
					sourceScalingGroupId: selectedSourceGroup,
				},
			})
			toast.success("Series template created")
			await refreshData()
		} catch (e) {
			toast.error(
				e instanceof Error
					? e.message
					: "Failed to create template",
			)
		} finally {
			setIsCreatingTemplate(false)
		}
	}

	const handleCreateCustom = async (
		divisions: Array<{ label: string; teamSize: number }>,
	) => {
		setIsCreatingTemplate(true)
		try {
			await createTemplateFnHook({
				data: { groupId, divisions },
			})
			toast.success("Series template created")
			await refreshData()
		} catch (e) {
			toast.error(
				e instanceof Error
					? e.message
					: "Failed to create template",
			)
		} finally {
			setIsCreatingTemplate(false)
		}
	}

	return (
		<div className="container mx-auto px-4 py-8">
			<div className="flex flex-col gap-6">
				{/* Header */}
				<div>
					<div className="mb-4">
						<Button variant="ghost" size="sm" asChild>
							<Link
								to="/compete/organizer/series/$groupId"
								params={{ groupId }}
							>
								<ArrowLeft className="h-4 w-4 mr-2" />
								Back to Series
							</Link>
						</Button>
					</div>
					<h1 className="text-3xl font-bold">
						Configure Leaderboard Divisions
					</h1>
					<p className="text-muted-foreground mt-1">
						Define the series division template and map each
						competition's divisions to it.
					</p>
				</div>

				{/* Step 1: Define or pick template */}
				{!template ? (
					<TemplateCreator
						availableScalingGroups={
							loaderData.availableScalingGroups
						}
						selectedSourceGroup={selectedSourceGroup}
						onSourceGroupChange={setSelectedSourceGroup}
						onCreateFromExisting={handleCreateFromExisting}
						onCreateCustom={handleCreateCustom}
						isCreating={isCreatingTemplate}
					/>
				) : (
					<>
						{/* Template info card */}
						<Card>
							<CardHeader>
								<CardTitle>Series Template</CardTitle>
								<CardDescription>
									{template.scalingGroupTitle} —{" "}
									{template.divisions.length} divisions
								</CardDescription>
							</CardHeader>
							<CardContent>
								<div className="flex flex-wrap gap-2">
									{template.divisions.map((d) => (
										<span
											key={d.id}
											className="inline-flex items-center rounded-full border px-3 py-1 text-sm"
										>
											{d.label}
											{d.teamSize > 1 && (
												<span className="ml-1 text-xs text-muted-foreground">
													(team of {d.teamSize})
												</span>
											)}
										</span>
									))}
								</div>
								<div className="mt-4">
									<Button
										variant="outline"
										size="sm"
										onClick={() => {
											setTemplate(null)
										}}
									>
										Change Template
									</Button>
								</div>
							</CardContent>
						</Card>

						{/* Step 2: Map divisions */}
						<Card>
							<CardHeader>
								<CardTitle>
									Competition Division Mappings
								</CardTitle>
								<CardDescription>
									Map each competition's divisions to the
									series template. Unmapped divisions are
									excluded from the leaderboard.
								</CardDescription>
							</CardHeader>
							<CardContent>
								{competitionMappings.length === 0 ? (
									<Alert
										variant="default"
										className="border-dashed"
									>
										<AlertTitle>
											No competitions in series
										</AlertTitle>
										<AlertDescription>
											Add competitions to this series
											first, then configure division
											mappings.
										</AlertDescription>
									</Alert>
								) : (
									<SeriesDivisionMapper
										groupId={groupId}
										template={template}
										initialMappings={competitionMappings}
									/>
								)}
							</CardContent>
						</Card>
					</>
				)}
			</div>
		</div>
	)
}

// ─────────────────────────────────────────────────────────
// Template Creator — pick from existing OR create from scratch
// ─────────────────────────────────────────────────────────

function TemplateCreator({
	availableScalingGroups,
	selectedSourceGroup,
	onSourceGroupChange,
	onCreateFromExisting,
	onCreateCustom,
	isCreating,
}: {
	availableScalingGroups: Array<{
		id: string
		title: string
		levels: Array<{ id: string; label: string; teamSize: number }>
	}>
	selectedSourceGroup: string
	onSourceGroupChange: (id: string) => void
	onCreateFromExisting: () => void
	onCreateCustom: (
		divisions: Array<{ label: string; teamSize: number }>,
	) => void
	isCreating: boolean
}) {
	const [mode, setMode] = useState<"pick" | "create">("pick")
	const [customDivisions, setCustomDivisions] = useState<
		Array<{ label: string; teamSize: number }>
	>([{ label: "", teamSize: 1 }])
	const [newLabel, setNewLabel] = useState("")

	const addDivision = () => {
		const label = newLabel.trim()
		if (!label) return
		if (customDivisions.some((d) => d.label === label)) {
			toast.error("Division already exists")
			return
		}
		setCustomDivisions((prev) => [...prev, { label, teamSize: 1 }])
		setNewLabel("")
	}

	const removeDivision = (index: number) => {
		setCustomDivisions((prev) => prev.filter((_, i) => i !== index))
	}

	const updateDivisionLabel = (index: number, label: string) => {
		setCustomDivisions((prev) =>
			prev.map((d, i) => (i === index ? { ...d, label } : d)),
		)
	}

	const handleCreateCustom = () => {
		const valid = customDivisions.filter((d) => d.label.trim())
		if (valid.length === 0) {
			toast.error("Add at least one division")
			return
		}
		onCreateCustom(valid)
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Step 1: Define Series Divisions</CardTitle>
				<CardDescription>
					Choose an existing competition's divisions as a starting
					point, or create your own from scratch.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-6">
				{/* Tab-like toggle */}
				<div className="flex gap-2">
					<Button
						variant={mode === "pick" ? "default" : "outline"}
						size="sm"
						onClick={() => setMode("pick")}
					>
						Start from existing
					</Button>
					<Button
						variant={mode === "create" ? "default" : "outline"}
						size="sm"
						onClick={() => setMode("create")}
					>
						Create from scratch
					</Button>
				</div>

				{mode === "pick" ? (
					<div className="flex items-center gap-3">
						<Select
							value={selectedSourceGroup || "__none__"}
							onValueChange={(val) =>
								onSourceGroupChange(
									val === "__none__" ? "" : val,
								)
							}
						>
							<SelectTrigger className="w-[350px]">
								<SelectValue placeholder="Select a division template..." />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="__none__" disabled>
									Select a division template...
								</SelectItem>
								{availableScalingGroups.map((g) => (
									<SelectItem key={g.id} value={g.id}>
										{g.title}
										{g.levels.length > 0 && (
											<span className="ml-1 text-muted-foreground text-xs">
												(
												{g.levels
													.map((l) => l.label)
													.join(", ")}
												)
											</span>
										)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<Button
							onClick={onCreateFromExisting}
							disabled={!selectedSourceGroup || isCreating}
						>
							<Plus className="h-4 w-4 mr-2" />
							{isCreating
								? "Creating..."
								: "Use Template"}
						</Button>
					</div>
				) : (
					<div className="space-y-4">
						{/* Existing divisions list */}
						{customDivisions.length > 0 && (
							<div className="space-y-2">
								{customDivisions.map((d, i) => (
									<div
										key={i}
										className="flex items-center gap-2"
									>
										<Input
											value={d.label}
											onChange={(e) =>
												updateDivisionLabel(
													i,
													e.target.value,
												)
											}
											placeholder="Division name"
											className="max-w-[300px]"
										/>
										<Button
											type="button"
											variant="ghost"
											size="icon"
											onClick={() => removeDivision(i)}
											className="h-8 w-8 text-muted-foreground hover:text-destructive"
										>
											<Trash2 className="h-4 w-4" />
										</Button>
									</div>
								))}
							</div>
						)}

						{/* Add division input */}
						<div className="flex items-center gap-2">
							<Input
								value={newLabel}
								onChange={(e) => setNewLabel(e.target.value)}
								placeholder="Add a division..."
								className="max-w-[300px]"
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										e.preventDefault()
										addDivision()
									}
								}}
							/>
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={addDivision}
								disabled={!newLabel.trim()}
							>
								<Plus className="h-4 w-4 mr-2" />
								Add
							</Button>
						</div>

						{/* Create button */}
						<Button
							onClick={handleCreateCustom}
							disabled={
								isCreating ||
								customDivisions.filter(
									(d) => d.label.trim(),
								).length === 0
							}
						>
							{isCreating
								? "Creating..."
								: "Create Template"}
						</Button>
					</div>
				)}
			</CardContent>
		</Card>
	)
}
