import { describe, expect, it } from "vitest"
import { libraryWorkoutToBlock, type LibraryBlockSource } from "@/lib/training/library-block"
const source: LibraryBlockSource = { name: "Fran", description: "21-15-9 thrusters and pull-ups", scheme: "time", scoreType: "min", roundsToScore: 1, timeCap: null, repsPerRound: null, tiebreakScheme: null }
describe("workout library composer compatibility", () => {
  it("copies a supported prescription into an independent section", () => {
    expect(libraryWorkoutToBlock(source, "independent")).toEqual({ id: "independent", kind: "time", title: source.name, prescription: source.description, scalingGuidance: "", coachGuidance: "" })
  })
  it.each([{scheme:"rounds-reps"}, {roundsToScore:3}, {timeCap:600}, {repsPerRound:30}, {tiebreakScheme:"reps"}, {scoreType:"max"}, {scoreType:"sum"}])("rejects scoring metadata that would lose its meaning: %s", (extra) => {
    expect(()=>libraryWorkoutToBlock({...source,...extra},"new")).toThrow("cannot preserve")
  })
})

// @lat: [[training#Workout Library#Library text limits]]
it("accepts the text limits and rejects oversized imports before they enter a draft", () => {
  expect(libraryWorkoutToBlock({...source, name:"n".repeat(160), description:"d".repeat(6000)}, "fits")).toMatchObject({id:"fits"})
  expect(() => libraryWorkoutToBlock({...source,name:"n".repeat(161)}, "long-title")).toThrow("160 characters")
  expect(() => libraryWorkoutToBlock({...source,description:"d".repeat(6001)}, "long-prescription")).toThrow("6,000 characters")
})
