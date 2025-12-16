import type { WorkoutScheme } from "@/db/schema"
import { decodeScore } from "@/lib/scoring"
import type { ResultSet as WorkoutSet } from "@/types"

export function SetDetails({
	sets,
	workoutScheme,
}: {
	sets: WorkoutSet[] | null
	workoutScheme: WorkoutScheme
}) {
	if (!sets || sets.length === 0) return null

	return (
		<div className="border-black border-t-2 p-4">
			<h4 className="mb-2 font-bold text-sm uppercase tracking-wider">
				Set Details
			</h4>
			<ul className="list-none space-y-1">
				{sets.map((set) => {
					const scheme = (set.schemeOverride || workoutScheme) as WorkoutScheme
					// Include units for load/distance schemes so users see "225 lbs" not just "225"
					const valueStr = decodeScore(set.value, scheme, { includeUnit: true })

					const parts: string[] = []

					if (set.status === "cap") {
						if (
							set.secondaryValue !== null &&
							set.secondaryValue !== undefined
						) {
							parts.push(`CAP - ${set.secondaryValue} reps`)
						} else {
							parts.push("CAP")
						}
					} else if (set.status === "dq") {
						parts.push("DQ")
					} else if (set.status === "withdrawn") {
						parts.push("WITHDRAWN")
					}

					parts.push(valueStr)

					return (
						<li key={set.id} className="flex font-mono text-xs">
							<span className="w-16 shrink-0">Set {set.roundNumber}:</span>
							<span className="flex-1">
								{parts.filter(Boolean).join(" / ")}
							</span>
							{set.notes && (
								<span className="ml-2 text-neutral-500 italic">
									({set.notes})
								</span>
							)}
						</li>
					)
				})}
			</ul>
		</div>
	)
}
