"use client"

import { Link } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { ExternalLink, Minus, Sparkles } from "lucide-react"
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
	onSaved?: () => Promise<void>
}

/**
 * Interactive matrix: competitions as rows, series divisions as columns.
 * Each cell is a <select> that picks which comp division maps to that
 * series division. Clicking an empty cell lets you assign a mapping.
 */
export function SeriesDivisionMapper({
	groupId,
	template,
	initialMappings,
	onSaved,
}: Props) {
	const formRef = useRef<HTMLFormElement>(null)
	const [isSaving, setIsSaving] = useState(false)
	const [isAutoMapping, setIsAutoMapping] = useState(false)
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
			// Read all matrix selects via data attributes
			const selects = formRef.current.querySelectorAll(
				"select[data-comp-id][data-series-div-id]",
			)
			const allMappings: Array<{
				competitionId: string
				competitionDivisionId: string
				seriesDivisionId: string
			}> = []

			for (const select of selects) {
				const el = select as HTMLSelectElement
				const compId = el.dataset.compId
				const seriesDivId = el.dataset.seriesDivId
				const compDivId = el.value
				if (!compId || !seriesDivId || compDivId === "__none__")
					continue
				allMappings.push({
					competitionId: compId,
					competitionDivisionId: compDivId,
					seriesDivisionId: seriesDivId,
				})
			}

			await saveMappings({
				data: { groupId, mappings: allMappings },
			})
			toast.success(`Saved ${allMappings.length} division mappings`)
			if (onSaved) await onSaved()
		} catch (e) {
			toast.error(
				e instanceof Error ? e.message : "Failed to save mappings",
			)
		} finally {
			setIsSaving(false)
		}
	}, [groupId, saveMappings, onSaved])

	// Stats
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
			<div className="space-y-4">
				{/* Actions bar */}
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<p className="text-sm text-muted-foreground">
						{mappedCount} of {totalDivisions} divisions mapped
					</p>
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

				{/* Interactive matrix */}
				<div className="border rounded-lg overflow-x-auto">
					<table className="w-full text-sm">
						<thead>
							<tr className="border-b bg-muted/50">
								<th className="text-left font-medium px-3 py-2 min-w-[180px] sticky left-0 bg-muted/50">
									Competition
								</th>
								{template.divisions.map((sd) => (
									<th
										key={sd.id}
										className="text-center font-medium px-2 py-2 min-w-[150px]"
									>
										<div className="text-xs leading-tight">
											{sd.label}
										</div>
									</th>
								))}
								<th className="text-center font-medium px-2 py-2 min-w-[80px]">
									<div className="text-xs text-muted-foreground">
										Unmapped
									</div>
								</th>
							</tr>
						</thead>
						<tbody>
							{mappings.map((comp) => (
								<CompetitionRow
									key={comp.competitionId}
									comp={comp}
									template={template}
								/>
							))}
						</tbody>
					</table>
				</div>
			</div>
		</form>
	)
}

/**
 * A single row in the interactive matrix.
 * Each series-division cell is a <select> picking which comp division maps to it.
 */
function CompetitionRow({
	comp,
	template,
}: {
	comp: SeriesDivisionMappingData
	template: SeriesTemplateData
}) {
	// Build reverse map: seriesDivisionId → competitionDivisionId
	const seriesDivToCompDivId = new Map<string, string>()
	for (const m of comp.mappings) {
		if (m.seriesDivisionId) {
			seriesDivToCompDivId.set(
				m.seriesDivisionId,
				m.competitionDivisionId,
			)
		}
	}
	const unmappedDivisions = comp.mappings.filter(
		(m) => m.seriesDivisionId === null,
	)

	return (
		<tr className="border-b last:border-b-0 hover:bg-muted/30">
			<td className="px-3 py-2 sticky left-0 bg-background">
				<div className="flex items-center gap-1.5">
					<span className="font-medium text-xs truncate max-w-[160px]">
						{comp.competitionName}
					</span>
					<Link
						to="/compete/organizer/$competitionId/divisions"
						params={{ competitionId: comp.competitionId }}
						className="text-muted-foreground hover:text-foreground shrink-0"
					>
						<ExternalLink className="h-3 w-3" />
					</Link>
				</div>
			</td>
			{template.divisions.map((sd) => {
				const mappedCompDivId = seriesDivToCompDivId.get(sd.id)

				return (
					<td key={sd.id} className="px-1 py-1.5 text-center">
						<select
							defaultValue={mappedCompDivId ?? "__none__"}
							className={`h-7 text-xs rounded-md border px-1.5 py-0.5 w-full max-w-[140px] mx-auto block focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer ${
								mappedCompDivId
									? "border-green-300 bg-green-50 text-green-800 dark:bg-green-950/30 dark:text-green-300"
									: "border-dashed border-muted-foreground/30 text-muted-foreground"
							}`}
							data-comp-id={comp.competitionId}
							data-series-div-id={sd.id}
						>
							<option value="__none__">—</option>
							{comp.mappings.map((m) => (
								<option
									key={m.competitionDivisionId}
									value={m.competitionDivisionId}
								>
									{m.competitionDivisionLabel}
								</option>
							))}
						</select>
					</td>
				)
			})}
			<td className="px-2 py-2 text-center">
				{unmappedDivisions.length > 0 ? (
					<Badge
						variant="outline"
						className="text-orange-600 border-orange-300 text-xs"
					>
						{unmappedDivisions.length}
					</Badge>
				) : (
					<Minus className="h-3 w-3 text-muted-foreground/40 mx-auto" />
				)}
			</td>
		</tr>
	)
}
