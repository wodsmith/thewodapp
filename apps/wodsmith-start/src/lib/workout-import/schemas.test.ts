import { describe, expect, it } from "vitest"
import { normalizedWorkoutSaveSchema, workoutImportProposalSchema, workoutSecondsToScoreMilliseconds } from "./schemas"

const cappedWorkout = {name:"Three rounds",description:"3 rounds for time; 15 minute cap; 10 pull-ups",scheme:"time-with-cap" as const,scoreType:null,timeCapSeconds:900,roundsToScore:1,repsPerRound:10,tiebreakScheme:"reps" as const,scalingGroupId:null,movementIds:["pull-up"],scope:"private" as const}
describe("workout import contract",()=>{
  // @lat: [[workout-import-contract#Workout import contract#Scoring boundary tests]]
  it("keeps prescription rounds separate and converts workout seconds explicitly",()=>{
    expect(normalizedWorkoutSaveSchema.parse(cappedWorkout)).toEqual(cappedWorkout)
    expect(workoutSecondsToScoreMilliseconds(720)).toBe(720000)
    expect(normalizedWorkoutSaveSchema.parse(cappedWorkout).roundsToScore).toBe(1)
  })
  it("blocks incomplete and inconsistent scoring",()=>{
    expect(normalizedWorkoutSaveSchema.safeParse({...cappedWorkout,timeCapSeconds:null}).success).toBe(false)
    expect(normalizedWorkoutSaveSchema.safeParse({...cappedWorkout,scheme:"rounds-reps"}).success).toBe(false)
    expect(normalizedWorkoutSaveSchema.safeParse({...cappedWorkout,roundsToScore:5}).success).toBe(false)
    expect(normalizedWorkoutSaveSchema.safeParse({...cappedWorkout,movementIds:["pull-up","pull-up"]}).success).toBe(false)
  })
  it("rejects model-provided ownership or visibility",()=>{
    const {scope,...workout}=cappedWorkout
    expect(workoutImportProposalSchema.safeParse({workout:{...workout,teamId:"other"},extractedText:"source",unresolved:[],warnings:[]}).success).toBe(false)
    expect(workoutImportProposalSchema.safeParse({workout:{...workout,scope},extractedText:"source",unresolved:[],warnings:[]}).success).toBe(false)
  })
})
