export * from "./personal-fixtures"
import { normalizePersonalLibraryScore } from "@/server/training-personal-scoring"
import { getTrainingLibraryWorkoutFn } from "./track-personal-fixtures"
type Attempt = { data: Record<string, any>; workout: any; result: ReturnType<typeof normalizePersonalLibraryScore> }
const key = "session-ux-score-attempts"
function read(): Record<string, Attempt> {return JSON.parse(sessionStorage.getItem(key) ?? "{}")}
export function previewAttempts(){return read()}
export async function getDirectLibraryEntryFn({data}: {data:any}) { return {workout: await getTrainingLibraryWorkoutFn({data}), levels:[{id:"rx",label:"Rx",position:0}]} }
export async function saveDirectLibraryResultFn({data}: {data:any}) {
 const attempts=read(); const workout=await getTrainingLibraryWorkoutFn({data}); const result=normalizePersonalLibraryScore(workout,data)
 attempts[data.itemId]={data,workout,result};sessionStorage.setItem(key,JSON.stringify(attempts));return {scoreId:data.itemId,success:true}
}
export async function getLogByIdFn({data}:{data:{id:string}}){
 const attempt=read()[data.id];if(!attempt)throw new Error("Log not found")
 const {data:values,workout,result}=attempt
 return {score:{id:data.id,...result,workoutId:workout.id,personalWorkout:workout,personalSessionId:"preview-results",personalItemId:data.id,personalRevision:1,personalTrainingDate:values.trainingDate,teamId:values.teamId,date:`${values.trainingDate}T00:00:00Z`,personalUnit:values.unit,asRx:values.asRx,notes:values.notes,scalingLevelId:"rx"}}
}
export async function getPersonalLibraryScalingLevelsFn(){return {levels:[{id:"rx",label:"Rx",position:0}]}}
export const getScalingLevelsFn=getPersonalLibraryScalingLevelsFn
export async function getScoreRoundsFn({data}:{data:{scoreId:string}}){return {rounds:read()[data.scoreId]?.result.rounds ?? []}}
export async function savePersonalLibraryResultFn({data}:{data:any}) {const previous=read()[data.itemId];return saveDirectLibraryResultFn({data:{...previous.data,...data}})}
export async function updateLogFn(){throw new Error("Legacy writes are outside this preview")}
export async function getWorkoutByIdFn(){throw new Error("Private edit should use its saved snapshot")}
