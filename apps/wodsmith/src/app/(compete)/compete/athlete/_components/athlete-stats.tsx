import { Card, CardContent } from "@/components/ui/card"
import {
	calculateAge,
	formatHeight,
	formatWeight,
	type AthleteProfileData,
} from "@/utils/athlete-profile"

type AthleteStatsProps = {
	dateOfBirth: Date | number | null
	athleteProfile: AthleteProfileData | null
}

export function AthleteStats({
	dateOfBirth,
	athleteProfile,
}: AthleteStatsProps) {
	const age = calculateAge(dateOfBirth)
	const preferredUnits = athleteProfile?.preferredUnits || "imperial"
	const heightDisplay = formatHeight(athleteProfile?.heightCm, preferredUnits)
	const weightDisplay = formatWeight(athleteProfile?.weightKg, preferredUnits)

	return (
		<div className="grid gap-4 sm:grid-cols-3">
			<Card>
				<CardContent className="pt-6">
					<div className="text-center">
						<p className="text-muted-foreground text-sm font-medium">Age</p>
						<p className="mt-2 text-2xl font-bold">
							{age !== null ? `${age} y.o.` : "Not set"}
						</p>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardContent className="pt-6">
					<div className="text-center">
						<p className="text-muted-foreground text-sm font-medium">Height</p>
						<p className="mt-2 text-2xl font-bold">{heightDisplay}</p>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardContent className="pt-6">
					<div className="text-center">
						<p className="text-muted-foreground text-sm font-medium">Weight</p>
						<p className="mt-2 text-2xl font-bold">{weightDisplay}</p>
					</div>
				</CardContent>
			</Card>
		</div>
	)
}
