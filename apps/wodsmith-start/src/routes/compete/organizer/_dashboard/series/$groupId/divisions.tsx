import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { ArrowDown, ArrowLeft, ArrowUp, Plus, RefreshCw, Save, Trash2, Users } from "lucide-react"
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
import { Textarea } from "@/components/ui/textarea"
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
	syncTemplateToCompetitionsFn,
	updateSeriesTemplateFn,
	type SeriesDivisionMappingData,
	type SeriesTemplateDivisionData,
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
		divisions: Array<{
			label: string
			teamSize: number
			feeCents: number
			description: string | null
			maxSpots: number | null
		}>,
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
						{/* Editable template card */}
						<TemplateEditor
							groupId={groupId}
							template={template}
							onTemplateUpdated={refreshData}
							onChangeTemplate={() => setTemplate(null)}
						/>

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
// Template Editor — edit existing template + sync downstream
// ─────────────────────────────────────────────────────────

function TemplateEditor({
	groupId,
	template,
	onTemplateUpdated,
	onChangeTemplate,
}: {
	groupId: string
	template: SeriesTemplateData
	onTemplateUpdated: () => Promise<void>
	onChangeTemplate: () => void
}) {
	const [divisions, setDivisions] = useState<SeriesTemplateDivisionData[]>(
		template.divisions,
	)
	const [isSaving, setIsSaving] = useState(false)
	const [isSyncing, setIsSyncing] = useState(false)

	const updateTemplate = useServerFn(updateSeriesTemplateFn)
	const syncDownstream = useServerFn(syncTemplateToCompetitionsFn)

	const updateDivision = (
		index: number,
		updates: Partial<SeriesTemplateDivisionData>,
	) => {
		setDivisions((prev) =>
			prev.map((d, i) => (i === index ? { ...d, ...updates } : d)),
		)
	}

	const moveUp = (index: number) => {
		if (index === 0) return
		setDivisions((prev) => {
			const next = [...prev]
			const temp = next[index - 1]
			next[index - 1] = next[index]
			next[index] = temp
			return next
		})
	}

	const moveDown = (index: number) => {
		if (index >= divisions.length - 1) return
		setDivisions((prev) => {
			const next = [...prev]
			const temp = next[index + 1]
			next[index + 1] = next[index]
			next[index] = temp
			return next
		})
	}

	const handleSave = async () => {
		setIsSaving(true)
		try {
			await updateTemplate({
				data: {
					groupId,
					divisions: divisions.map((d) => ({
						id: d.id,
						label: d.label,
						teamSize: d.teamSize,
						feeCents: d.feeCents,
						description: d.description,
						maxSpots: d.maxSpots,
					})),
				},
			})
			toast.success("Template saved")
			await onTemplateUpdated()
		} catch (e) {
			toast.error(
				e instanceof Error ? e.message : "Failed to save template",
			)
		} finally {
			setIsSaving(false)
		}
	}

	const handleSync = async () => {
		setIsSyncing(true)
		try {
			const result = await syncDownstream({
				data: { groupId },
			})
			toast.success(
				`Synced settings to ${result.synced} competition division${result.synced !== 1 ? "s" : ""}`,
			)
		} catch (e) {
			toast.error(
				e instanceof Error ? e.message : "Failed to sync",
			)
		} finally {
			setIsSyncing(false)
		}
	}

	return (
		<Card>
			<CardHeader>
				<div className="flex items-start justify-between">
					<div>
						<CardTitle>Series Template</CardTitle>
						<CardDescription>
							Edit divisions here, then sync changes to all
							mapped competitions.
						</CardDescription>
					</div>
					<div className="flex items-center gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={handleSync}
							disabled={isSyncing}
						>
							<RefreshCw
								className={`h-4 w-4 mr-2 ${isSyncing ? "animate-spin" : ""}`}
							/>
							{isSyncing
								? "Syncing..."
								: "Sync to Competitions"}
						</Button>
						<Button
							size="sm"
							onClick={handleSave}
							disabled={isSaving}
						>
							<Save className="h-4 w-4 mr-2" />
							{isSaving ? "Saving..." : "Save Template"}
						</Button>
					</div>
				</div>
			</CardHeader>
			<CardContent className="space-y-3">
				{divisions.map((d, i) => (
					<div
						key={d.id}
						className="rounded-md border p-3 space-y-2"
					>
						<div className="flex items-center gap-2">
							<span className="text-xs text-muted-foreground font-mono w-6 text-center shrink-0">
								#{i + 1}
							</span>
							<div className="flex flex-col shrink-0">
								<button
									type="button"
									onClick={() => moveUp(i)}
									disabled={i === 0}
									className="text-muted-foreground hover:text-foreground disabled:opacity-25 p-0.5"
								>
									<ArrowUp className="h-3 w-3" />
								</button>
								<button
									type="button"
									onClick={() => moveDown(i)}
									disabled={i >= divisions.length - 1}
									className="text-muted-foreground hover:text-foreground disabled:opacity-25 p-0.5"
								>
									<ArrowDown className="h-3 w-3" />
								</button>
							</div>
							<Input
								value={d.label}
								onChange={(e) =>
									updateDivision(i, {
										label: e.target.value,
									})
								}
								placeholder="Division name"
								className="flex-1 max-w-[250px]"
							/>
							<div className="flex items-center gap-1.5 shrink-0">
								<Users className="h-3.5 w-3.5 text-muted-foreground" />
								<select
									value={d.teamSize}
									onChange={(e) =>
										updateDivision(i, {
											teamSize: Number.parseInt(
												e.target.value,
												10,
											),
										})
									}
									className="h-8 text-sm rounded-md border border-input bg-background px-2 py-1 focus:outline-none focus:ring-2 focus:ring-ring"
								>
									<option value={1}>Individual</option>
									<option value={2}>Team of 2</option>
									<option value={3}>Team of 3</option>
									<option value={4}>Team of 4</option>
									<option value={5}>Team of 5</option>
									<option value={6}>Team of 6</option>
								</select>
							</div>
						</div>
						<div className="flex items-start gap-3 pl-8">
							<div className="space-y-1">
								<label className="text-xs text-muted-foreground">
									Fee
								</label>
								<div className="flex items-center gap-1">
									<span className="text-xs text-muted-foreground">
										$
									</span>
									<Input
										type="number"
										min={0}
										step={0.01}
										value={
											d.feeCents > 0
												? (d.feeCents / 100).toFixed(2)
												: ""
										}
										onChange={(e) => {
											const dollars = Number.parseFloat(
												e.target.value,
											)
											updateDivision(i, {
												feeCents: Number.isNaN(dollars)
													? 0
													: Math.round(dollars * 100),
											})
										}}
										placeholder="0.00"
										className="w-[80px] h-7 text-xs"
									/>
								</div>
							</div>
							<div className="space-y-1">
								<label className="text-xs text-muted-foreground">
									Max Spots
								</label>
								<Input
									type="number"
									min={1}
									value={d.maxSpots ?? ""}
									onChange={(e) =>
										updateDivision(i, {
											maxSpots: e.target.value
												? Number.parseInt(
														e.target.value,
														10,
													) || null
												: null,
										})
									}
									placeholder="Unlimited"
									className="w-[90px] h-7 text-xs"
								/>
							</div>
						</div>
						<div className="pl-8">
							<label className="text-xs text-muted-foreground">
								Description
							</label>
							<Textarea
								value={d.description ?? ""}
								onChange={(e) =>
									updateDivision(i, {
										description:
											e.target.value || null,
									})
								}
								placeholder="Who is this division for?"
								className="mt-1 text-xs min-h-[60px]"
								rows={2}
							/>
						</div>
					</div>
				))}
				<div className="pt-2">
					<Button
						variant="ghost"
						size="sm"
						onClick={onChangeTemplate}
						className="text-muted-foreground"
					>
						Replace with different template
					</Button>
				</div>
			</CardContent>
		</Card>
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
		divisions: Array<{
			label: string
			teamSize: number
			feeCents: number
			description: string | null
			maxSpots: number | null
		}>,
	) => void
	isCreating: boolean
}) {
	interface CustomDivision {
		label: string
		teamSize: number
		feeCents: number
		description: string
		maxSpots: string // string for input, parsed to number on submit
	}

	const [mode, setMode] = useState<"pick" | "create">("pick")
	const [customDivisions, setCustomDivisions] = useState<CustomDivision[]>(
		[],
	)
	const [newLabel, setNewLabel] = useState("")

	const addDivision = () => {
		const label = newLabel.trim()
		if (!label) return
		if (customDivisions.some((d) => d.label === label)) {
			toast.error("Division already exists")
			return
		}
		setCustomDivisions((prev) => [
			...prev,
			{
				label,
				teamSize: 1,
				feeCents: 0,
				description: "",
				maxSpots: "",
			},
		])
		setNewLabel("")
	}

	const removeDivision = (index: number) => {
		setCustomDivisions((prev) => prev.filter((_, i) => i !== index))
	}

	const updateDivision = (
		index: number,
		updates: Partial<CustomDivision>,
	) => {
		setCustomDivisions((prev) =>
			prev.map((d, i) => (i === index ? { ...d, ...updates } : d)),
		)
	}

	const moveUp = (index: number) => {
		if (index === 0) return
		setCustomDivisions((prev) => {
			const next = [...prev]
			const temp = next[index - 1]
			next[index - 1] = next[index]
			next[index] = temp
			return next
		})
	}

	const moveDown = (index: number) => {
		if (index >= customDivisions.length - 1) return
		setCustomDivisions((prev) => {
			const next = [...prev]
			const temp = next[index + 1]
			next[index + 1] = next[index]
			next[index] = temp
			return next
		})
	}

	const handleCreateCustom = () => {
		const valid = customDivisions.filter((d) => d.label.trim())
		if (valid.length === 0) {
			toast.error("Add at least one division")
			return
		}
		onCreateCustom(
			valid.map((d) => ({
				label: d.label,
				teamSize: d.teamSize,
				feeCents: d.feeCents,
				description: d.description || null,
				maxSpots: d.maxSpots
					? Number.parseInt(d.maxSpots, 10) || null
					: null,
			})),
		)
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
							{isCreating ? "Creating..." : "Use Template"}
						</Button>
					</div>
				) : (
					<div className="space-y-4">
						{/* Division list with full controls */}
						{customDivisions.length > 0 && (
							<div className="space-y-2">
								{customDivisions.map((d, i) => (
									<div
										key={i}
										className="rounded-md border p-3 space-y-2"
									>
										<div className="flex items-center gap-2">
											{/* Position badge */}
											<span className="text-xs text-muted-foreground font-mono w-6 text-center shrink-0">
												#{i + 1}
											</span>

											{/* Reorder arrows */}
											<div className="flex flex-col shrink-0">
												<button
													type="button"
													onClick={() => moveUp(i)}
													disabled={i === 0}
													className="text-muted-foreground hover:text-foreground disabled:opacity-25 p-0.5"
												>
													<ArrowUp className="h-3 w-3" />
												</button>
												<button
													type="button"
													onClick={() =>
														moveDown(i)
													}
													disabled={
														i >=
														customDivisions.length -
															1
													}
													className="text-muted-foreground hover:text-foreground disabled:opacity-25 p-0.5"
												>
													<ArrowDown className="h-3 w-3" />
												</button>
											</div>

											{/* Label */}
											<Input
												value={d.label}
												onChange={(e) =>
													updateDivision(i, {
														label: e.target.value,
													})
												}
												placeholder="Division name"
												className="flex-1 max-w-[250px]"
											/>

											{/* Team size */}
											<div className="flex items-center gap-1.5 shrink-0">
												<Users className="h-3.5 w-3.5 text-muted-foreground" />
												<select
													value={d.teamSize}
													onChange={(e) =>
														updateDivision(i, {
															teamSize:
																Number.parseInt(
																	e.target
																		.value,
																	10,
																),
														})
													}
													className="h-8 text-sm rounded-md border border-input bg-background px-2 py-1 focus:outline-none focus:ring-2 focus:ring-ring"
												>
													<option value={1}>
														Individual
													</option>
													<option value={2}>
														Team of 2
													</option>
													<option value={3}>
														Team of 3
													</option>
													<option value={4}>
														Team of 4
													</option>
													<option value={5}>
														Team of 5
													</option>
													<option value={6}>
														Team of 6
													</option>
												</select>
											</div>

											{/* Delete */}
											<Button
												type="button"
												variant="ghost"
												size="icon"
												onClick={() =>
													removeDivision(i)
												}
												className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
											>
												<Trash2 className="h-4 w-4" />
											</Button>
										</div>

										{/* Second row: fee, max spots, description */}
										<div className="flex items-start gap-3 pl-8">
											<div className="space-y-1">
												<label className="text-xs text-muted-foreground">
													Fee
												</label>
												<div className="flex items-center gap-1">
													<span className="text-xs text-muted-foreground">
														$
													</span>
													<Input
														type="number"
														min={0}
														step={0.01}
														value={
															d.feeCents > 0
																? (
																		d.feeCents /
																		100
																	).toFixed(2)
																: ""
														}
														onChange={(e) => {
															const dollars =
																Number.parseFloat(
																	e.target
																		.value,
																)
															updateDivision(i, {
																feeCents:
																	Number.isNaN(
																		dollars,
																	)
																		? 0
																		: Math.round(
																				dollars *
																					100,
																			),
															})
														}}
														placeholder="0.00"
														className="w-[80px] h-7 text-xs"
													/>
												</div>
											</div>
											<div className="space-y-1">
												<label className="text-xs text-muted-foreground">
													Max Spots
												</label>
												<Input
													type="number"
													min={1}
													value={d.maxSpots}
													onChange={(e) =>
														updateDivision(i, {
															maxSpots:
																e.target.value,
														})
													}
													placeholder="Unlimited"
													className="w-[90px] h-7 text-xs"
												/>
											</div>
										</div>
										<div className="pl-8">
											<label className="text-xs text-muted-foreground">
												Description
											</label>
											<Textarea
												value={d.description}
												onChange={(e) =>
													updateDivision(i, {
														description:
															e.target.value,
													})
												}
												placeholder="Who is this division for?"
												className="mt-1 text-xs min-h-[60px]"
												rows={2}
											/>
										</div>
									</div>
								))}
							</div>
						)}

						{customDivisions.length === 0 && (
							<p className="text-sm text-muted-foreground italic">
								No divisions yet. Add your first division
								below.
							</p>
						)}

						{/* Add division input */}
						<div className="flex items-center gap-2">
							<Input
								value={newLabel}
								onChange={(e) => setNewLabel(e.target.value)}
								placeholder="e.g. Men's Individual RX"
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
								Add Division
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
