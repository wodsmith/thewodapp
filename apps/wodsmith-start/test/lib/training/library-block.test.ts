import { expect, it } from "vitest"
import { libraryWorkoutToBlock, type LibraryBlockSource } from "@/lib/training/library-block"
const source:LibraryBlockSource={name:"Fran",description:"21-15-9 thrusters and pull-ups",scheme:"time",scoreType:"min",roundsToScore:1,timeCap:null,repsPerRound:null,tiebreakScheme:null}
it("copies a complete workout definition into an independent session section",()=>{
  expect(libraryWorkoutToBlock({...source,scheme:"time-with-cap",timeCap:600,roundsToScore:3,scoreType:"sum",tiebreakScheme:"reps",movementIds:["thruster"]},"independent")).toMatchObject({id:"independent",kind:"workout",workout:{scheme:"time-with-cap",timeCapSeconds:600,roundsToScore:3,scoreType:"sum",tiebreakScheme:"reps",movementIds:["thruster"]}})
})
it("rejects malformed source metadata instead of dropping its scoring fields",()=>{
  expect(()=>libraryWorkoutToBlock({...source,scheme:"time-with-cap"},"invalid")).toThrow()
  expect(()=>libraryWorkoutToBlock({...source,roundsToScore:3,scoreType:null},"invalid")).toThrow()
})
// @lat: [[training#Workout Library#Library text limits]]
it("accepts canonical workout text limits and rejects oversized imports",()=>{
  expect(libraryWorkoutToBlock({...source,name:"n".repeat(255),description:"d".repeat(20000)},"fits")).toMatchObject({id:"fits"})
  expect(()=>libraryWorkoutToBlock({...source,name:"n".repeat(256)},"long-title")).toThrow()
  expect(()=>libraryWorkoutToBlock({...source,description:"d".repeat(20001)},"long-prescription")).toThrow()
})
