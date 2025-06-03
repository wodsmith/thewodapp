"use client";

import type { Movement, ResultSet, Tag, WorkoutResult, WorkoutWithTagsAndMovements } from "@/types";
import { ArrowLeft, Clock, Dumbbell, Edit, ListChecks, Tag as TagIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { SetDetails } from "./set-details";

// Define a new type for results with their sets
export type WorkoutResultWithSets = WorkoutResult & {
	sets: ResultSet[] | null;
};

export default function WorkoutDetailClient({
	userId,
	workout,
	workoutId,
	resultsWithSets, // Changed from results and resultSetDetails
}: {
	userId: string;
	workout: WorkoutWithTagsAndMovements;
	workoutId: string;
	resultsWithSets: WorkoutResultWithSets[]; // Use the new type
}) {
	if (!workout) return <div>Loading...</div>;

	const canEditWorkout = userId === workout.userId;

	// Helper to format date
	const formatDate = (timestamp: number | Date | null) => {
		if (!timestamp) return "N/A";
		return new Date(timestamp).toLocaleDateString();
	};

	return (
		<div>
			<div className="mb-6 flex items-center justify-between">
				<div className="flex items-center gap-2">
					<Link
						href="/workouts"
						className="btn-outline p-2 dark:border-dark-border dark:text-dark-foreground dark:hover:bg-dark-accent dark:hover:text-dark-accent-foreground"
					>
						<ArrowLeft className="h-5 w-5" />
					</Link>
					<h1>{workout.name}</h1>
				</div>
				{canEditWorkout && (
					<Link
						href={`/workouts/${workoutId}/edit`}
						className="btn flex items-center gap-2 dark:border-dark-border dark:bg-dark-primary dark:text-dark-primary-foreground dark:hover:bg-dark-primary/90"
					>
						<>
							<Edit className="h-5 w-5" />
							Edit Workout
						</>
					</Link>
				)}
			</div>

			<div className="mb-6 border-2 border-black dark:border-dark-border">
				{/* Workout Details Section */}
				<div className="border-black border-b-2 p-6 dark:border-dark-border">
					<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
						<div>
							<h2 className="mb-4">DESCRIPTION</h2>
							<p className="mb-6 whitespace-pre-wrap text-foreground text-lg dark:text-dark-foreground">
								{workout.description}
							</p>
						</div>

						<div>
							<div className="my-4 flex items-center gap-2">
								<Clock className="h-5 w-5" />
								<h3>SCHEME</h3>
							</div>
							<div className="mb-6 w-fit border-2 border-black p-4 dark:border-dark-border">
								<p className="w-fit font-bold text-foreground text-lg uppercase dark:text-dark-foreground">
									{workout.scheme}
								</p>
							</div>
							<div className="mb-4 flex items-center gap-2">
								<Dumbbell className="h-5 w-5" />
								<h3>MOVEMENTS</h3>
							</div>
							<div className="space-y-4">
								{(workout.movements || []).map((movement: Movement) => (
									<div
										key={movement.id}
										className="border-2 border-black p-4 dark:border-dark-border"
									>
										<div className="flex items-center justify-between">
											<p className="font-bold text-foreground text-lg dark:text-dark-foreground">
												{movement.name}
											</p>
											<span className="bg-black px-2 py-1 font-bold text-white text-xs uppercase dark:bg-dark-foreground dark:text-dark-background">
												{movement.type}
											</span>
										</div>
									</div>
								))}
							</div>

							{workout.tags && workout.tags.length > 0 && (
								<>
									<div className="my-4 flex items-center gap-2">
										<TagIcon className="h-5 w-5" />
										<h3>TAGS</h3>
									</div>
									<div className="mb-6 flex flex-wrap gap-2">
										{(workout.tags || []).map((tag: Tag) => (
											<span
												key={tag.id}
												className="inline-block border-2 border-black px-3 py-1 text-foreground dark:border-dark-border dark:text-dark-foreground"
											>
												{tag.name}
											</span>
										))}
									</div>
								</>
							)}
						</div>
					</div>
				</div>

				{/* Results Section */}
				<div className="p-6">
					<div className="mb-4 flex items-center justify-between">
						<div className="flex items-center gap-2">
							<ListChecks className="h-5 w-5" />
							<h2>WORKOUT RESULTS</h2>
						</div>
						<Link
							href={`/log/new?workoutId=${workoutId}&redirectUrl=/workouts/${workoutId}`}
							className="btn dark:border-dark-border dark:bg-dark-primary dark:text-dark-primary-foreground dark:hover:bg-dark-primary/90"
						>
							Log Result
						</Link>
					</div>
					{resultsWithSets && resultsWithSets.length > 0 ? (
						<div className="space-y-4">
							{resultsWithSets.map((result) => (
								<div
									key={result.id}
									className="border-2 border-black dark:border-dark-border"
								>
									<div className="p-4">
										<div className="mb-2 flex items-center justify-between">
											<p className="font-bold text-foreground text-lg dark:text-dark-foreground">
												{formatDate(result.date)}
											</p>
											{result.scale && (
												<span className="bg-gray-200 px-2 py-1 font-bold text-black text-xs uppercase dark:bg-dark-muted dark:text-dark-foreground">
													{result.scale}
												</span>
											)}
										</div>
										{result.wodScore && (
											<p className="mb-1 text-foreground text-xl dark:text-dark-foreground">
												{result.wodScore}
											</p>
										)}
										{result.notes && (
											<p className="text-gray-600 text-sm dark:text-dark-muted-foreground">
												Notes: {result.notes}
											</p>
										)}
									</div>
									{workout.roundsToScore &&
										workout.roundsToScore > 1 &&
										result.sets && (
											<Suspense
												fallback={
													<div className="text-foreground dark:text-dark-foreground">
														Loading sets...
													</div>
												}
											>
												<SetDetails sets={result.sets} />
											</Suspense>
										)}
								</div>
							))}
						</div>
					) : (
						<div className="text-gray-500 dark:text-dark-muted-foreground">
							No results logged yet.
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
