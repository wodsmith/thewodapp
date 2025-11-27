import { AlertCircle, Dumbbell } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import type { Competition, CompetitionGroup, Team } from "@/db/schema"

interface WorkoutsContentProps {
	competition: Competition & {
		organizingTeam: Team | null
		group: CompetitionGroup | null
	}
}

export function WorkoutsContent(_props: WorkoutsContentProps) {
	// TODO: Fetch actual workouts when data model is implemented

	return (
		<div className="container mx-auto px-4 py-8">
			<div className="max-w-4xl">
				<h2 className="text-2xl font-bold mb-6">Workouts</h2>

				<Alert variant="default" className="border-dashed">
					<Dumbbell className="h-4 w-4" />
					<AlertTitle>Workouts not yet released</AlertTitle>
					<AlertDescription>
						Competition workouts will be announced closer to the event.
						Check back soon or follow the event organizer for updates.
					</AlertDescription>
				</Alert>

				{/* Implementation Note for Developers */}
				<div className="mt-8 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
					<div className="flex items-start gap-2">
						<AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
						<div>
							<p className="font-medium text-amber-800 dark:text-amber-200">Implementation TODO</p>
							<ul className="mt-2 text-sm text-amber-700 dark:text-amber-300 space-y-1">
								<li>• Create workout data model (name, description, time cap, scoring)</li>
								<li>• Support workout variations per division</li>
								<li>• Workout poster/banner image upload</li>
								<li>• Movement standards section (expandable)</li>
								<li>• Floor layout diagram/image</li>
								<li>• Sponsor attribution per workout</li>
								<li>• Link workouts to schedule/heats</li>
								<li>• Support for scoring types (time, reps, weight, etc.)</li>
							</ul>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
