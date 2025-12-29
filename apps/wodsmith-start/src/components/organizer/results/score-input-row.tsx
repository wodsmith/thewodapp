"use client"

import { AlertTriangle, Check, Loader2 } from "lucide-react"
import { forwardRef, useImperativeHandle } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { ScoreType, TiebreakScheme, WorkoutScheme } from "@/db/schema"
import { cn } from "@/lib/utils"
import type { EventScoreEntryAthlete } from "@/types/competition-scores"
import { type ScoreEntryData, useScoreRowState } from "./use-score-row-state"

export type { ScoreEntryData } from "./use-score-row-state"

// Secondary score for time-capped workouts is always reps
const SECONDARY_PLACEHOLDER = "e.g., 150 reps"

interface ScoreInputRowProps {
	athlete: EventScoreEntryAthlete
	workoutScheme: WorkoutScheme
	/** Score aggregation type (min, max, sum, average, etc.) */
	scoreType?: ScoreType | null
	tiebreakScheme: TiebreakScheme | null
	showTiebreak?: boolean
	timeCap?: number
	/** Number of rounds to score (default 1) */
	roundsToScore?: number
	value?: ScoreEntryData
	isSaving?: boolean
	isSaved?: boolean
	onChange: (data: ScoreEntryData) => void
	onTabNext: () => void
	autoFocus?: boolean
	/** Lane number to display (optional) */
	laneNumber?: number
}

export interface ScoreInputRowHandle {
	focusPrimary: () => void
}

export const ScoreInputRow = forwardRef<
	ScoreInputRowHandle,
	ScoreInputRowProps
>(function ScoreInputRow(
	{
		athlete,
		workoutScheme,
		scoreType: scoreTypeProp,
		tiebreakScheme,
		showTiebreak = false,
		timeCap,
		roundsToScore = 1,
		value,
		isSaving,
		isSaved,
		onChange,
		onTabNext,
		autoFocus,
		laneNumber,
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
		secondaryValue,
		setSecondaryValue,
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
		subject: athlete,
		workoutScheme,
		scoreType: scoreTypeProp,
		tiebreakScheme,
		showTiebreak,
		timeCap,
		roundsToScore,
		value,
		autoFocus,
		onChange,
		onTabNext,
	})

	useImperativeHandle(
		ref,
		() => ({
			focusPrimary: () => {
				if (isMultiRound) {
					roundInputRefs.current.get(0)?.focus()
					return
				}
				scoreInputRef.current?.focus()
			},
		}),
		[isMultiRound, roundInputRefs, scoreInputRef],
	)

	// Determine status display
	const hasExistingResult = !!athlete.existingResult
	// Only show invalid warning styling when explicitly triggered (not persisted after "Save Anyway")
	const isInvalidWarning = showWarning
	const hasWarning = parseResult?.error && parseResult?.isValid

	return (
		<div
			className={cn(
				"grid items-center gap-3 border-b p-3 transition-colors",
				showTiebreak
					? "grid-cols-[60px_1fr_2fr_1fr_100px]"
					: "grid-cols-[60px_1fr_2fr_100px]",
				isInvalidWarning &&
					"bg-yellow-50 dark:bg-yellow-950/20 border-yellow-300",
				hasWarning &&
					!isInvalidWarning &&
					"bg-amber-50 dark:bg-amber-950/20 border-amber-300",
				isSaved &&
					!isInvalidWarning &&
					!hasWarning &&
					"bg-green-50 dark:bg-green-950/20",
			)}
		>
			{/* Lane / Index */}
			<div className="text-center">
				{laneNumber !== undefined ? (
					<span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">
						{laneNumber}
					</span>
				) : (
					<span className="text-muted-foreground">-</span>
				)}
			</div>

			{/* Athlete / Team Name */}
			<div className="min-w-0">
				{athlete.teamName ? (
					<>
						<div className="truncate font-medium">{athlete.teamName}</div>
						{athlete.teamMembers.length > 0 && (
							<div className="mt-0.5 text-xs text-muted-foreground">
								{athlete.teamMembers.map((member, idx) => (
									<span key={member.userId}>
										{idx > 0 && ", "}
										{member.firstName} {member.lastName}
										{member.isCaptain && (
											<span className="text-muted-foreground/70"> (c)</span>
										)}
									</span>
								))}
							</div>
						)}
					</>
				) : (
					<div className="truncate font-medium">
						{athlete.lastName}, {athlete.firstName}
					</div>
				)}
				{/* Only show division badge when not in heat view (no lane number) */}
				{laneNumber === undefined && (
					<Badge variant="outline" className="mt-1 text-xs">
						{athlete.divisionLabel}
					</Badge>
				)}
			</div>

			{/* Score Input */}
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
									// Validate doesn't exceed total rounds
									if (
										val !== "" &&
										(Number.isNaN(numVal) || numVal > numRounds || numVal < 0)
									) {
										return
									}
									setInputValue(val)
								}}
								onKeyDown={(e) => handleKeyDown(e, "score")}
								onBlur={() => handleBlur("score")}
								placeholder={`Rounds passed (max ${numRounds})`}
								min="0"
								max={numRounds}
								className="h-10 text-base font-mono w-40"
							/>
							<span className="text-sm text-muted-foreground">
								/ {numRounds} rounds
							</span>
						</div>
					</div>
				) : isMultiRound ? (
					/* Multi-Round Scoring */
					<div className="space-y-2">
						{roundScores.map((roundScore) => {
							const roundIndex = roundScore.roundNumber - 1
							const roundResult = roundParseResults[roundIndex]
							return (
								<div
									key={roundScore.roundNumber}
									className="flex items-center gap-2"
								>
									<span className="text-xs text-muted-foreground w-10 shrink-0">
										R{roundScore.roundNumber}:
									</span>
									<Input
										ref={(el) => {
											if (el) roundInputRefs.current.set(roundIndex, el)
										}}
										value={roundScore.score}
										onChange={(e) =>
											handleRoundScoreChange(roundIndex, e.target.value)
										}
										onKeyDown={(e) => handleKeyDown(e, "score", roundIndex)}
										onBlur={() => handleBlur("round")}
										placeholder={
											workoutScheme === "time" ||
											workoutScheme === "time-with-cap"
												? "90 (secs) or 1:30"
												: workoutScheme === "rounds-reps"
													? "5+12 or 5.12"
													: "Score"
										}
										className={cn(
											"h-8 text-sm font-mono flex-1",
											roundResult?.error &&
												!roundResult?.isValid &&
												"border-destructive focus:ring-destructive",
										)}
									/>
									{/* Preview to the right of input */}
									{roundResult?.isValid && (
										<span className="text-xs text-muted-foreground w-20 shrink-0">
											{roundResult.formatted}
										</span>
									)}
									{roundResult?.error && !roundResult?.isValid && (
										<span
											className="text-xs text-destructive w-20 shrink-0 truncate"
											title={roundResult.error}
										>
											Invalid
										</span>
									)}
								</div>
							)
						})}
						{/* Aggregate score below all rounds */}
						{(() => {
							const aggregate = getAggregateScore()
							const validCount = roundParseResults.filter(
								(r) => r?.isValid && r?.rawValue !== null,
							).length
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
										<span className="text-sm font-mono font-medium">
											{aggregate.formatted}
										</span>
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
								hasWarning &&
									!isInvalidWarning &&
									"border-amber-400 focus:ring-amber-400",
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
							<div className="mt-1 text-xs text-destructive">
								{parseResult.error}
							</div>
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
							placeholder={SECONDARY_PLACEHOLDER}
							className="h-10 text-base font-mono"
						/>
						<div className="mt-1 text-xs text-muted-foreground">
							Enter reps achieved at cap
						</div>
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
								<Button
									size="sm"
									variant="outline"
									onClick={handleConfirmWarning}
								>
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
			</div>

			{/* Tie-Break Input */}
			{showTiebreak && (
				<div className="space-y-2">
					<Input
						ref={tieBreakInputRef}
						value={tieBreakValue}
						onChange={(e) => handleTieBreakChange(e.target.value)}
						onKeyDown={(e) => handleKeyDown(e, "tieBreak")}
						onBlur={() => handleBlur("tieBreak")}
						placeholder={
							tiebreakScheme === "time" ? "90 (secs) or 1:30" : "e.g., 150 reps"
						}
						className={cn(
							"h-10 text-base font-mono",
							(showTieBreakWarning ||
								(tieBreakParseResult?.error &&
									!tieBreakParseResult?.isValid)) &&
								"border-yellow-400 focus:ring-yellow-400",
						)}
					/>
					{tieBreakParseResult?.isValid && !showTieBreakWarning && (
						<div className="mt-1 text-xs text-muted-foreground">
							Preview: {tieBreakParseResult.formatted}
						</div>
					)}
					{tieBreakParseResult?.error && !showTieBreakWarning && (
						<div className="mt-1 text-xs text-destructive">
							{tieBreakParseResult.error}
						</div>
					)}

					{/* Tiebreak Warning Message */}
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

			{/* Status */}
			<div className="text-center">
				{(() => {
					// Check if there's any input (for multi-round or single)
					const hasInput = isMultiRound
						? roundScores.some((rs) => rs.score)
						: inputValue

					if (isSaving) {
						return (
							<div className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
								<Loader2 className="h-4 w-4 animate-spin" />
								<span className="hidden sm:inline">Saving...</span>
							</div>
						)
					}
					if (isSaved || hasExistingResult) {
						return (
							<div className="flex items-center justify-center gap-1.5 text-sm text-green-600">
								<Check className="h-4 w-4" />
								<span className="hidden sm:inline">Saved</span>
							</div>
						)
					}
					if (hasInput) {
						return (
							<span className="text-sm text-muted-foreground">Pending</span>
						)
					}
					return <span className="text-sm text-muted-foreground">-</span>
				})()}
			</div>
		</div>
	)
})
