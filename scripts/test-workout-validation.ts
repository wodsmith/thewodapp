// Test the validation logic for the problematic workout
import { parseTimeScoreToSeconds, formatSecondsToTime } from "../src/lib/utils"

// Simulate the workout from production
const problemWorkout = {
  id: "workout_pwtf9kdcxqp157lgttav7ia7",
  name: "Sawtooth",
  scheme: "reps" as const,
  repsPerRound: null,
  roundsToScore: null,
  description: "Partner 15:00 Minute AMRAP..."
}

// Simulate form data
function createTestFormData() {
  const formData = new Map()
  formData.set("selectedWorkoutId", problemWorkout.id)
  formData.set("date", "2025-09-14")
  formData.set("scale", "rx")
  formData.set("notes", "Test note")
  formData.set("scores[0][0]", "150") // Total reps score
  return formData
}

// Test the parsing logic
function parseScoreEntries(formData: Map<string, string>): Array<{ parts: string[] }> {
  const parsedScoreEntries: Array<{ parts: string[] }> = []
  let roundIdx = 0

  while (formData.has(`scores[${roundIdx}][0]`)) {
    const parts: string[] = []
    let partIdx = 0
    while (formData.has(`scores[${roundIdx}][${partIdx}]`)) {
      parts.push(formData.get(`scores[${roundIdx}][${partIdx}]`) || "")
      partIdx++
    }
    if (parts.length > 0) {
      parsedScoreEntries.push({ parts })
    }
    roundIdx++
  }
  return parsedScoreEntries
}

// Test validation
function validateParsedScores(
  parsedScoreEntries: Array<{ parts: string[] }>,
  workoutScheme: string
): { error?: string } | undefined {
  const atLeastOneScorePartFilled = parsedScoreEntries.some((entry) =>
    entry.parts.some((part) => part.trim() !== "")
  )

  if (parsedScoreEntries.length === 0 || !atLeastOneScorePartFilled) {
    if (workoutScheme !== undefined) {
      console.error("No valid score parts provided for a workout that expects scores.")
      return {
        error: "At least one score input is required and must not be empty."
      }
    }
  }
  return undefined
}

// Test processing
function processScoreForRepsScheme(scoreStr: string, setNumber: number) {
  if (scoreStr === undefined || scoreStr.trim() === "") {
    return {
      error: `Score input for set ${setNumber} is missing for scheme 'reps'.`
    }
  }

  const numericScore = parseInt(scoreStr, 10)
  if (isNaN(numericScore)) {
    return {
      error: `Score for set ${setNumber} ('${scoreStr}') must be a valid number for scheme 'reps'.`
    }
  }

  if (numericScore < 0) {
    return {
      error: `Score for set ${setNumber} ('${numericScore}') cannot be negative.`
    }
  }

  return {
    setNumber,
    score: numericScore,
    reps: null,
    weight: null,
    status: null,
    distance: null,
    time: null
  }
}

// Run the test
console.log("Testing workout:", problemWorkout.name)
console.log("Scheme:", problemWorkout.scheme)
console.log("RepsPerRound:", problemWorkout.repsPerRound)
console.log("RoundsToScore:", problemWorkout.roundsToScore)
console.log("")

const formData = createTestFormData()
console.log("Form data:")
formData.forEach((value, key) => {
  console.log(`  ${key}: ${value}`)
})
console.log("")

// Parse scores
const parsedScores = parseScoreEntries(formData)
console.log("Parsed scores:", JSON.stringify(parsedScores, null, 2))
console.log("")

// Validate
const validationError = validateParsedScores(parsedScores, problemWorkout.scheme)
if (validationError) {
  console.error("VALIDATION ERROR:", validationError.error)
} else {
  console.log("✓ Validation passed")
}
console.log("")

// Process score
const isRoundsAndRepsWorkout = !!problemWorkout.repsPerRound && problemWorkout.repsPerRound > 0
console.log("Is rounds and reps workout:", isRoundsAndRepsWorkout)

if (!isRoundsAndRepsWorkout && problemWorkout.scheme === "reps") {
  console.log("Processing as simple reps scheme...")
  const scoreStr = parsedScores[0]?.parts[0]
  const result = processScoreForRepsScheme(scoreStr, 1)

  if ("error" in result) {
    console.error("PROCESSING ERROR:", result.error)
  } else {
    console.log("✓ Processing successful")
    console.log("Result:", result)
    console.log("WOD Score would be:", scoreStr)
  }
}