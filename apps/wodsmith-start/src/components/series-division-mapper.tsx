"use client"

import { Link } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { Check, ExternalLink, Minus, Sparkles, X } from "lucide-react"
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
 * Compact matrix view of all competitions × series template divisions.
 *
 * Layout:
 *   Columns = series template divisions
 *   Rows = competitions
 *   Cells = the competition division mapped to that series division (or empty)
 *
 * Each cell has an inline <select> for remapping.
 * Uses uncontrolled native <select> elements for performance with 100+ cells.
 */
export function SeriesDivisionMapper({
	groupId,
	template,
	initialMappings,
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

				{/* Overview matrix: comps as rows, series divisions as columns */}
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
										className="text-center font-medium px-2 py-2 min-w-[140px]"
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

				{/* Detailed mapping controls (hidden selects for form submission) */}
				<div className="space-y-3">
					<h4 className="text-sm font-medium text-muted-foreground">
						Division Mapping Details
					</h4>
					{mappings.map((comp) => (
						<CompetitionMappingRow
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
 * A single row in the overview matrix.
 * Shows which series divisions this competition covers.
 */
function CompetitionRow({
	comp,
	template,
}: {
	comp: SeriesDivisionMappingData
	template: SeriesTemplateData
}) {
	// Build a map: seriesDivisionId → competitionDivisionLabel
	const seriesDivToCompDiv = new Map<string, string>()
	for (const m of comp.mappings) {
		if (m.seriesDivisionId) {
			seriesDivToCompDiv.set(
				m.seriesDivisionId,
				m.competitionDivisionLabel,
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
				const compLabel = seriesDivToCompDiv.get(sd.id)
				return (
					<td key={sd.id} className="px-2 py-2 text-center">
						{compLabel ? (
							<Badge
								variant="outline"
								className="text-green-700 border-green-300 text-xs font-normal max-w-[130px] truncate"
								title={compLabel}
							>
								<Check className="h-3 w-3 mr-1 shrink-0" />
								{compLabel}
							</Badge>
						) : (
							<Minus className="h-3 w-3 text-muted-foreground/40 mx-auto" />
						)}
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

/**
 * Compact inline mapping controls for a single competition.
 * Each division gets a native <select> for the form submission.
 */
function CompetitionMappingRow({
	comp,
	template,
}: {
	comp: SeriesDivisionMappingData
	template: SeriesTemplateData
}) {
	if (comp.mappings.length === 0) return null

	return (
		<div className="rounded-md border p-3">
			<div className="flex items-center gap-2 mb-2">
				<span className="text-xs font-semibold">
					{comp.competitionName}
				</span>
				<Link
					to="/compete/organizer/$competitionId/divisions"
					params={{ competitionId: comp.competitionId }}
					className="text-muted-foreground hover:text-foreground"
				>
					<ExternalLink className="h-3 w-3" />
				</Link>
			</div>
			<div className="grid gap-1.5">
				{comp.mappings.map((m) => (
					<div
						key={m.competitionDivisionId}
						className="flex items-center gap-2 text-xs"
					>
						<span className="w-[180px] truncate text-muted-foreground font-mono" title={m.competitionDivisionLabel}>
							{m.competitionDivisionLabel}
						</span>
						<span className="text-muted-foreground shrink-0">→</span>
						<select
							name={`mapping::${comp.competitionId}::${m.competitionDivisionId}`}
							defaultValue={
								m.seriesDivisionId ?? "__unmapped__"
							}
							className="h-7 text-xs rounded-md border border-input bg-background px-2 py-0.5 flex-1 max-w-[200px] focus:outline-none focus:ring-2 focus:ring-ring"
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
						{m.confidence === "exact" ? (
							<Badge
								variant="outline"
								className="text-green-600 border-green-300 text-[10px] shrink-0"
							>
								auto
							</Badge>
						) : m.confidence === "fuzzy" ? (
							<Badge
								variant="outline"
								className="text-blue-600 border-blue-300 text-[10px] shrink-0"
							>
								fuzzy
							</Badge>
						) : null}
					</div>
				))}
			</div>
		</div>
	)
}
