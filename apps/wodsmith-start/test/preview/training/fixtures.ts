import type { TrainingContext, TrainingContent, TrainingSession, TrainingWeek, OwnTrainingResult, SaveTrainingDraftInput, SaveTrainingResultInput } from "@/lib/training/types"

export const context: TrainingContext = { userId: "athlete-zac", activeTeamId: "gym", teams: [{ id: "gym", name: "CrossFit Fullerton", timezone: "America/Los_Angeles", canProgram: true, tracks: [{ id: "everyday", name: "Everyday", description: "Our daily group training" }, { id: "compete", name: "Compete", description: "Additional competition training" }] }] }
const today = new Intl.DateTimeFormat("en-CA", { timeZone: context.teams[0].timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())
const content: TrainingContent = { title: "Strong legs. Steady pace.", coachNote: "Build through the squats, then settle into a pace you can hold. We’re looking for consistent rounds today.", isRestDay: false, blocks: [
  { id: "warmup", kind: "check", title: "Get moving", prescription: "3 easy rounds\n200 m row\n10 air squats\n8 alternating lunges", scalingGuidance: "", coachGuidance: "Move comfortably and open up your squat before adding weight." },
  { id: "strength", kind: "load", title: "Back squat", prescription: "5 sets × 3 reps\nBuild to a heavy, controlled triple.", scalingGuidance: "Use a box or goblet squat if it helps you keep your position.", coachGuidance: "Rest 2–3 minutes between sets. Record your heaviest completed set." },
  { id: "conditioning", kind: "time", title: "Keep your rhythm", prescription: "4 rounds for time\n400 m run\n15 wall balls · 20 / 14 lb\n12 kettlebell swings · 53 / 35 lb", scalingGuidance: "Scaled: 200 m run, 10 wall balls, 10 light kettlebell swings.", coachGuidance: "Aim for even rounds. Choose a wall-ball set you can repeat." },
  { id: "cooldown", kind: "check", title: "Bring it down", prescription: "2 minutes easy walk\n60 seconds couch stretch, each side", scalingGuidance: "", coachGuidance: "" },
] }
const initialSession: TrainingSession = { id: "session-today", teamId: "gym", trackId: "everyday", trainingDate: today, timezone: context.teams[0].timezone, revision: 2, publishedVersion: 1, draft: null, published: content }
function peer(id: string, userName: string, displayScore: string, scoreValue: number): OwnTrainingResult { return { id, userName, displayScore, scoreValue, userId: id, sessionId: initialSession.id, blockId: "conditioning", publishedVersion: 1, trainingDate: today, trackId: "everyday", block: content.blocks[2], scaling: "rx", modification: "", audience: "gym", unit: "lb", completed: true, cheerCount: 2, hasCheered: false, notes: "" } }
const key = "wodsmith-training-component-preview-v1"
const saved = localStorage.getItem(key)
const state: { sessions: TrainingSession[]; results: OwnTrainingResult[] } = saved ? JSON.parse(saved) : { sessions: [initialSession], results: [peer("maria", "Maria Chen", "16:42", 1002000), peer("james", "James Davis", "17:18", 1038000), peer("sam", "Sam Rivera", "18:06", 1086000)] }
const persist = () => localStorage.setItem(key, JSON.stringify(state))
const resultView = (result: OwnTrainingResult) => { const { notes: _notes, ...visible } = result; return visible }
export async function getTrainingWeekFn({data}: {data: {teamId: string; trackId: string; startDate: string; mode: "athlete" | "coach"}}): Promise<TrainingWeek> {
  const end = new Date(`${data.startDate}T12:00:00Z`); end.setUTCDate(end.getUTCDate() + 7)
  const sessions = state.sessions.filter(s => s.teamId === data.teamId && s.trackId === data.trackId && s.trainingDate >= data.startDate && s.trainingDate < end.toISOString().slice(0,10))
  const ids = new Set(sessions.map(s => s.id))
  return structuredClone({ sessions: sessions.map(s => ({ ...s, draft: data.mode === "coach" ? s.draft : null })), myResults: state.results.filter(r => ids.has(r.sessionId) && r.userId === context.userId), teamResults: state.results.filter(r => ids.has(r.sessionId) && r.audience === "gym" && sessions.some(s => s.id === r.sessionId && s.publishedVersion === r.publishedVersion)).map(resultView) })
}
export async function getTrainingHistoryFn({data}: {data: {teamId: string; trackId: string}}) { return structuredClone(state.results.filter(r => r.userId === context.userId && r.trackId === data.trackId)) }
export async function saveTrainingResultFn({data}: {data: SaveTrainingResultInput}): Promise<OwnTrainingResult> {
  const session = state.sessions.find(s => s.id === data.sessionId)!
  if (session.publishedVersion !== data.publishedVersion) throw new Error("This session has changed. Reload to see the published version.")
  const block = session.published!.blocks.find(b => b.id === data.blockId)!
  const existing = state.results.find(r => r.sessionId === data.sessionId && r.blockId === data.blockId && r.publishedVersion === data.publishedVersion && r.userId === context.userId)
  const time = data.score.split(":").reduce((n, part) => n * 60 + Number(part), 0) * 1000
  const result: OwnTrainingResult = {...data, id: existing?.id ?? crypto.randomUUID(), block, userId: context.userId, userName: "Zac Jones", trainingDate: session.trainingDate, trackId: session.trackId, scoreValue: block.kind === "time" ? time : block.kind === "load" ? Math.round(Number(data.score) * (data.unit === "lb" ? 453.59237 : 1000)) : Number(data.score), displayScore: data.score, cheerCount: existing?.cheerCount ?? 0, hasCheered: existing?.hasCheered ?? false }
  state.results = state.results.filter(r => r.id !== result.id).concat(result); persist(); return structuredClone(result)
}
export async function setTrainingCheerFn({data}: {data: {resultId: string; cheered: boolean}}) { const r = state.results.find(r => r.id === data.resultId)!; if (r.hasCheered !== data.cheered) r.cheerCount += data.cheered ? 1 : -1; r.hasCheered = data.cheered; persist(); return {success: true as const} }
export async function saveTrainingDraftFn({data}: {data: SaveTrainingDraftInput}): Promise<TrainingSession> {
  let s = state.sessions.find(s => s.teamId === data.teamId && s.trackId === data.trackId && s.trainingDate === data.trainingDate)
  if (s && s.revision !== data.expectedRevision) throw new Error("Another coach changed this session. Reload before saving.")
  if (!s) { s = {id: crypto.randomUUID(), ...data, revision: 0, publishedVersion: 0, draft: null, published: null}; state.sessions.push(s) }
  s.draft = structuredClone(data.content); s.timezone = data.timezone; s.revision++; persist(); return structuredClone(s)
}
export async function publishTrainingSessionFn({data}: {data: {sessionId: string; expectedRevision: number}}) { const s = state.sessions.find(s => s.id === data.sessionId)!; if (s.revision !== data.expectedRevision || !s.draft) throw new Error("Reload the saved draft before publishing."); s.published = s.draft; s.draft = null; s.revision++; s.publishedVersion++; persist(); return structuredClone(s) }
export async function copyTrainingSessionFn({data}: {data: {sessionId: string; targetDate: string; targetTrackId: string; expectedRevision: number}}) { const s = state.sessions.find(s => s.id === data.sessionId)!; if (state.sessions.some(t => t.teamId === s.teamId && t.trackId === data.targetTrackId && t.trainingDate === data.targetDate)) throw new Error("There is already a session on this day. Choose an empty day."); const draft = structuredClone(s.draft ?? s.published)!; draft.blocks.forEach(b => { b.id = crypto.randomUUID() }); const copy = {...s, id: crypto.randomUUID(), trackId: data.targetTrackId, trainingDate: data.targetDate, draft, published: null, publishedVersion: 0, revision: 1}; state.sessions.push(copy); persist(); return structuredClone(copy) }
