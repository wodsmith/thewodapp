import { useNavigate } from "@tanstack/react-router"
import { ArrowLeft } from "lucide-react"
import { useState } from "react"
import { MovementsList } from "@/components/movements-list"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
	type Movement,
	SCORE_TYPE_VALUES,
	type ScoreType,
	WORKOUT_SCHEME_VALUES,
	type WorkoutScheme,
} from "@/db/schemas/workouts"

// Scheme display labels
const SCHEME_LABELS: Record<WorkoutScheme, string> = {
	time: "For Time",
	"time-with-cap": "For Time (with cap)",
	"rounds-reps": "AMRAP (Rounds + Reps)",
	reps: "Max Reps",
	emom: "EMOM",
	load: "Max Load",
	calories: "Calories",
	meters: "Meters",
	feet: "Feet",
	points: "Points",
	"pass-fail": "Pass/Fail",
}

// Score type display labels
const SCORE_TYPE_LABELS: Record<ScoreType, string> = {
	min: "Min (lowest single set wins)",
	max: "Max (highest single set wins)",
	sum: "Sum (total across rounds)",
	average: "Average (mean across rounds)",
	first: "First",
	last: "Last",
}

// Get default score type based on scheme
function getDefaultScoreType(scheme: WorkoutScheme): ScoreType {
	switch (scheme) {
		case "time":
		case "time-with-cap":
			return "min" // Lower time is better
		case "rounds-reps":
		case "reps":
		case "calories":
		case "meters":
		case "feet":
		case "load":
		case "emom":
		case "pass-fail":
		case "points":
			return "max" // Higher is better
		default:
			return "max"
	}
}

export type WorkoutFormData = {
	name: string
	description: string
	scheme: WorkoutScheme
	scoreType?: ScoreType
	scope: "private" | "public"
	timeCap?: number
	roundsToScore?: number
	movementIds?: string[]
}

// Flexible movement type that can accept partial Movement data
type MovementData = Pick<Movement, "id" | "name" | "type">

type WorkoutFormProps = {
	mode: "create" | "edit"
	initialData?: Partial<WorkoutFormData>
	onSubmit: (data: WorkoutFormData) => Promise<void>
	backUrl: string
	movements?: MovementData[]
	initialMovementIds?: string[]
	isRemix?: boolean
}

export function WorkoutForm({
	mode,
	initialData,
	onSubmit,
	backUrl,
	movements = [],
	initialMovementIds = [],
	isRemix = false,
}: WorkoutFormProps) {
	const navigate = useNavigate()
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [error, setError] = useState<string | null>(null)

	// Form state
	const [name, setName] = useState(initialData?.name ?? "")
	const [description, setDescription] = useState(initialData?.description ?? "")
	const [scheme, setScheme] = useState<WorkoutScheme | undefined>(
		initialData?.scheme,
	)
	const [scoreType, setScoreType] = useState<ScoreType | undefined>(
		initialData?.scoreType,
	)
	const [scope, setScope] = useState<"private" | "public">(
		initialData?.scope ?? "private",
	)
	const [timeCap, setTimeCap] = useState<string>(
		initialData?.timeCap?.toString() ?? "",
	)
	const [roundsToScore, setRoundsToScore] = useState<string>(
		initialData?.roundsToScore?.toString() ?? "",
	)
	const [selectedMovements, setSelectedMovements] =
		useState<string[]>(initialMovementIds)

	// Handle movement toggle
	const handleMovementToggle = (movementId: string) => {
		if (selectedMovements.includes(movementId)) {
			setSelectedMovements(selectedMovements.filter((id) => id !== movementId))
		} else {
			setSelectedMovements([...selectedMovements, movementId])
		}
	}

	// Update score type when scheme changes
	const handleSchemeChange = (newScheme: WorkoutScheme) => {
		setScheme(newScheme)
		setScoreType(getDefaultScoreType(newScheme))
	}

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()

		if (!scheme) {
			setError("Please select a scheme")
			return
		}

		setIsSubmitting(true)
		setError(null)

		try {
			await onSubmit({
				name,
				description,
				scheme,
				scoreType,
				scope,
				timeCap: timeCap ? parseInt(timeCap, 10) : undefined,
				roundsToScore: roundsToScore ? parseInt(roundsToScore, 10) : undefined,
				movementIds:
					selectedMovements.length > 0 ? selectedMovements : undefined,
			})
		} catch (err) {
			setError(err instanceof Error ? err.message : "An error occurred")
		} finally {
			setIsSubmitting(false)
		}
	}

	return (
		<div className="container mx-auto max-w-2xl px-4 py-8">
			{/* Header */}
			<div className="mb-6 flex items-center gap-3">
				<Button
					variant="outline"
					size="icon"
					onClick={() => navigate({ to: backUrl })}
				>
					<ArrowLeft className="h-5 w-5" />
				</Button>
				<h1 className="text-2xl font-bold">
					{isRemix
						? "REMIX WORKOUT"
						: mode === "create"
							? "CREATE WORKOUT"
							: "EDIT WORKOUT"}
				</h1>
			</div>

			{/* Remix notice */}
			{isRemix && (
				<div className="mb-6 p-4 bg-muted rounded-lg border">
					<p className="text-sm text-muted-foreground">
						You're creating a remix. Modify the workout below and save to create
						your own version.
					</p>
				</div>
			)}

			<form
				onSubmit={handleSubmit}
				className="space-y-6 border-2 border-border p-6 rounded-lg"
			>
				{/* Name */}
				<div className="space-y-2">
					<Label htmlFor="name" className="font-bold uppercase">
						Workout Name
					</Label>
					<Input
						id="name"
						type="text"
						placeholder="e.g., Fran, Cindy, Custom WOD"
						value={name}
						onChange={(e) => setName(e.target.value)}
						required
					/>
				</div>

				{/* Description */}
				<div className="space-y-2">
					<Label htmlFor="description" className="font-bold uppercase">
						Description
					</Label>
					<Textarea
						id="description"
						rows={4}
						placeholder="Describe the workout (e.g., 21-15-9 reps for time of Thrusters and Pull-ups)"
						value={description}
						onChange={(e) => setDescription(e.target.value)}
						required
					/>
				</div>

				{/* Movements - only show if movements are provided */}
				{movements.length > 0 && (
					<MovementsList
						movements={movements}
						selectedMovements={selectedMovements}
						onMovementToggle={handleMovementToggle}
						mode="selectable"
						variant="default"
						containerHeight="h-[300px]"
					/>
				)}

				{/* Scheme */}
				<div className="space-y-2">
					<Label className="font-bold uppercase">Scheme</Label>
					<Select value={scheme} onValueChange={handleSchemeChange}>
						<SelectTrigger>
							<SelectValue placeholder="Select a scheme" />
						</SelectTrigger>
						<SelectContent>
							{WORKOUT_SCHEME_VALUES.map((s) => (
								<SelectItem key={s} value={s}>
									{SCHEME_LABELS[s]}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				{/* Score Type - only show when scheme is selected */}
				{scheme && (
					<div className="space-y-2">
						<Label className="font-bold uppercase">Score Type</Label>
						<Select
							value={scoreType}
							onValueChange={(v) => setScoreType(v as ScoreType)}
						>
							<SelectTrigger>
								<SelectValue placeholder="Select score type" />
							</SelectTrigger>
							<SelectContent>
								{SCORE_TYPE_VALUES.map((st) => (
									<SelectItem key={st} value={st}>
										{SCORE_TYPE_LABELS[st]}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				)}

				{/* Time Cap - only show for time-with-cap scheme */}
				{scheme === "time-with-cap" && (
					<div className="space-y-2">
						<Label htmlFor="timeCap" className="font-bold uppercase">
							Time Cap (seconds)
						</Label>
						<Input
							id="timeCap"
							type="number"
							placeholder="e.g., 600 (10 minutes)"
							value={timeCap}
							onChange={(e) => setTimeCap(e.target.value)}
							min="1"
						/>
					</div>
				)}

				{/* Scope */}
				<div className="space-y-2">
					<Label className="font-bold uppercase">Scope</Label>
					<Select
						value={scope}
						onValueChange={(v) => setScope(v as "private" | "public")}
					>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="private">Private</SelectItem>
							<SelectItem value="public">Public</SelectItem>
						</SelectContent>
					</Select>
				</div>

				{/* Advanced Options */}
				<div className="space-y-2">
					<Label htmlFor="roundsToScore" className="font-bold uppercase">
						Rounds to Score
					</Label>
					<Input
						id="roundsToScore"
						type="number"
						placeholder="e.g., 4 (default is 1)"
						value={roundsToScore}
						onChange={(e) => setRoundsToScore(e.target.value)}
						min="1"
					/>
				</div>

				{/* Error */}
				{error && <div className="text-sm text-destructive">{error}</div>}

				{/* Actions */}
				<div className="flex justify-end gap-4 pt-4">
					<Button
						type="button"
						variant="outline"
						onClick={() => navigate({ to: backUrl })}
					>
						Cancel
					</Button>
					<Button type="submit" disabled={isSubmitting}>
						{isSubmitting
							? mode === "create"
								? "Creating..."
								: "Saving..."
							: mode === "create"
								? "Create Workout"
								: "Save Changes"}
					</Button>
				</div>
			</form>
		</div>
	)
}
