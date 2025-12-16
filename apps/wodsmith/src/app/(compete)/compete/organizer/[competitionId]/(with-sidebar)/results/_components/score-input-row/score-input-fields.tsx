"use client"

import { forwardRef, useImperativeHandle } from "react"
import type { ScoreType, TiebreakScheme, WorkoutScheme } from "@/db/schema"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { AlertTriangle } from "lucide-react"
import {
	useScoreRowState,
	type ScoreEntryData,
	type ScoreInputSubject,
} from "./use-score-row-state"

export interface ScoreInputFieldsValue {
	/** Single-round raw input (e.g. \"1:30\", \"CAP\", \"5+12\", \"150\") */
	score: string
	/** Multi-round raw inputs */
	roundScores?: Array<{ score: string }>
	/** For time-with-cap CAP: reps achieved at cap */
	secondaryScore: string | null
	/** Optional tie-break input (generally not used for personal logs) */
	tieBreakScore: string | null
}

export interface ScoreInputFieldsHandle {
	getValue: () => ScoreInputFieldsValue
}

interface ScoreInputFieldsProps {
	workoutScheme: WorkoutScheme
	/** Score aggregation type (min, max, sum, average, etc.) */
	scoreType?: ScoreType | null
	tiebreakScheme: TiebreakScheme | null
	showTiebreak?: boolean
	timeCap?: number
	roundsToScore?: number
	autoFocus?: boolean
	/**
	 * Optional existing score to seed initial values.
	 * For new personal logs, pass `{ existingResult: null }` (default).
	 */
	subject?: ScoreInputSubject
}

export const ScoreInputFields = forwardRef<
	ScoreInputFieldsHandle,
	ScoreInputFieldsProps
>(function ScoreInputFields(
	{
		workoutScheme,
		scoreType: scoreTypeProp,
		tiebreakScheme,
		showTiebreak = false,
		timeCap,
		roundsToScore = 1,
		autoFocus,
		subject = { existingResult: null },
	},
	ref,
) {
	const {
		scoreInputRef,
		roundInputRefs,
		tieBreakInputRef,
		secondaryInputRef,
		inputValue,
		setInputValue,
		roundScores,
		tieBreakValue,
		setSecondaryValue,
		secondaryValue,
		showWarning,
		setShowWarning,
		showTieBreakWarning,
		setShowTieBreakWarning,
		numRounds,
		isPassFail,
		isMultiRound,
		showSecondaryInput,
		parseResult,
		roundParseResults,
		tieBreakParseResult,
		effectiveScoreType,
		handleInputChange,
		handleRoundScoreChange,
		handleTieBreakChange,
		handleBlur,
		handleKeyDown,
		handleConfirmWarning,
		handleConfirmTieBreakWarning,
		getAggregateScore,
	} = useScoreRowState({
		subject,
		workoutScheme,
		scoreType: scoreTypeProp,
		tiebreakScheme,
		showTiebreak,
		timeCap,
		roundsToScore,
		value: undefined,
		autoFocus,
		onChange: (_data: ScoreEntryData) => {
			// Personal log forms commit on submit; we only need internal state + previews here.
		},
		onTabNext: () => {
			// No-op for personal log forms.
		},
	})

	useImperativeHandle(
		ref,
		() => ({
			getValue: () => ({
				score: inputValue,
				roundScores: isMultiRound ? roundScores.map((r) => ({ score: r.score })) : undefined,
				secondaryScore: showSecondaryInput ? (secondaryValue || null) : null,
				tieBreakScore: showTiebreak ? (tieBreakValue || null) : null,
			}),
		}),
		[inputValue, isMultiRound, roundScores, secondaryValue, showSecondaryInput, showTiebreak, tieBreakValue],
	)

	const isInvalidWarning = showWarning
	const hasWarning = parseResult?.error && parseResult?.isValid

	return (
		<div className="space-y-2">
			{/* Pass-Fail Scheme */}
			{isPassFail ? (
				<div className="relative">
					<div className="flex items-center gap-2">
						<Input
							ref={scoreInputRef}
							type="number"
							value={inputValue}
							onChange={(e) => {
								const val = e.target.value
								const numVal = parseInt(val, 10)
								if (val !== "" && (Number.isNaN(numVal) || numVal > numRounds || numVal < 0))
									return
								setInputValue(val)
							}}
							onKeyDown={(e) => handleKeyDown(e, "score")}
							onBlur={() => handleBlur("score")}
							placeholder={`Rounds passed (max ${numRounds})`}
							min="0"
							max={numRounds}
							className="h-10 text-base font-mono w-40"
						/>
						<span className="text-sm text-muted-foreground">/ {numRounds} rounds</span>
					</div>
				</div>
			) : isMultiRound ? (
				/* Multi-Round Scoring */
				<div className="space-y-2">
					{roundScores.map((roundScore) => {
						const roundIndex = roundScore.roundNumber - 1
						const roundResult = roundParseResults[roundIndex]
						return (
							<div key={roundScore.roundNumber} className="flex items-center gap-2">
								<span className="text-xs text-muted-foreground w-10 shrink-0">
									R{roundScore.roundNumber}:
								</span>
								<Input
									ref={(el) => {
										if (el) roundInputRefs.current.set(roundIndex, el)
									}}
									value={roundScore.score}
									onChange={(e) => handleRoundScoreChange(roundIndex, e.target.value)}
									onKeyDown={(e) => handleKeyDown(e, "score", roundIndex)}
									onBlur={() => handleBlur("round")}
									placeholder={
										workoutScheme === "time" || workoutScheme === "time-with-cap"
											? "90 (secs) or 1:30"
											: workoutScheme === "rounds-reps"
												? "5+12 or 5.12"
												: "Score"
									}
									className={cn(
										"h-8 text-sm font-mono flex-1",
										roundResult?.error && !roundResult?.isValid && "border-destructive focus:ring-destructive",
									)}
								/>
								{roundResult?.isValid && (
									<span className="text-xs text-muted-foreground w-20 shrink-0">
										{roundResult.formatted}
									</span>
								)}
								{roundResult?.error && !roundResult?.isValid && (
									<span className="text-xs text-destructive w-20 shrink-0 truncate" title={roundResult.error}>
										Invalid
									</span>
								)}
							</div>
						)
					})}

					{/* Aggregate score below all rounds */}
					{(() => {
						const aggregate = getAggregateScore()
						const validCount = roundParseResults.filter((r) => r?.isValid && r?.rawValue !== null).length
						if (validCount > 0 && aggregate.formatted) {
							const getAggregateLabel = () => {
								switch (effectiveScoreType) {
									case "min":
										return "Best:"
									case "max":
										return "Best:"
									case "sum":
										return "Total:"
									case "average":
										return "Avg:"
									case "first":
										return "First:"
									case "last":
										return "Last:"
									default:
										return "Score:"
								}
							}
							return (
								<div className="flex items-center gap-2 pt-1 border-t border-dashed">
									<span className="text-xs font-medium text-muted-foreground w-10 shrink-0">
										{getAggregateLabel()}
									</span>
									<span className="text-sm font-mono font-medium">{aggregate.formatted}</span>
									<span className="text-xs text-muted-foreground">
										({validCount}/{numRounds} rounds)
									</span>
								</div>
							)
						}
						return null
					})()}
				</div>
			) : (
				/* Default: Single score input for all schemes */
				<div className="relative">
					<Input
						ref={scoreInputRef}
						value={inputValue}
						onChange={(e) => handleInputChange(e.target.value)}
						onKeyDown={(e) => handleKeyDown(e, "score")}
						onBlur={() => handleBlur("score")}
						placeholder={
							workoutScheme === "time" || workoutScheme === "time-with-cap"
								? "90 (secs) or 1:30"
								: workoutScheme === "rounds-reps"
									? "5+12 or 5.12"
									: "Enter score..."
						}
						className={cn(
							"h-10 text-base font-mono",
							isInvalidWarning && "border-yellow-400 focus:ring-yellow-400",
							hasWarning && !isInvalidWarning && "border-amber-400 focus:ring-amber-400",
						)}
					/>
					{parseResult?.isValid && !showSecondaryInput && (
						<div className="mt-1 text-xs text-muted-foreground">
							Preview: {parseResult.formatted}
						</div>
					)}
					{parseResult?.warning && (
						<div className="mt-1 text-xs text-amber-600 dark:text-amber-400">
							{parseResult.warning}
						</div>
					)}
					{parseResult?.error && (
						<div className="mt-1 text-xs text-destructive">{parseResult.error}</div>
					)}
				</div>
			)}

			{/* Secondary Score Input (for time-capped workouts when CAP) */}
			{showSecondaryInput && (
				<div className="relative">
					<Input
						ref={secondaryInputRef}
						value={secondaryValue}
						onChange={(e) => setSecondaryValue(e.target.value)}
						onKeyDown={(e) => handleKeyDown(e, "secondary")}
						onBlur={() => handleBlur("secondary")}
						placeholder="e.g., 150 reps"
						className="h-10 text-base font-mono"
					/>
					<div className="mt-1 text-xs text-muted-foreground">Enter reps achieved at cap</div>
				</div>
			)}

			{/* Warning Message (only for invalid scores) */}
			{isInvalidWarning && parseResult?.error && (
				<div className="flex items-start gap-2 rounded-md bg-yellow-100 dark:bg-yellow-900/30 p-2 text-sm">
					<AlertTriangle className="h-4 w-4 shrink-0 text-yellow-600" />
					<div className="flex-1">
						<p className="font-medium text-yellow-800 dark:text-yellow-200">
							{parseResult.error}
						</p>
						<div className="mt-2 flex gap-2">
							<Button size="sm" variant="outline" onClick={handleConfirmWarning}>
								Save Anyway
							</Button>
							<Button
								size="sm"
								variant="ghost"
								onClick={() => {
									setShowWarning(false)
									scoreInputRef.current?.focus()
								}}
							>
								Edit
							</Button>
						</div>
					</div>
				</div>
			)}

			{/* Tie-Break Input (optional) */}
			{showTiebreak && (
				<div className="space-y-2">
					<Input
						ref={tieBreakInputRef}
						value={tieBreakValue}
						onChange={(e) => handleTieBreakChange(e.target.value)}
						onKeyDown={(e) => handleKeyDown(e, "tieBreak")}
						onBlur={() => handleBlur("tieBreak")}
						placeholder={tiebreakScheme === "time" ? "90 (secs) or 1:30" : "e.g., 150 reps"}
						className={cn(
							"h-10 text-base font-mono",
							(showTieBreakWarning ||
								(tieBreakParseResult?.error && !tieBreakParseResult?.isValid)) &&
								"border-yellow-400 focus:ring-yellow-400",
						)}
					/>
					{tieBreakParseResult?.isValid && !showTieBreakWarning && (
						<div className="mt-1 text-xs text-muted-foreground">
							Preview: {tieBreakParseResult.formatted}
						</div>
					)}
					{tieBreakParseResult?.error && !showTieBreakWarning && (
						<div className="mt-1 text-xs text-destructive">{tieBreakParseResult.error}</div>
					)}

					{showTieBreakWarning && tieBreakParseResult?.error && (
						<div className="flex items-start gap-2 rounded-md bg-yellow-100 dark:bg-yellow-900/30 p-2 text-sm">
							<AlertTriangle className="h-4 w-4 shrink-0 text-yellow-600" />
							<div className="flex-1">
								<p className="font-medium text-yellow-800 dark:text-yellow-200">
									{tieBreakParseResult.error}
								</p>
								<div className="mt-2 flex gap-2">
									<Button
										size="sm"
										variant="outline"
										onClick={handleConfirmTieBreakWarning}
									>
										Save Anyway
									</Button>
									<Button
										size="sm"
										variant="ghost"
										onClick={() => {
											setShowTieBreakWarning(false)
											tieBreakInputRef.current?.focus()
										}}
									>
										Edit
									</Button>
								</div>
							</div>
						</div>
					)}
				</div>
			)}
		</div>
	)
})

