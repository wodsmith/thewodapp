"use client"

import { useServerFn } from "@tanstack/react-start"
import { Sparkles } from "lucide-react"
import { useCallback, useRef, useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
	autoMapSeriesDivisionsFn,
	saveSeriesDivisionMappingsFn,
	type SeriesDivisionMappingData,
	type SeriesTemplateData,
} from "@/server-fns/series-division-mapping-fns"

interface Props {
	groupId: string
	template: SeriesTemplateData
	initialMappings: SeriesDivisionMappingData[]
}

/**
 * Uses uncontrolled native <select> elements to avoid 138+ controlled React
 * state updates on a page with 23 comps x 6 divisions.
 * On save, we read all select values from the form ref in one pass.
 */
export function SeriesDivisionMapper({
	groupId,
	template,
	initialMappings,
}: Props) {
	const formRef = useRef<HTMLFormElement>(null)
	const [isSaving, setIsSaving] = useState(false)
	const [isAutoMapping, setIsAutoMapping] = useState(false)
	// Only used for auto-map to re-render with new defaults
	const [mappings, setMappings] =
		useState<SeriesDivisionMappingData[]>(initialMappings)

	const saveMappings = useServerFn(saveSeriesDivisionMappingsFn)
	const autoMap = useServerFn(autoMapSeriesDivisionsFn)

	const handleAutoMap = async () => {
		setIsAutoMapping(true)
		try {
			const result = await autoMap({ data: { groupId } })
			setMappings(result.competitionMappings)
			toast.success("Auto-mapped divisions")
		} catch (e) {
			toast.error(
				e instanceof Error
					? e.message
					: "Failed to auto-map divisions",
			)
		} finally {
			setIsAutoMapping(false)
		}
	}

	const handleSave = useCallback(async () => {
		if (!formRef.current) return
		setIsSaving(true)
		try {
			// Read all select values from the form in one pass
			const formData = new FormData(formRef.current)
			const allMappings: Array<{
				competitionId: string
				competitionDivisionId: string
				seriesDivisionId: string
			}> = []

			for (const [name, value] of formData.entries()) {
				if (!name.startsWith("mapping::")) continue
				const val = value as string
				if (val === "__unmapped__") continue
				// name format: mapping::{competitionId}::{competitionDivisionId}
				const parts = name.split("::")
				if (parts.length !== 3) continue
				allMappings.push({
					competitionId: parts[1],
					competitionDivisionId: parts[2],
					seriesDivisionId: val,
				})
			}

			await saveMappings({
				data: { groupId, mappings: allMappings },
			})
			toast.success(`Saved ${allMappings.length} division mappings`)
		} catch (e) {
			toast.error(
				e instanceof Error ? e.message : "Failed to save mappings",
			)
		} finally {
			setIsSaving(false)
		}
	}, [groupId, saveMappings])

	// Count stats from current render
	const totalDivisions = mappings.reduce(
		(sum, c) => sum + c.mappings.length,
		0,
	)
	const mappedCount = mappings.reduce(
		(sum, c) =>
			sum +
			c.mappings.filter((m) => m.seriesDivisionId !== null).length,
		0,
	)

	return (
		<form ref={formRef} onSubmit={(e) => e.preventDefault()}>
			<div className="space-y-6">
				{/* Header with actions */}
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<p className="text-sm text-muted-foreground">
							{mappedCount} of {totalDivisions} divisions mapped
						</p>
					</div>
					<div className="flex items-center gap-2">
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={handleAutoMap}
							disabled={isAutoMapping}
						>
							<Sparkles className="h-4 w-4 mr-2" />
							{isAutoMapping ? "Mapping..." : "Auto-Map All"}
						</Button>
						<Button
							type="button"
							size="sm"
							onClick={handleSave}
							disabled={isSaving}
						>
							{isSaving ? "Saving..." : "Save Mappings"}
						</Button>
					</div>
				</div>

				{/* Competition mapping list */}
				<div className="space-y-6">
					{mappings.map((comp) => (
						<CompetitionMappingCard
							key={comp.competitionId}
							comp={comp}
							template={template}
						/>
					))}
				</div>
			</div>
		</form>
	)
}

/**
 * Renders a single competition's division mappings.
 * Uses native <select> elements (uncontrolled) for performance.
 */
function CompetitionMappingCard({
	comp,
	template,
}: {
	comp: SeriesDivisionMappingData
	template: SeriesTemplateData
}) {
	return (
		<div className="rounded-lg border p-4">
			<h3 className="font-semibold mb-3">{comp.competitionName}</h3>
			{comp.mappings.length === 0 ? (
				<p className="text-sm text-muted-foreground italic">
					No divisions configured
				</p>
			) : (
				<div className="space-y-2">
					{comp.mappings.map((m) => (
						<div
							key={m.competitionDivisionId}
							className="flex items-center gap-3 text-sm"
						>
							{/* Competition division label */}
							<div className="w-[240px] truncate font-mono text-muted-foreground">
								{m.competitionDivisionLabel}
							</div>

							{/* Arrow */}
							<span className="text-muted-foreground shrink-0">
								→
							</span>

							{/* Native select for performance */}
							<select
								name={`mapping::${comp.competitionId}::${m.competitionDivisionId}`}
								defaultValue={
									m.seriesDivisionId ?? "__unmapped__"
								}
								className="h-8 text-sm rounded-md border border-input bg-background px-3 py-1 flex-1 max-w-[260px] focus:outline-none focus:ring-2 focus:ring-ring"
							>
								<option value="__unmapped__">
									Unmapped (excluded)
								</option>
								{template.divisions.map((sd) => (
									<option key={sd.id} value={sd.id}>
										{sd.label}
									</option>
								))}
							</select>

							{/* Confidence badge */}
							{m.confidence === "exact" ? (
								<Badge
									variant="outline"
									className="text-green-600 border-green-300 shrink-0"
								>
									auto
								</Badge>
							) : m.confidence === "fuzzy" ? (
								<Badge
									variant="outline"
									className="text-blue-600 border-blue-300 shrink-0"
								>
									fuzzy
								</Badge>
							) : null}
						</div>
					))}
				</div>
			)}

			{/* Missing series divisions warning */}
			{(() => {
				const mappedSeriesDivIds = new Set(
					comp.mappings
						.filter((m) => m.seriesDivisionId !== null)
						.map((m) => m.seriesDivisionId),
				)
				const missing = template.divisions.filter(
					(sd) => !mappedSeriesDivIds.has(sd.id),
				)
				if (missing.length === 0) return null
				return (
					<div className="mt-3 text-xs text-amber-600 dark:text-amber-400">
						Missing: {missing.map((d) => d.label).join(", ")}
					</div>
				)
			})()}
		</div>
	)
}
