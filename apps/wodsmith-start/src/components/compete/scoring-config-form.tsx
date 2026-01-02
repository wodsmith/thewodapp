"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import type { ScoringConfig, ScoringAlgorithm } from "@/types/scoring"
import { CustomPointsTableEditor } from "./custom-points-table-editor"

/**
 * Props for the ScoringConfigForm component
 */
interface ScoringConfigFormProps {
	/** Current scoring configuration value */
	value: ScoringConfig
	/** Callback when configuration changes */
	onChange: (config: ScoringConfig) => void
	/** Optional list of events for head-to-head tiebreaker selection */
	events?: Array<{ id: string; name: string }>
	/** Whether the form is disabled */
	disabled?: boolean
}

/**
 * Form component for configuring competition scoring settings.
 * Supports traditional, P-Score, and custom scoring algorithms,
 * tiebreaker configuration, and DNF/DNS/Withdrawn handling.
 */
export function ScoringConfigForm({
	value,
	onChange,
	events,
	disabled = false,
}: ScoringConfigFormProps) {
	const handleAlgorithmChange = (algorithm: ScoringAlgorithm) => {
		const newConfig = { ...value, algorithm }

		// Initialize algorithm-specific config if missing
		if (algorithm === "traditional" && !newConfig.traditional) {
			newConfig.traditional = { step: 5, firstPlacePoints: 100 }
		} else if (algorithm === "p_score" && !newConfig.pScore) {
			newConfig.pScore = { allowNegatives: true, medianField: "top_half" }
		} else if (algorithm === "custom" && !newConfig.customTable) {
			newConfig.customTable = { baseTemplate: "traditional", overrides: {} }
		}

		onChange(newConfig)
	}

	const handleTraditionalStepChange = (step: number) => {
		onChange({
			...value,
			traditional: {
				...value.traditional,
				step,
				firstPlacePoints: value.traditional?.firstPlacePoints ?? 100,
			},
		})
	}

	const handlePScoreChange = (
		key: "allowNegatives" | "medianField",
		val: boolean | "top_half" | "all",
	) => {
		onChange({
			...value,
			pScore: {
				allowNegatives: value.pScore?.allowNegatives ?? true,
				medianField: value.pScore?.medianField ?? "top_half",
				[key]: val,
			},
		})
	}

	const handleCustomBaseTemplateChange = (
		baseTemplate: "traditional" | "p_score" | "winner_takes_more",
	) => {
		onChange({
			...value,
			customTable: {
				...value.customTable,
				baseTemplate,
				overrides: value.customTable?.overrides ?? {},
			},
		})
	}

	const handleSecondaryTiebreakerChange = (
		secondary: "none" | "head_to_head",
	) => {
		onChange({
			...value,
			tiebreaker: {
				...value.tiebreaker,
				primary: value.tiebreaker.primary,
				secondary: secondary === "none" ? undefined : secondary,
			},
		})
	}

	const handleHeadToHeadEventChange = (eventId: string) => {
		onChange({
			...value,
			tiebreaker: {
				...value.tiebreaker,
				primary: value.tiebreaker.primary,
				headToHeadEventId: eventId,
			},
		})
	}

	const handleStatusHandlingChange = (
		field: "dnf" | "dns" | "withdrawn",
		newValue: string,
	) => {
		onChange({
			...value,
			statusHandling: {
				...value.statusHandling,
				[field]: newValue,
			},
		})
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Scoring Configuration</CardTitle>
			</CardHeader>
			<CardContent className="space-y-6">
				{/* Scoring Algorithm Section */}
				<div className="space-y-4">
					<Label className="text-base font-medium">Scoring Algorithm</Label>
					<RadioGroup
						value={value.algorithm}
						onValueChange={(val) =>
							handleAlgorithmChange(val as ScoringAlgorithm)
						}
						disabled={disabled}
					>
						{/* Traditional Option */}
						<div className="space-y-2">
							<div className="flex items-center space-x-2">
								<RadioGroupItem value="traditional" id="algo-traditional" />
								<Label htmlFor="algo-traditional">
									Traditional (placement-based)
								</Label>
							</div>
							{value.algorithm === "traditional" && (
								<div className="ml-6 flex items-center space-x-2">
									<Label htmlFor="step">Step:</Label>
									<Input
										id="step"
										type="number"
										className="w-20"
										value={value.traditional?.step ?? 5}
										onChange={(e) =>
											handleTraditionalStepChange(Number(e.target.value))
										}
										disabled={disabled}
										min={1}
									/>
									<span className="text-sm text-muted-foreground">
										points between places
									</span>
								</div>
							)}
						</div>

						{/* P-Score Option */}
						<div className="space-y-2">
							<div className="flex items-center space-x-2">
								<RadioGroupItem value="p_score" id="algo-p_score" />
								<Label htmlFor="algo-p_score">
									P-Score (performance-based)
								</Label>
							</div>
							{value.algorithm === "p_score" && (
								<div className="ml-6 space-y-2">
									<div className="flex items-center space-x-2">
										<Checkbox
											id="allow-negatives"
											checked={value.pScore?.allowNegatives ?? true}
											onCheckedChange={(checked) =>
												handlePScoreChange("allowNegatives", checked === true)
											}
											disabled={disabled}
										/>
										<Label htmlFor="allow-negatives">
											Allow negative scores
										</Label>
									</div>
									<div className="flex items-center space-x-2">
										<Label htmlFor="median-field">
											Median calculated from:
										</Label>
										<Select
											value={value.pScore?.medianField ?? "top_half"}
											onValueChange={(val) =>
												handlePScoreChange(
													"medianField",
													val as "top_half" | "all",
												)
											}
											disabled={disabled}
										>
											<SelectTrigger id="median-field" className="w-[180px]">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="top_half">
													Top half of field
												</SelectItem>
												<SelectItem value="all">All competitors</SelectItem>
											</SelectContent>
										</Select>
									</div>
								</div>
							)}
						</div>

						{/* Custom Option */}
						<div className="space-y-2">
							<div className="flex items-center space-x-2">
								<RadioGroupItem value="custom" id="algo-custom" />
								<Label htmlFor="algo-custom">Custom</Label>
							</div>
							{value.algorithm === "custom" && (
								<div className="ml-6 space-y-2">
									<div className="flex items-center space-x-2">
										<Label htmlFor="base-template">Based on:</Label>
										<Select
											value={value.customTable?.baseTemplate ?? "traditional"}
											onValueChange={(val) =>
												handleCustomBaseTemplateChange(
													val as
														| "traditional"
														| "p_score"
														| "winner_takes_more",
												)
											}
											disabled={disabled}
										>
											<SelectTrigger id="base-template" className="w-[180px]">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="traditional">Traditional</SelectItem>
												<SelectItem value="p_score">P-Score</SelectItem>
												<SelectItem value="winner_takes_more">
													Winner Takes More
												</SelectItem>
											</SelectContent>
										</Select>
									</div>
									<CustomPointsTableEditor
										baseTemplate={
											value.customTable?.baseTemplate ?? "traditional"
										}
										overrides={value.customTable?.overrides ?? {}}
										traditionalConfig={value.traditional}
										onChange={(overrides) => {
											onChange({
												...value,
												customTable: {
													baseTemplate:
														value.customTable?.baseTemplate ?? "traditional",
													overrides,
												},
											})
										}}
										disabled={disabled}
									/>
								</div>
							)}
						</div>
					</RadioGroup>
				</div>

				{/* Tiebreaker Section */}
				<div className="space-y-4 border-t pt-4">
					<Label className="text-base font-medium">Tiebreakers</Label>
					<div className="flex items-center space-x-2">
						<span className="text-sm">Primary:</span>
						<span className="text-sm font-medium capitalize">
							{value.tiebreaker.primary === "countback"
								? "Countback"
								: value.tiebreaker.primary}
						</span>
					</div>
					<div className="space-y-2">
						<span className="text-sm">Secondary:</span>
						<RadioGroup
							value={value.tiebreaker.secondary ?? "none"}
							onValueChange={(val) =>
								handleSecondaryTiebreakerChange(val as "none" | "head_to_head")
							}
							disabled={disabled}
							className="flex flex-row gap-4"
						>
							<div className="flex items-center space-x-2">
								<RadioGroupItem value="none" id="secondary-none" />
								<Label htmlFor="secondary-none">None</Label>
							</div>
							<div className="flex items-center space-x-2">
								<RadioGroupItem value="head_to_head" id="secondary-h2h" />
								<Label htmlFor="secondary-h2h">Head-to-head</Label>
							</div>
						</RadioGroup>
						{value.tiebreaker.secondary === "head_to_head" &&
							events &&
							events.length > 0 && (
								<div className="flex items-center space-x-2">
									<Label htmlFor="h2h-event">on event:</Label>
									<Select
										value={value.tiebreaker.headToHeadEventId ?? ""}
										onValueChange={handleHeadToHeadEventChange}
										disabled={disabled}
									>
										<SelectTrigger id="h2h-event" className="w-[180px]">
											<SelectValue placeholder="Select event" />
										</SelectTrigger>
										<SelectContent>
											{events.map((event) => (
												<SelectItem key={event.id} value={event.id}>
													{event.name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							)}
					</div>
				</div>

				{/* DNF/DNS Handling Section */}
				<div className="space-y-4 border-t pt-4">
					<Label className="text-base font-medium">DNF/DNS Handling</Label>
					<div className="flex flex-wrap gap-4">
						<div className="flex items-center space-x-2">
							<Label htmlFor="dnf-handling">DNF:</Label>
							<Select
								value={value.statusHandling.dnf}
								onValueChange={(val) => handleStatusHandlingChange("dnf", val)}
								disabled={disabled}
							>
								<SelectTrigger id="dnf-handling" className="w-[140px]">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="last_place">Last place</SelectItem>
									<SelectItem value="zero">Zero points</SelectItem>
									<SelectItem value="worst_performance">
										Worst performance
									</SelectItem>
								</SelectContent>
							</Select>
						</div>

						<div className="flex items-center space-x-2">
							<Label htmlFor="dns-handling">DNS:</Label>
							<Select
								value={value.statusHandling.dns}
								onValueChange={(val) => handleStatusHandlingChange("dns", val)}
								disabled={disabled}
							>
								<SelectTrigger id="dns-handling" className="w-[140px]">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="zero">Zero points</SelectItem>
									<SelectItem value="exclude">Exclude</SelectItem>
									<SelectItem value="worst_performance">
										Worst performance
									</SelectItem>
								</SelectContent>
							</Select>
						</div>

						<div className="flex items-center space-x-2">
							<Label htmlFor="wd-handling">WD:</Label>
							<Select
								value={value.statusHandling.withdrawn}
								onValueChange={(val) =>
									handleStatusHandlingChange("withdrawn", val)
								}
								disabled={disabled}
							>
								<SelectTrigger id="wd-handling" className="w-[140px]">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="exclude">Exclude</SelectItem>
									<SelectItem value="zero">Zero points</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>
				</div>
			</CardContent>
		</Card>
	)
}
