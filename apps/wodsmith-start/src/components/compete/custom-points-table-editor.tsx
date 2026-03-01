"use client"

import { RotateCcw, X } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { generatePointsTable } from "@/lib/scoring/algorithms/custom"
import type { CustomTableConfig, TraditionalConfig } from "@/types/scoring"

/**
 * Props for the CustomPointsTableEditor component
 */
export interface CustomPointsTableEditorProps {
	/** Base template to use for default values */
	baseTemplate: CustomTableConfig["baseTemplate"]
	/** Place → points overrides (keys are string numbers) */
	overrides: Record<string, number>
	/** Traditional config for traditional/p_score templates */
	traditionalConfig?: TraditionalConfig
	/** Callback when overrides change */
	onChange: (overrides: Record<string, number>) => void
	/** Whether editing is disabled */
	disabled?: boolean
}

const MAX_PLACES = 30
const TEMPLATE_DISPLAY_NAMES: Record<
	CustomTableConfig["baseTemplate"],
	string
> = {
	traditional: "Traditional",
	winner_takes_more: "Winner Takes More",
}

/**
 * Editor for customizing the points table in custom scoring mode.
 *
 * Opens a dialog showing a table of places (1-30) with editable point values.
 * Supports overriding base template values and visually indicates custom values.
 */
export function CustomPointsTableEditor({
	baseTemplate,
	overrides,
	traditionalConfig,
	onChange,
	disabled = false,
}: CustomPointsTableEditorProps) {
	const [isOpen, setIsOpen] = useState(false)
	const [localOverrides, setLocalOverrides] =
		useState<Record<string, number>>(overrides)

	// Sync local state when props change
	useEffect(() => {
		setLocalOverrides(overrides)
	}, [overrides])

	// Generate base template values
	const baseValues = useMemo(() => {
		return generatePointsTable(baseTemplate, MAX_PLACES, traditionalConfig)
	}, [baseTemplate, traditionalConfig])

	// Get displayed value for a place (override or base)
	const getDisplayValue = useCallback(
		(place: number): number => {
			const placeKey = String(place)
			if (placeKey in localOverrides) {
				return localOverrides[placeKey]
			}
			return baseValues[place - 1] ?? 0
		},
		[localOverrides, baseValues],
	)

	// Check if a place has an override
	const hasOverride = useCallback(
		(place: number): boolean => {
			return String(place) in localOverrides
		},
		[localOverrides],
	)

	// Handle value change for a place
	const handleValueChange = useCallback(
		(place: number, value: number) => {
			const placeKey = String(place)
			const baseValue = baseValues[place - 1] ?? 0

			setLocalOverrides((prev) => {
				// If value matches base, remove override
				if (value === baseValue) {
					const { [placeKey]: _, ...rest } = prev
					return rest
				}
				// Otherwise, set override
				return { ...prev, [placeKey]: value }
			})
		},
		[baseValues],
	)

	// Handle blur (commit change)
	const handleBlur = useCallback(
		(place: number, inputValue: string) => {
			const value = Number.parseInt(inputValue, 10)
			if (Number.isNaN(value)) return

			const placeKey = String(place)
			const baseValue = baseValues[place - 1] ?? 0

			// Only trigger onChange if there's an actual change
			const currentOverrideValue = localOverrides[placeKey]
			const currentDisplayValue = currentOverrideValue ?? baseValue

			if (value !== currentDisplayValue) {
				handleValueChange(place, value)

				// Create new overrides for onChange
				const newOverrides = { ...localOverrides }
				if (value === baseValue) {
					delete newOverrides[placeKey]
				} else {
					newOverrides[placeKey] = value
				}

				// Only call onChange if overrides actually changed
				if (JSON.stringify(newOverrides) !== JSON.stringify(overrides)) {
					onChange(newOverrides)
				}
			}
		},
		[baseValues, localOverrides, overrides, onChange, handleValueChange],
	)

	// Reset a single place to base value
	const handleResetPlace = useCallback(
		(place: number) => {
			const placeKey = String(place)
			const { [placeKey]: _, ...rest } = localOverrides
			setLocalOverrides(rest)
			onChange(rest)
		},
		[localOverrides, onChange],
	)

	// Reset all overrides
	const handleResetAll = useCallback(() => {
		setLocalOverrides({})
		onChange({})
	}, [onChange])

	const overrideCount = Object.keys(localOverrides).length

	return (
		<>
			<Button
				variant="outline"
				onClick={() => setIsOpen(true)}
				disabled={disabled}
				type="button"
			>
				Edit Points Table...
			</Button>

			<Dialog open={isOpen} onOpenChange={setIsOpen}>
				<DialogContent className="max-w-md">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							Custom Points Table
							<Badge variant="secondary" className="text-xs">
								{TEMPLATE_DISPLAY_NAMES[baseTemplate]}
							</Badge>
							{overrideCount > 0 && (
								<Badge variant="default" className="text-xs">
									{overrideCount} custom
								</Badge>
							)}
						</DialogTitle>
						<DialogDescription>
							Customize points awarded for each placement. Values start from the
							{` ${TEMPLATE_DISPLAY_NAMES[baseTemplate]}`} template.
						</DialogDescription>
					</DialogHeader>

					<div className="flex justify-end">
						<Button
							variant="ghost"
							size="sm"
							onClick={handleResetAll}
							disabled={overrideCount === 0}
							className="text-xs"
						>
							<RotateCcw className="mr-1 h-3 w-3" />
							Reset All
						</Button>
					</div>

					<ScrollArea className="h-[400px] pr-4">
						<div className="space-y-1">
							{Array.from({ length: MAX_PLACES }, (_, i) => i + 1).map(
								(place) => {
									const isOverridden = hasOverride(place)
									const displayValue = getDisplayValue(place)

									return (
										<div
											key={place}
											data-testid={`points-row-${place}`}
											className={`flex items-center gap-3 rounded px-2 py-1.5 ${
												isOverridden ? "bg-accent" : ""
											}`}
										>
											<span className="w-8 text-right font-mono text-sm text-muted-foreground">
												{place}
											</span>

											<div className="flex-1">
												<Label htmlFor={`points-${place}`} className="sr-only">
													Points for place {place}
												</Label>
												<Input
													key={`${place}-${displayValue}`}
													id={`points-${place}`}
													type="number"
													min={0}
													max={999}
													className="h-8 w-20 text-center"
													defaultValue={displayValue}
													onBlur={(e) => handleBlur(place, e.target.value)}
													aria-label={`Points for place ${place}`}
												/>
											</div>

											{isOverridden ? (
												<Button
													variant="ghost"
													size="icon"
													className="h-6 w-6"
													onClick={() => handleResetPlace(place)}
													data-testid={`reset-row-${place}`}
													aria-label={`Reset place ${place} to default`}
												>
													<X className="h-3 w-3" />
												</Button>
											) : (
												<div className="h-6 w-6" />
											)}

											<span className="w-12 text-right text-xs text-muted-foreground">
												{isOverridden && (
													<span className="text-foreground">
														({baseValues[place - 1]})
													</span>
												)}
											</span>
										</div>
									)
								},
							)}
						</div>
					</ScrollArea>

					<DialogFooter>
						<Button onClick={() => setIsOpen(false)}>Done</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	)
}
