import { getDd } from "../src/db/index"
import { workouts, results } from "../src/db/schema"
import { eq } from "drizzle-orm"

async function testWorkoutLogging() {
  const db = getDd()

  // Create a test workout similar to the problematic one
  const testWorkoutId = "workout_test_reps_scheme"

  console.log("Creating test workout with reps scheme and null reps_per_round...")

  try {
    // First, delete if it exists
    await db.delete(workouts).where(eq(workouts.id, testWorkoutId))

    // Create the test workout
    await db.insert(workouts).values({
      id: testWorkoutId,
      name: "Test Reps Workout",
      description: "Test workout with reps scheme and null reps_per_round",
      scope: "private",
      scheme: "reps",
      repsPerRound: null,
      roundsToScore: null,
      teamId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    console.log("Test workout created successfully")

    // Fetch it back to verify
    const [workout] = await db
      .select()
      .from(workouts)
      .where(eq(workouts.id, testWorkoutId))
      .limit(1)

    if (!workout) {
      console.error("Failed to retrieve test workout")
      return
    }

    console.log("Retrieved workout:", {
      id: workout.id,
      name: workout.name,
      scheme: workout.scheme,
      repsPerRound: workout.repsPerRound,
      roundsToScore: workout.roundsToScore,
    })

    // Now test the logging process
    console.log("\nTesting log submission for this workout...")

    // Import the submitLogForm function
    const { submitLogForm } = await import("../src/server/logs")

    // Create test form data
    const formData = new FormData()
    const dateStr = new Date().toISOString().split("T")[0]
    if (!dateStr) {
      console.error("Failed to format date")
      return
    }
    formData.set("selectedWorkoutId", testWorkoutId)
    formData.set("date", dateStr)
    formData.set("scale", "rx")
    formData.set("notes", "Test log for reps scheme workout")
    formData.set("scores[0][0]", "100") // Single score value for reps

    try {
      const result = await submitLogForm(
        "user_test",
        [workout],
        formData
      )

      console.log("Log submission result:", result)

      if (result && "error" in result) {
        console.error("ERROR in submission:", result.error)
      } else {
        console.log("SUCCESS! Log submitted")

        // Check if it was saved
        const [savedResult] = await db
          .select()
          .from(results)
          .where(eq(results.workoutId, testWorkoutId))
          .limit(1)

        if (savedResult) {
          console.log("Verified: Result was saved to database")
          console.log("Result details:", {
            id: savedResult.id,
            workoutId: savedResult.workoutId,
            wodScore: savedResult.wodScore,
            scale: savedResult.scale,
          })
        }
      }
    } catch (error) {
      console.error("Error during log submission:", error)
    }

    // Clean up
    console.log("\nCleaning up test data...")
    await db.delete(results).where(eq(results.workoutId, testWorkoutId))
    await db.delete(workouts).where(eq(workouts.id, testWorkoutId))

  } catch (error) {
    console.error("Test failed:", error)
  }
}

testWorkoutLogging()
  .then(() => {
    console.log("\nTest completed")
    process.exit(0)
  })
  .catch((error) => {
    console.error("Test error:", error)
    process.exit(1)
  })