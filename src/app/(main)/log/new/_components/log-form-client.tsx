"use client";

import type { Workout } from "@/types";
import { ArrowLeft, Search } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { useServerAction } from "zsa-react";
import { submitLogFormAction } from "@/actions/log-actions";
import { toast } from "sonner";

export default function LogFormClient({
  workouts,
  userId,
  selectedWorkoutId,
  redirectUrl,
}: {
  workouts: Workout[]; // Use the Workout interface
  userId: string;
  selectedWorkoutId?: string;
  redirectUrl?: string;
}) {
  const router = useRouter(); // Kept for "Cancel" button or other navigation
  const { execute: submitLogForm } = useServerAction(submitLogFormAction, {
    onError: (error) => {
      console.error("Server action error:", error);
      setFormError(error.err?.message);
    },
    onSuccess: () => {
      toast.success("Result logged successfully");
      router.push((redirectUrl || "/log") as Parameters<typeof router.push>[0]);
    },
  });
  const [selectedWorkout, setSelectedWorkout] = useState<string | null>(
    selectedWorkoutId || null
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [scale, setScale] = useState<"rx" | "scaled" | "rx+">("rx");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [scores, setScores] = useState<string[][]>([]); // Changed to string[][] for multi-part scores
  const [notes, setNotes] = useState("");
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const prevSelectedWorkoutIdRef = useRef<string | null | undefined>(undefined); // Ref to track previous workout ID for scores effect
  const pathname = usePathname(); // Get current pathname

  const filteredWorkouts = workouts
    .filter((workout: Workout) =>
      workout.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      if (a.id === selectedWorkout) return -1; // a comes first if it's the selected workout
      if (b.id === selectedWorkout) return 1; // b comes first if it's the selected workout
      // Sort by createdAt descending (newest first)
      // Treat null or undefined createdAt as older than any workout with a date
      if (a.createdAt && b.createdAt) {
        return b.createdAt.getTime() - a.createdAt.getTime();
      }
      if (a.createdAt) {
        return -1; // a has a date, b does not, so a is newer
      }
      if (b.createdAt) {
        return 1; // b has a date, a does not, so b is newer
      }
      return a.name.localeCompare(b.name); // fallback to name sort if no dates
    });

  const getSelectedWorkout = () => {
    return workouts.find((w: Workout) => w.id === selectedWorkout);
  };

  // Effect to synchronize internal selectedWorkout state with selectedWorkoutId prop
  useEffect(() => {
    const currentPropId = selectedWorkoutId || null;
    if (selectedWorkout !== currentPropId) {
      setSelectedWorkout(currentPropId);
    }
  }, [selectedWorkoutId, selectedWorkout]);

  // Update scores state when selected workout changes, preserving input during Fast Refresh
  useEffect(() => {
    // Handling the case where no workout is selected
    if (!selectedWorkout) {
      if (scores.length !== 0) {
        // Only update if scores are not already empty
        setScores([]);
      }
      // Ensure ref reflects that scores are for "no workout"
      if (prevSelectedWorkoutIdRef.current !== null) {
        prevSelectedWorkoutIdRef.current = null;
      }
      return;
    }

    // Handling the case where a workout IS selected
    const currentWorkoutData = workouts.find((w) => w.id === selectedWorkout);
    // currentWorkoutData might be undefined if selectedWorkout ID is stale/invalid
    // Default values handle this for numRoundsForInputs, etc.
    const numRoundsForInputs = currentWorkoutData?.roundsToScore || 1;
    const hasRepsPerRound = !!currentWorkoutData?.repsPerRound;
    const expectedPartsPerScore = hasRepsPerRound ? 2 : 1; // 2 parts for rounds+reps, 1 otherwise

    // Determine if scores need to be reset or initialized
    const workoutIdContextChanged =
      prevSelectedWorkoutIdRef.current !== selectedWorkout;
    const scoresNeedRestructure =
      scores.length !== numRoundsForInputs ||
      scores.some((parts) => parts.length !== expectedPartsPerScore);

    if (workoutIdContextChanged || scoresNeedRestructure) {
      const newInitialScores = Array(numRoundsForInputs)
        .fill(null)
        .map(() => Array(expectedPartsPerScore).fill(""));
      setScores(newInitialScores);
      // After scores are set/reset for the current selectedWorkout, update the ref.
      prevSelectedWorkoutIdRef.current = selectedWorkout;
    }
    // If workoutIdContextChanged is false AND scoresNeedRestructure is false,
    // it means prevSelectedWorkoutIdRef.current is already selectedWorkout,
    // and scores are correctly structured. No action needed, preventing a loop.
  }, [selectedWorkout, workouts, scores]); // scores is included to re-validate if its structure is somehow externally changed or inconsistent

  const handleScoreChange = (
    roundIndex: number,
    partIndex: number,
    value: string
  ) => {
    const newScores = scores.map((parts, rIndex) => {
      if (rIndex === roundIndex) {
        const newParts = [...parts];
        newParts[partIndex] = value;
        return newParts;
      }
      return parts;
    });
    setScores(newScores);
  };

  const handleWorkoutSelection = (workoutId: string) => {
    const params = new URLSearchParams();
    params.set("workoutId", workoutId);
    // By not setting redirectUrl, it's effectively cleared from the query params
    router.push(
      `${pathname}?${params.toString()}` as Parameters<typeof router.push>[0]
    );
  };

  // Client-side handler to call the server action
  async function handleFormSubmit(formData: FormData) {
    setFormError(null); // Clear previous errors
    if (!selectedWorkout) {
      setFormError("Please select a workout first.");
      return;
    }

    // Add redirectUrl to formData if it exists
    if (redirectUrl) {
      formData.set("redirectUrl", redirectUrl);
    }

    // Add scores to formData
    scores.forEach((scoreParts, roundIndex) => {
      scoreParts.forEach((partValue, partIndex) => {
        formData.append(`scores[${roundIndex}][${partIndex}]`, partValue || "");
      });
    });

    // Ensure selectedWorkoutId is on formData if not already explicitly set by a hidden field
    // (The hidden field <input type="hidden" name="selectedWorkoutId" value={selectedWorkout} /> handles this)
    if (!formData.has("selectedWorkoutId") && selectedWorkout) {
      formData.set("selectedWorkoutId", selectedWorkout);
    }

    startTransition(async () => {
      try {
        await submitLogForm({
          userId,
          workouts,
          formData,
        });
        // On successful redirect, the page will navigate away.
      } catch (error) {
        // This catch block is for unexpected errors not handled by the action returning a {error} object
        // or if the action itself throws an unhandled exception.
        console.error("Client-side error during form submission:", error);
        setFormError("An unexpected error occurred. Please try again.");
      }
    });
  }

  return (
    <form action={handleFormSubmit}>
      {selectedWorkout && (
        <input type="hidden" name="selectedWorkoutId" value={selectedWorkout} />
      )}
      {redirectUrl && (
        <input type="hidden" name="redirectUrl" value={redirectUrl} />
      )}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link
            href={(redirectUrl || "/log") as Parameters<typeof router.push>[0]}
            className="btn-outline p-2"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1>LOG RESULT</h1>
        </div>
      </div>
      <div className="border-2 border-black p-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <h2 className="mb-4">SELECT WORKOUT</h2>
            <div className="relative mb-4">
              <Search className="-translate-y-1/2 absolute top-1/2 left-3 transform text-gray-500" />
              <input
                type="text"
                placeholder="Search workouts..."
                className="input pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="h-[400px] overflow-y-auto border-2 border-black">
              {filteredWorkouts.length > 0 ? (
                <div className="divide-y-2 divide-black">
                  {filteredWorkouts.map((workout: Workout) => (
                    <button
                      key={workout.id}
                      type="button"
                      onClick={() => handleWorkoutSelection(workout.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ")
                          handleWorkoutSelection(workout.id);
                      }}
                      className={`cursor-pointer p-4 ${
                        selectedWorkout === workout.id
                          ? "bg-black text-white"
                          : "hover:bg-gray-100"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold">{workout.name}</h3>
                        {selectedWorkout === workout.id && (
                          <span className="text-xs">✓</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center">
                  <p>No workouts found</p>
                </div>
              )}
            </div>
          </div>
          <div>
            {selectedWorkout ? (
              <div>
                <h2 className="mb-4">
                  LOG RESULT FOR {getSelectedWorkout()?.name}
                </h2>
                <div className="space-y-6">
                  <div>
                    <label
                      htmlFor="log-date"
                      className="mb-2 block font-bold uppercase"
                    >
                      Date
                    </label>
                    <input
                      id="log-date"
                      type="date"
                      className="input"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      name="date"
                    />
                  </div>
                  <div>
                    <span
                      id="scale-label"
                      className="mb-2 block font-bold uppercase"
                    >
                      Scale
                    </span>
                    <div
                      className="flex gap-4"
                      role="radiogroup"
                      aria-labelledby="scale-label"
                    >
                      <label
                        className="flex items-center gap-2"
                        htmlFor="scale-rx"
                      >
                        <input
                          id="scale-rx"
                          type="radio"
                          name="scale"
                          value="rx"
                          checked={scale === "rx"}
                          onChange={() => setScale("rx")}
                          className="h-5 w-5"
                        />
                        <span>RX</span>
                      </label>
                      <label
                        className="flex items-center gap-2"
                        htmlFor="scale-rxplus"
                      >
                        <input
                          id="scale-rxplus"
                          type="radio"
                          name="scale"
                          value="rx+"
                          checked={scale === "rx+"}
                          onChange={() => setScale("rx+")}
                          className="h-5 w-5"
                        />
                        <span>RX+</span>
                      </label>
                      <label
                        className="flex items-center gap-2"
                        htmlFor="scale-scaled"
                      >
                        <input
                          id="scale-scaled"
                          type="radio"
                          name="scale"
                          value="scaled"
                          checked={scale === "scaled"}
                          onChange={() => setScale("scaled")}
                          className="h-5 w-5"
                        />
                        <span>Scaled</span>
                      </label>
                    </div>
                  </div>
                  <div>
                    <label
                      htmlFor="log-score"
                      className="mb-2 block font-bold uppercase"
                    >
                      Score
                    </label>
                    {scores.map((scoreParts, roundIndex) => {
                      const key = scoreParts[roundIndex] || roundIndex;
                      const currentWorkoutDetails = getSelectedWorkout();
                      const hasRepsPerRound =
                        !!currentWorkoutDetails?.repsPerRound;
                      const repsPerRoundValue =
                        currentWorkoutDetails?.repsPerRound;

                      return (
                        <div key={key} className="mb-3">
                          {/* Wrapper for each score entry/round */}
                          {currentWorkoutDetails?.roundsToScore &&
                            currentWorkoutDetails.roundsToScore > 1 && (
                              <label
                                htmlFor={`round-score-${roundIndex}`}
                                className="mb-1 block font-medium text-gray-700 text-sm"
                              >
                                Round {roundIndex + 1} Score
                              </label>
                            )}
                          {hasRepsPerRound ? (
                            <div className="flex items-center gap-2">
                              <input
                                id={`round-score-${roundIndex}-rounds`}
                                type="number"
                                className="input w-full"
                                placeholder="Rounds"
                                value={scoreParts[0] || ""}
                                onChange={(e) =>
                                  handleScoreChange(
                                    roundIndex,
                                    0,
                                    e.target.value
                                  )
                                }
                                name={`scores[${roundIndex}][0]`}
                                min="0"
                              />
                              <span className="text-gray-600">+</span>
                              <input
                                id={`round-score-${roundIndex}-reps`}
                                type="number"
                                className="input w-full"
                                placeholder={`Reps (max ${
                                  repsPerRoundValue
                                    ? repsPerRoundValue - 1
                                    : "N/A"
                                })`}
                                value={scoreParts[1] || ""}
                                onChange={(e) =>
                                  handleScoreChange(
                                    roundIndex,
                                    1,
                                    e.target.value
                                  )
                                }
                                name={`scores[${roundIndex}][1]`}
                                min="0"
                                max={
                                  repsPerRoundValue
                                    ? repsPerRoundValue - 1
                                    : undefined
                                }
                              />
                            </div>
                          ) : (
                            <input
                              id={`round-score-${roundIndex}`}
                              type={
                                currentWorkoutDetails?.scheme === "time"
                                  ? "text"
                                  : "number"
                              }
                              className="input w-full"
                              placeholder={
                                currentWorkoutDetails?.scheme === "time"
                                  ? "e.g. 3:21"
                                  : "Reps/Load"
                              }
                              value={scoreParts[0] || ""}
                              onChange={(e) =>
                                handleScoreChange(roundIndex, 0, e.target.value)
                              }
                              name={`scores[${roundIndex}][0]`}
                              min={
                                currentWorkoutDetails?.scheme !== "time"
                                  ? "0"
                                  : undefined
                              }
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div>
                    <label
                      htmlFor="log-notes"
                      className="mb-2 block font-bold uppercase"
                    >
                      Notes
                    </label>
                    <textarea
                      id="log-notes"
                      className="textarea"
                      rows={4}
                      placeholder="How did it feel? Any modifications?"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      name="notes"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center border-2 border-gray-300 border-dashed p-6">
                <p className="text-center text-gray-500">
                  Select a workout from the list to log a result
                </p>
              </div>
            )}
          </div>
        </div>
        {formError && (
          <div className="mt-4 border border-red-500 bg-red-100 p-4 text-red-700">
            <p>{formError}</p>
          </div>
        )}
        <div className="mt-6 flex justify-end gap-4">
          <Link href="/log" className="btn-outline">
            Cancel
          </Link>
          <button
            type="submit"
            className="btn"
            disabled={!selectedWorkout || isPending}
          >
            {isPending ? "Saving..." : "Save Result"}
          </button>
        </div>
      </div>
    </form>
  );
}
