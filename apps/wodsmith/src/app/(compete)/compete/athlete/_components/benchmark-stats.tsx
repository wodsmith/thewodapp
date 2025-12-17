import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import {
	type AthleteProfileData,
	formatLiftWeight,
} from "@/utils/athlete-profile"

type BenchmarkStatsProps = {
	athleteProfile: AthleteProfileData | null
}

function formatConditioningValue(
	value:
		| { time?: string; reps?: string; rounds?: string; date?: string }
		| undefined,
): React.ReactNode {
	if (!value || (!value.time && !value.reps && !value.rounds)) {
		return <span className="text-muted-foreground">Not recorded</span>
	}

	const displayValue = value.time || value.reps || value.rounds || "N/A"

	return (
		<div>
			<span className="font-semibold">{displayValue}</span>
			{value.date && (
				<span className="text-muted-foreground ml-2 text-sm">
					{new Date(value.date).toLocaleDateString()}
				</span>
			)}
		</div>
	)
}

function formatStrengthValue(
	lift: { weight?: number; unit?: "kg" | "lbs"; date?: string } | undefined,
	preferredUnits: "imperial" | "metric",
): React.ReactNode {
	if (!lift || !lift.weight) {
		return <span className="text-muted-foreground">Not recorded</span>
	}

	// Default to lbs if unit is missing
	const unit = lift.unit || "lbs"

	return (
		<div>
			<span className="font-semibold">
				{formatLiftWeight(lift.weight, unit, preferredUnits)}
			</span>
			{lift.date && (
				<span className="text-muted-foreground ml-2 text-sm">
					{new Date(lift.date).toLocaleDateString()}
				</span>
			)}
		</div>
	)
}

export function BenchmarkStats({ athleteProfile }: BenchmarkStatsProps) {
	const conditioning = athleteProfile?.conditioning
	const strength = athleteProfile?.strength
	const preferredUnits = athleteProfile?.preferredUnits || "imperial"

	return (
		<div className="space-y-6">
			{/* Conditioning Metcons */}
			<Card>
				<CardHeader>
					<CardTitle>Notable Metcons</CardTitle>
					<CardDescription>
						Personal bests for benchmark workouts
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="grid gap-4 sm:grid-cols-2">
						<div className="space-y-1">
							<p className="text-muted-foreground text-sm">Fran</p>
							{formatConditioningValue(conditioning?.fran)}
						</div>
						<div className="space-y-1">
							<p className="text-muted-foreground text-sm">Grace</p>
							{formatConditioningValue(conditioning?.grace)}
						</div>
						<div className="space-y-1">
							<p className="text-muted-foreground text-sm">Helen</p>
							{formatConditioningValue(conditioning?.helen)}
						</div>
						<div className="space-y-1">
							<p className="text-muted-foreground text-sm">Diane</p>
							{formatConditioningValue(conditioning?.diane)}
						</div>
						<div className="space-y-1">
							<p className="text-muted-foreground text-sm">Murph</p>
							{formatConditioningValue(conditioning?.murph)}
						</div>
						<div className="space-y-1">
							<p className="text-muted-foreground text-sm">Cindy</p>
							{formatConditioningValue(conditioning?.maxCindyRounds)}
						</div>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Conditioning Metcons</CardTitle>
					<CardDescription>
						Personal bests for other conditioning workouts
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="grid gap-4 sm:grid-cols-2">
						<div className="space-y-1">
							<p className="text-muted-foreground text-sm">2K Row</p>
							{formatConditioningValue(conditioning?.row2k)}
						</div>
						<div className="space-y-1">
							<p className="text-muted-foreground text-sm">1 Mile Run</p>
							{formatConditioningValue(conditioning?.run1Mile)}
						</div>
						<div className="space-y-1">
							<p className="text-muted-foreground text-sm">5K Run</p>
							{formatConditioningValue(conditioning?.run5k)}
						</div>
						<div className="space-y-1">
							<p className="text-muted-foreground text-sm">500m Row</p>
							{formatConditioningValue(conditioning?.row500m)}
						</div>
						<div className="space-y-1">
							<p className="text-muted-foreground text-sm">Max Pull-ups</p>
							{formatConditioningValue(conditioning?.maxPullups)}
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Strength Lifts */}
			<Card>
				<CardHeader>
					<CardTitle>Strength Lifts</CardTitle>
					<CardDescription>One-rep max personal records</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="grid gap-4 sm:grid-cols-2">
						<div className="space-y-1">
							<p className="text-muted-foreground text-sm">Back Squat</p>
							{formatStrengthValue(strength?.backSquat, preferredUnits)}
						</div>
						<div className="space-y-1">
							<p className="text-muted-foreground text-sm">Deadlift</p>
							{formatStrengthValue(strength?.deadlift, preferredUnits)}
						</div>
						<div className="space-y-1">
							<p className="text-muted-foreground text-sm">Bench Press</p>
							{formatStrengthValue(strength?.benchPress, preferredUnits)}
						</div>
						<div className="space-y-1">
							<p className="text-muted-foreground text-sm">Press</p>
							{formatStrengthValue(strength?.press, preferredUnits)}
						</div>
						<div className="space-y-1">
							<p className="text-muted-foreground text-sm">Snatch</p>
							{formatStrengthValue(strength?.snatch, preferredUnits)}
						</div>
						<div className="space-y-1">
							<p className="text-muted-foreground text-sm">Clean & Jerk</p>
							{formatStrengthValue(strength?.cleanAndJerk, preferredUnits)}
						</div>
					</div>
				</CardContent>
			</Card>
		</div>
	)
}
