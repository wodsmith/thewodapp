import type { PersonalTrainingDay, PersonalTrainingItem, PersonalTrainingSession, SavePersonalTrainingResultInput, SavePersonalTrainingSessionInput } from "@/lib/training/personal-types"
import type { OwnTrainingResult } from "@/lib/training/types"
import { context, getTrainingWeekFn } from "./fixtures"
const storageKey = "wodsmith-personal-session-preview-v1"
const stored = localStorage.getItem(storageKey)
const state: { defaultTrackId: string; sessions: PersonalTrainingSession[]; results: OwnTrainingResult[] } = stored ? JSON.parse(stored) : { defaultTrackId: "everyday", sessions: [], results: [] }
const persist = () => localStorage.setItem(storageKey, JSON.stringify(state))
export async function getPersonalTrainingDayFn({data}: {data:{teamId:string;trainingDate:string;trackId?:string}}): Promise<PersonalTrainingDay> {
 const trackId = data.trackId ?? state.defaultTrackId
 const week = await getTrainingWeekFn({data:{teamId:data.teamId,trackId,startDate:data.trainingDate,mode:"athlete"}})
 const sourceSession = week.sessions.find(item=>item.trainingDate===data.trainingDate) ?? null
 const personalSession = state.sessions.find(item=>item.teamId===data.teamId && item.trainingDate===data.trainingDate) ?? null
 return structuredClone({defaultTrackId:state.defaultTrackId,selectedTrackId:trackId,sourceSession,personalSession,items:personalSession?.items ?? sourceSession?.published?.blocks.map(block=>({id:`${sourceSession.id}_${block.id}`,kind:"source" as const,block,sourceSessionId:sourceSession.id,sourcePublishedVersion:sourceSession.publishedVersion,sourceBlockId:block.id,sourceTrainingDate:sourceSession.trainingDate,trackId,trackName:context.teams[0]?.tracks.find(item=>item.id===trackId)?.name ?? "Programming",sourceIsCurrent:true})) ?? [],results:[...week.myResults,...state.results.filter(item=>item.sessionId===personalSession?.id)],libraryResults:[]})
}
export async function saveTrainingPreferenceFn({data}:{data:{defaultTrackId:string}}) { state.defaultTrackId=data.defaultTrackId;persist() }
export async function savePersonalTrainingSessionFn({data}:{data:SavePersonalTrainingSessionInput}) {
 let session=state.sessions.find(item=>item.teamId===data.teamId&&item.trainingDate===data.trainingDate)
 if((session?.revision??0)!==data.expectedRevision)throw new Error("This session changed. Reload before saving.")
 const items:PersonalTrainingItem[]=[]
 for(const item of data.items) {
  if(item.kind==="personal")items.push(item)
  else if(item.kind==="library")items.push({...item,workout:await getTrainingLibraryWorkoutFn({data:{teamId:data.teamId,workoutId:item.workoutId}})})
  else {
   const previous=session?.items.find(entry=>entry.id===item.id)
   if(previous?.kind==="source"){items.push(previous);continue}
   let found:PersonalTrainingItem|undefined
   for(const track of context.teams[0]?.tracks??[]) { const day=await getPersonalTrainingDayFn({data:{teamId:data.teamId,trackId:track.id,trainingDate:data.trainingDate}});const source=day.sourceSession;if(source?.id===item.sourceSessionId){const block=source.published?.blocks.find(entry=>entry.id===item.sourceBlockId);if(block)found={...item,block,trackId:track.id,trackName:track.name,sourceTrainingDate:source.trainingDate,sourceIsCurrent:true}} }
   if(!found)throw new Error("Source programming is unavailable.")
   items.push(found)
  }
 }
 if(!session){session={id:crypto.randomUUID(),teamId:data.teamId,trainingDate:data.trainingDate,revision:0,items:[]};state.sessions.push(session)}
 session.items=items;session.revision++;persist();return structuredClone(session)
}
export async function savePersonalTrainingResultFn({data}:{data:SavePersonalTrainingResultInput}):Promise<OwnTrainingResult> { const session=state.sessions.find(item=>item.id===data.personalSessionId);const item=session?.items.find(item=>item.id===data.itemId);if(!session||!item||item.kind==="library")throw new Error("Workout missing.");if(session.revision!==data.expectedRevision)throw new Error("This session changed. Reload before saving.");const value=data.score.trim() ? item.block.kind === "time" ? data.score.split(":").reduce((total,part)=>total*60+Number(part),0)*1000 : item.block.kind === "load" ? Math.round(Number(data.score)*(data.unit==="lb"?453.59237:1000)) : Number(data.score) : null;const result:OwnTrainingResult={id:`personal-${item.id}`,sessionId:session.id,blockId:item.id,publishedVersion:1,userId:context.userId,userName:"Zac Jones",trainingDate:session.trainingDate,trackId:"",block:item.block,scoreValue:value,displayScore:data.score,scaling:"custom",modification:"",audience:"private",unit:data.unit,completed:data.completed,cheerCount:0,hasCheered:false,notes:data.notes};state.results=state.results.filter(entry=>entry.id!==result.id).concat(result);persist();return result }
export async function getPersonalTrainingHistoryFn(){return structuredClone(state.results)}
export async function getTrainingLibraryWorkoutFn(_input:{data:{teamId:string;workoutId:string}}){return {name:"Fran",description:"21-15-9\nThrusters\nPull-ups",scheme:"time"}}
export async function listTrainingLibraryWorkoutsFn(){return [{id:"fran",name:"Fran",description:"21-15-9\nThrusters\nPull-ups",scheme:"time"}]}
export async function getLogsByUserFn(){return {logs:[]}}

export { getTrainingWorkoutOptionsFn as getPersonalTrainingWorkoutOptionsFn } from "./fixtures"
