"use client";

import type {
  Movement,
  WorkoutResult,
  WorkoutWithTagsAndMovements,
} from "@/types";
import { ListChecks, Plus } from "lucide-react";
import Link from "next/link";

interface MovementDetailClientProps {
  movement: Movement;
  workouts: WorkoutWithTagsAndMovements[];
  workoutResults: { [key: string]: WorkoutResult[] };
}

// Helper to format date
const formatDate = (timestamp: number | Date | null) => {
  if (!timestamp) return "N/A";
  return new Date(timestamp).toLocaleDateString();
};

export default function MovementDetailClient({
  movement,
  workouts,
  workoutResults,
}: MovementDetailClientProps) {
  console.log("[MovementDetailClient] Rendering for movement:", movement.name);
  console.log("[MovementDetailClient] Associated workouts:", workouts);
  console.log("[MovementDetailClient] Workout results:", workoutResults);

  return (
    <div>
      <h1 className="mb-6 font-bold text-3xl">{movement.name.toUpperCase()}</h1>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <ListChecks className="h-6 w-6" />
          <h2 className="font-semibold text-2xl">Workout Results</h2>
        </div>

        {workouts.length > 0 ? (
          <div className="space-y-8">
            {workouts.map((workout) => {
              const resultsForWorkout = workoutResults[workout.id] || [];
              return (
                <div key={workout.id} className="border-2 border-black p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="font-medium text-xl">{workout.name}</h3>
                    <Link
                      href={{
                        pathname: "/log/new",
                        query: {
                          workoutId: workout.id,
                          redirectUrl: `/movements/${movement.id}`,
                        },
                      }}
                      className="btn btn-sm flex items-center gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Log Result
                    </Link>
                  </div>
                  {workout.description && (
                    <p className="mb-4 text-gray-700 text-sm italic">
                      {workout.description}
                    </p>
                  )}

                  {resultsForWorkout.length > 0 ? (
                    <div className="space-y-4">
                      {resultsForWorkout.map((result) => (
                        <div
                          key={result.id}
                          className="rounded border-2 border-gray-200 p-4"
                        >
                          <div className="mb-2 flex items-center justify-between">
                            <p className="font-bold text-lg">
                              {formatDate(result.date)}
                            </p>
                            {result.scale && (
                              <span className="rounded bg-gray-200 px-2 py-1 font-bold text-black text-xs uppercase">
                                {result.scale}
                              </span>
                            )}
                          </div>
                          {result.wodScore && (
                            <p className="mb-1 text-xl">{result.wodScore}</p>
                          )}
                          {result.notes && (
                            <p className="text-gray-600 text-sm">
                              Notes: {result.notes}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500">
                      No results logged yet for this workout.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-gray-500">
            No workouts associated with this movement to show results for.
          </p>
        )}
      </section>
    </div>
  );
}
