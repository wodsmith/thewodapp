import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import WorkoutControls from "./_components/WorkoutControls";
import { getUserWorkoutsAction } from "@/actions/workout-actions";
import { notFound, redirect } from "next/navigation";
import { requireVerifiedEmail } from "@/utils/auth";

export const metadata: Metadata = {
  metadataBase: new URL("https://spicywod.com"),
  title: "Spicy Wod | Explore Workouts",
  description: "Track your spicy workouts and progress.",
  openGraph: {
    title: "Spicy Wod | Explore Workouts", // Default title for layout
    description: "Track your spicy workouts and progress.", // Default description
    images: [
      {
        url: `/api/og?title=${encodeURIComponent(
          "Spicy Wod | Explore Workouts"
        )}`,
        width: 1200,
        height: 630,
        alt: "Spicy Wod | Explore Workouts",
      },
    ],
  },
};

export default async function WorkoutsPage({
  searchParams,
}: {
  searchParams?: Promise<{ search?: string; tag?: string; movement?: string }>;
}) {
  const session = await requireVerifiedEmail();

  if (!session || !session?.user?.id) {
    console.log("[workouts/page] No user found");
    redirect("/login");
  }

  const mySearchParams = await searchParams;
  const [result, error] = await getUserWorkoutsAction({
    userId: session.user.id,
  });

  if (error || !result?.success) {
    return notFound();
  }

  const allWorkouts = result.data;
  const searchTerm = mySearchParams?.search?.toLowerCase() || "";
  const selectedTag = mySearchParams?.tag || "";
  const selectedMovement = mySearchParams?.movement || "";
  const workouts = allWorkouts.filter((workout) => {
    const nameMatch = workout.name.toLowerCase().includes(searchTerm);
    const descriptionMatch = workout.description
      ?.toLowerCase()
      .includes(searchTerm);
    const movementSearchMatch = workout.movements.some((movement) =>
      movement?.name?.toLowerCase().includes(searchTerm)
    );
    const tagSearchMatch = workout.tags.some((tag) =>
      tag.name.toLowerCase().includes(searchTerm)
    );
    const searchFilterPassed = searchTerm
      ? nameMatch || descriptionMatch || movementSearchMatch || tagSearchMatch
      : true;
    const tagFilterPassed = selectedTag
      ? workout.tags.some((tag) => tag.name === selectedTag)
      : true;
    const movementFilterPassed = selectedMovement
      ? workout.movements.some(
          (movement) => movement?.name === selectedMovement
        )
      : true;
    return searchFilterPassed && tagFilterPassed && movementFilterPassed;
  });

  // Get today's date for filtering
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Normalize to start of day for comparison

  const todaysWorkouts = allWorkouts.filter((workout) => {
    if (!workout.createdAt) return false;
    const workoutDate = new Date(workout.createdAt);
    workoutDate.setHours(0, 0, 0, 0); // Normalize to start of day
    return workoutDate.getTime() === today.getTime();
  });

  // Extract unique tags and movements for filter dropdowns
  const allTags = [
    ...new Set(
      allWorkouts.flatMap((workout) => workout.tags.map((tag) => tag.name))
    ),
  ].sort() as string[];
  const allMovements = [
    ...new Set(
      allWorkouts.flatMap((workout) =>
        workout.movements.map((m) => m?.name).filter(Boolean)
      )
    ),
  ].sort() as string[];
  return (
    <div>
      <div className="mb-6 flex flex-col items-center justify-between sm:flex-row">
        <h1 className="mb-4">WORKOUTS</h1>
        <Link
          href="/workouts/new"
          className="btn flex w-fit items-center gap-2"
        >
          <Plus className="h-5 w-5" />
          Create Workout
        </Link>
      </div>

      {todaysWorkouts.length > 0 && (
        <div className="mb-12">
          <h2 className="mb-4 border-b pb-2 text-center font-bold text-2xl sm:text-left">
            Workout{todaysWorkouts.length > 1 ? "s" : ""} of the Day
          </h2>
          <div className="space-y-6">
            {todaysWorkouts.map((workout) => (
              <div key={workout.id} className="card p-6">
                <div className="flex flex-col items-start justify-between sm:flex-row">
                  <Link href={`/workouts/${workout.id}`}>
                    <h3 className="mb-2 font-semibold text-xl underline">
                      {workout.name}
                    </h3>
                  </Link>
                  <Link
                    href={{
                      pathname: "/log/new",
                      query: {
                        workoutId: workout.id,
                        redirectUrl: "/workouts",
                      },
                    }}
                    className="btn btn-primary btn-sm mb-2"
                  >
                    Log Result
                  </Link>
                </div>
                <p className="mb-1 text-muted-foreground text-sm">
                  Created:{" "}
                  {workout.createdAt
                    ? workout.createdAt.toLocaleDateString()
                    : "N/A"}
                </p>
                {workout.description && (
                  <p className="mb-4 whitespace-pre-wrap text-md">
                    {workout.description}
                  </p>
                )}
                {workout.movements && workout.movements.length > 0 && (
                  <div className="mb-4">
                    <h4 className="mb-1 font-semibold">Movements:</h4>
                    <div className="flex flex-wrap gap-2">
                      {workout.movements.map((movement) => (
                        <span
                          key={movement?.id || movement?.name}
                          className="inline-block bg-black px-2 py-1 font-bold text-white text-xs dark:bg-dark-foreground dark:text-dark-background"
                        >
                          {movement?.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Display Today's Results if any */}
                {workout.resultsToday && workout.resultsToday.length > 0 && (
                  <div className="mt-4 border-gray-200 border-t pt-4 dark:border-dark-border/50">
                    <h4 className="mb-2 font-semibold text-gray-600 text-sm uppercase dark:text-dark-muted-foreground">
                      Your Logged Result
                      {workout.resultsToday.length > 1 ? "s" : ""} for Today:
                    </h4>
                    <div className="space-y-3">
                      {workout.resultsToday.map((result) => (
                        <div
                          key={result.id}
                          className="w-fit rounded-md border border-gray-200 bg-gray-50 p-3 dark:border-dark-border dark:bg-dark-accent"
                        >
                          <div className="flex items-center justify-between gap-4">
                            <p className="font-bold text-foreground text-lg dark:text-dark-foreground">
                              {result.wodScore}
                            </p>
                            {result.scale && (
                              <span
                                className={`px-2 py-0.5 font-semibold text-xs ${
                                  result.scale === "rx"
                                    ? "bg-green-100 text-green-700 dark:bg-green-700 dark:text-green-100"
                                    : result.scale === "rx+"
                                    ? "bg-red-100 text-red-700 dark:bg-red-700 dark:text-red-100"
                                    : "bg-yellow-100 text-yellow-700 dark:bg-yellow-700 dark:text-yellow-100"
                                }`}
                              >
                                {result.scale.toUpperCase()}
                              </span>
                            )}
                          </div>
                          {result.notes && (
                            <p className="mt-1 text-gray-700 text-sm italic dark:text-dark-muted-foreground">
                              Notes: {result.notes}
                            </p>
                          )}
                          {/* Consider adding a link to view/edit the specific log entry if needed */}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* Optionally, add more details like tags if needed */}
              </div>
            ))}
          </div>
        </div>
      )}

      <WorkoutControls allTags={allTags} allMovements={allMovements} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {workouts.map((workout) => (
          <Link
            key={workout.id}
            href={`/workouts/${workout.id}`}
            className="card flex min-h-[300px] flex-col justify-between transition-colors hover:bg-gray-50 dark:hover:bg-dark-accent"
          >
            <div className="">
              <h3 className="mb-2">{workout.name}</h3>
              <p className="mb-3 line-clamp-6 whitespace-pre-wrap text-sm">
                {workout.description}
              </p>
            </div>
            <div>
              <div className="mb-3 flex flex-wrap gap-2">
                {workout.movements.map((movement) => (
                  <span
                    key={movement?.id || movement?.name}
                    className="inline-block bg-black px-2 py-1 font-bold text-white text-xs dark:bg-dark-foreground dark:text-dark-background"
                  >
                    {movement?.name}
                  </span>
                ))}
              </div>
              <div className="flex flex-wrap gap-1">
                {workout.tags.map((tag) => (
                  <span
                    key={tag.id}
                    className="inline-block border border-black px-2 py-1 text-xs dark:border-dark-border dark:text-dark-foreground"
                  >
                    {tag.name}
                  </span>
                ))}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
