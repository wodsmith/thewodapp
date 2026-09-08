import type { TrainingSession } from "@/lib/training/types"
export const sessionSources = new Map<string, TrainingSession>()
export function previewSession(trackId: string, date: string): TrainingSession | null {
 if (!['everyday','recovery'].includes(trackId)) return null
 const blocks = trackId === 'everyday' ? [
  {id:'warmup',kind:'check' as const,title:'Everyday warm-up',prescription:'5 minutes easy rowing, then 2 rounds of 10 air squats and 5 inchworms.',coachGuidance:'Build intensity gradually.',scalingGuidance:''},
  {id:'strength',kind:'reps' as const,title:'Strict pull-ups',prescription:'Accumulate 30 quality reps. Rest as needed.',coachGuidance:'Leave one rep in reserve.',scalingGuidance:'Use assistance to keep full range.'},
 ] : [
  {id:'mobility',kind:'note' as const,title:'Shoulder warm-up',prescription:'3 rounds: 10 band pull-aparts and 30 seconds of hanging.',coachGuidance:'Stay within a comfortable range.',scalingGuidance:''},
  {id:'cooldown',kind:'check' as const,title:'Recovery cooldown',prescription:'Walk for 5 minutes, then stretch hips and calves for 2 minutes per side.',coachGuidance:'Breathe slowly.',scalingGuidance:''},
 ]
 const session: TrainingSession = {id:`preview-${trackId}-${date}`,teamId:'preview-personal',trackId,trainingDate:date,timezone:'America/Boise',revision:1,publishedVersion:1,draft:null,published:{title:trackId === 'everyday'?'Everyday training':'Recovery session',coachNote:'',isRestDay:false,blocks}}
 sessionSources.set(session.id,session)
 return session
}
