import { formatSecondsToTime } from "@/lib/utils";
import type { ResultSet as WorkoutSet } from "@/types";

export function SetDetails({ sets }: { sets: WorkoutSet[] | null }) {
	return (
		sets &&
		sets.length > 0 && (
			<div className="border-black border-t-2 p-4">
				<h4 className="mb-2 font-bold text-sm uppercase tracking-wider">Set Details</h4>
				<ul className="list-none space-y-1">
					{sets.map((set, index) => {
						const setInfo = [];
						if (set.reps) {
							setInfo.push(`${set.reps} reps`);
						}
						if (set.weight !== null && set.weight !== undefined) {
							setInfo.push(`@ ${set.weight}kg`);
						}
						if (set.distance) {
							setInfo.push(`${set.distance}m`);
						}
						if (set.time) {
							setInfo.push(formatSecondsToTime(set.time));
						}
						if (set.score) {
							setInfo.push(`Score: ${set.score}`);
						}
						return (
							<li key={set.id || index} className="flex font-mono text-xs">
								<span className="w-16 shrink-0">Set {set.setNumber}:</span>
								<span className="flex-1">{setInfo.join(" / ")}</span>
								{set.notes && (
									<span className="ml-2 text-neutral-500 italic">
										({set.notes})
									</span>
								)}
							</li>
						);
					})}
				</ul>
			</div>
		)
	);
}
