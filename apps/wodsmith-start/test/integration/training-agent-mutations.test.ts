import { createWodsmithDb, type WodsmithDb } from "@repo/wodsmith-db/mysql"
import { personalTrainingResultsTable, personalTrainingSessionsTable, programmingTracksTable, scoreRoundsTable, scheduledWorkoutInstancesTable, scoresTable, scalingGroupsTable, scalingLevelsTable, teamMembershipTable, teamTable, trainingCheersTable, trainingMutationReceiptsTable, trainingResultsTable, trainingSessionsTable, userTable, workoutMovements, workouts, workoutTags } from "@repo/wodsmith-db/schema"
import { eq } from "drizzle-orm"
import mysql from "mysql2"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { z } from "zod"
const state=vi.hoisted(()=>({db:null as unknown}))
vi.mock("@/db",()=>({getDb:()=>state.db}))
vi.mock("@/utils/auth",()=>({getSessionFromCookie:async()=>({userId:"agent_mutations_user"})}))
vi.mock("@tanstack/react-start",()=>({
  createServerFn:()=>({handler:(fn:unknown)=>fn,inputValidator:(parse:(value:unknown)=>unknown)=>({handler:(fn:(ctx:{data:unknown})=>unknown)=>(ctx:{data:unknown})=>fn({data:parse(ctx.data)})})}),
  createServerOnlyFn:(fn:unknown)=>fn,
}))
import {getWorkoutsFn,scheduleWorkoutFn} from "@/server-fns/workout-fns"
import { executeAgentOperation, listAgentOperations } from "@/server/training-agent"
import type { TrainingServiceDependencies } from "@/server/training-service-contract"

const databaseUrl=process.env.TRAINING_TEST_DATABASE_URL
const teamId="agent_mutations_team"
const userId="agent_mutations_user"
const scopes=["training:read","training:write","workouts:write","workouts:delete","results:write","results:delete","programming:read","programming:write","programming:publish"]
const workout={name:"Agent intervals",description:"3 rounds for reps",scheme:"reps",scope:"private",scoreType:"sum",roundsToScore:3,timeCapSeconds:null,repsPerRound:null,tiebreakScheme:null,scalingGroupId:"agent_scaling",movementIds:[]}
const block={id:"work",kind:"reps" as const,title:"Pull-ups",prescription:"30 pull-ups",coachGuidance:"",scalingGuidance:""}
const content={title:"Training",coachNote:"",isRestDay:false,blocks:[block]}
const workoutReply=z.object({workout:z.object({id:z.string()}),version:z.string(),receipt:z.object({id:z.string()})})
const resultReply=z.object({version:z.string(),saved:z.object({result:z.object({id:z.string()}),score:z.object({id:z.string()}).nullable()})})

describe.skipIf(!databaseUrl)("agent mutations on MySQL",()=>{
  let pool:ReturnType<typeof mysql.createPool>
  let db:WodsmithDb
  let deps:TrainingServiceDependencies
  let live=true
  const call=async(name:string,input:unknown,dependencies=deps)=>{
    const reply=await executeAgentOperation(dependencies,name,input)
    if(!reply.ok) throw new Error(`${reply.error.code}: ${reply.error.message}`)
    return reply.data
  }
  beforeAll(async()=>{
    if(!databaseUrl) throw new Error("Local training test database required")
    const url=new URL(databaseUrl)
    if(!["localhost","127.0.0.1","[::1]"].includes(url.hostname)||!/^\/training_test(?:_[a-f0-9]{32})?$/.test(url.pathname)) throw new Error("Disposable local training database required")
    pool=mysql.createPool(databaseUrl);db=createWodsmithDb(pool);state.db=db
    await db.insert(userTable).values([{id:userId,firstName:"Agent athlete"},{id:"agent_other",firstName:"Other"}])
    await db.insert(teamTable).values({id:teamId,name:"Personal library",slug:"agent-mutations",type:"personal",isPersonalTeam:true,personalTeamOwnerId:userId})
    await db.insert(teamMembershipTable).values([{id:"agent_owner_membership",userId,teamId,roleId:"owner",isSystemRole:true},{id:"agent_other_membership",userId:"agent_other",teamId,roleId:"member",isSystemRole:true}])
    await db.insert(scalingGroupsTable).values({id:"agent_scaling",title:"Agent scaling",isSystem:true})
    await db.insert(scalingLevelsTable).values({id:"agent_rx",scalingGroupId:"agent_scaling",label:"Rx",position:0})
    await db.insert(programmingTracksTable).values({id:"agent_track",name:"My programming",type:"team_owned",ownerTeamId:teamId})
  })
  beforeEach(async()=>{
    live=true
    deps={db,actor:{userId,grantId:"grant-one",clientId:"client-one",scopes,allowedTeamIds:[teamId]},hasFeature:async()=>true,authorizeActor:async executor=>{expect(executor).not.toBe(db);if(!live) throw new Error("FORBIDDEN: Grant revoked")}}
    await db.delete(scheduledWorkoutInstancesTable)
    await db.delete(trainingCheersTable)
    await db.delete(trainingResultsTable)
    await db.delete(personalTrainingResultsTable)
    await db.delete(personalTrainingSessionsTable)
    await db.delete(scoreRoundsTable)
    await db.delete(scoresTable)
    await db.delete(trainingMutationReceiptsTable)
    await db.delete(trainingSessionsTable)
    await db.delete(workoutMovements)
    await db.delete(workoutTags)
    await db.delete(workouts)
    await db.update(teamMembershipTable).set({isActive:true,roleId:"owner"}).where(eq(teamMembershipTable.id,"agent_owner_membership"))
    await db.insert(trainingSessionsTable).values({id:"agent_source",teamId,trackId:"agent_track",trainingDate:"2026-09-05",timezone:"UTC",publishedVersion:1,published:content})
  })
  afterAll(async()=>{
    await db.delete(scalingLevelsTable).where(eq(scalingLevelsTable.id,"agent_rx"))
    await db.delete(scalingGroupsTable).where(eq(scalingGroupsTable.id,"agent_scaling"))
    await pool?.promise().end()
  })

  // @lat: [[training-agent-services#Verification#Owned workout mutations]]
  it("creates once across concurrent retries, detects web edits and archives owned definitions",async()=>{
    const input={teamId,idempotencyKey:"create",workout}
    const [first,retry]=await Promise.all([call("create_workout",input),call("create_workout",input)])
    expect(retry).toEqual(first)
    const created=workoutReply.parse(first)
    expect(await db.select().from(workouts)).toHaveLength(1)
    await expect(call("create_workout",{...input,workout:{...workout,name:"Different"}})).rejects.toThrow("CONFLICT")
    const read=await call("get_workout",{teamId,workoutId:created.workout.id})
    expect(read.version).toBe(created.version)
    await db.update(workouts).set({description:"Changed by web"}).where(eq(workouts.id,created.workout.id))
    await expect(call("update_workout",{...input,idempotencyKey:"stale",workoutId:created.workout.id,expectedVersion:created.version})).rejects.toThrow("CONFLICT")
    const current=await call("get_workout",{teamId,workoutId:created.workout.id})
    const updated=workoutReply.parse(await call("update_workout",{...input,idempotencyKey:"update",workoutId:created.workout.id,expectedVersion:current.version,workout:{...workout,name:"Updated"}}))
    const remove={teamId,workoutId:created.workout.id,expectedVersion:updated.version,idempotencyKey:"delete"}
    expect(await call("delete_workout",remove)).toEqual(await call("delete_workout",remove))
    expect((await db.select().from(workouts))[0].archivedAt).not.toBeNull()
    await expect(call("get_workout",{teamId,workoutId:created.workout.id})).rejects.toThrow("FORBIDDEN")
  })

  // @lat: [[training-agent-services#Verification#Archive preserves concurrent references]]
  it("hides archived definitions from web selection and retains an in-flight scheduler's reference",async()=>{
    const created=workoutReply.parse(await call("create_workout",{teamId,idempotencyKey:"race-create",workout}))
    const selected=await getWorkoutsFn({data:{teamId,page:1,pageSize:20}})
    expect(selected.workouts.map(item=>item.id)).toContain(created.workout.id)
    // Deterministic legacy scheduler interleaving: read, archive, then insert.
    const [readBeforeArchive]=await db.select().from(workouts).where(eq(workouts.id,created.workout.id))
    await call("delete_workout",{teamId,idempotencyKey:"race-archive",workoutId:created.workout.id,expectedVersion:created.version})
    await db.insert(scheduledWorkoutInstancesTable).values({id:"archive-in-flight",teamId,workoutId:readBeforeArchive.id,scheduledDate:new Date("2026-09-05T12:00:00Z")})
    const joined=await db.select({workout:workouts}).from(scheduledWorkoutInstancesTable).innerJoin(workouts,eq(workouts.id,scheduledWorkoutInstancesTable.workoutId)).where(eq(scheduledWorkoutInstancesTable.id,"archive-in-flight"))
    expect(joined[0].workout.name).toBe(workout.name)
    expect((await getWorkoutsFn({data:{teamId,page:1,pageSize:20}})).workouts).toEqual([])
    await expect(scheduleWorkoutFn({data:{teamId,workoutId:created.workout.id,scheduledDate:"2026-09-06"}})).rejects.toThrow("unavailable")
  })

  // @lat: [[training-agent-services#Verification#Mutation authority and provenance]]
  it("revalidates live authority on receipt replay and preserves the first trusted client origin",async()=>{
    const input={teamId,idempotencyKey:"authority",workout}
    const first=await call("create_workout",input)
    expect(first).toMatchObject({receipt:{origin:{kind:"agent",clientId:"client-one",grantId:"grant-one"}}})
    expect(await call("create_workout",input,{...deps,actor:{...deps.actor,grantId:"grant-two",clientId:"client-two"}})).toEqual(first)
    live=false
    await expect(call("create_workout",input)).rejects.toThrow("Grant revoked")
    live=true
    await expect(call("create_workout",input,{...deps,authorizeActor:undefined})).rejects.toThrow("Live grant validation")
    await expect(call("create_workout",input,{...deps,actor:{...deps.actor,allowedTeamIds:[]}})).rejects.toThrow("outside the training grant")
    await expect(call("create_workout",input,{...deps,actor:{...deps.actor,userId:"agent_other"}})).rejects.toThrow("personal library")
    await db.update(teamMembershipTable).set({isActive:false}).where(eq(teamMembershipTable.id,"agent_owner_membership"))
    await expect(call("create_workout",input)).rejects.toThrow("FORBIDDEN")
    expect(await db.select().from(workouts)).toHaveLength(1)
  })

  // @lat: [[training-agent-services#Verification#Atomic mutation receipts]]
  it("rolls back the mutation if its durable receipt cannot be inserted",async()=>{
    await pool.promise().query("CREATE TRIGGER agent_receipt_failure BEFORE INSERT ON training_mutation_receipts FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'receipt failure'")
    try {await expect(call("create_workout",{teamId,idempotencyKey:"rollback",workout})).rejects.toThrow("UNAVAILABLE")}
    finally {await pool.promise().query("DROP TRIGGER agent_receipt_failure")}
    expect(await db.select().from(workouts)).toHaveLength(0)
    expect(await db.select().from(trainingMutationReceiptsTable)).toHaveLength(0)
  })

  // @lat: [[training-agent-services#Verification#Owned published results]]
  it("reads, revises and deletes only owned source results with stale web edit protection",async()=>{
    const entry={kind:"source",value:{sessionId:"agent_source",blockId:"work",publishedVersion:1,score:"30",scaling:"rx",modification:"",notes:"private note",audience:"private",unit:"lb",completed:true}}
    const created=resultReply.parse(await call("create_result",{teamId,idempotencyKey:"source",entry}))
    const target={kind:"source",sessionId:"agent_source",blockId:"work",publishedVersion:1}
    const read=await call("get_result",{teamId,target})
    expect(read.version).toBe(created.version)
    const foreign=await call("get_result",{teamId,target},{...deps,actor:{...deps.actor,userId:"agent_other"}})
    expect(foreign.saved).toBeNull()
    await db.update(trainingResultsTable).set({notes:"edited in web"}).where(eq(trainingResultsTable.id,created.saved.result.id))
    await expect(call("update_result",{teamId,idempotencyKey:"stale-result",entry,expectedVersion:created.version})).rejects.toThrow("CONFLICT")
    const refreshed=await call("get_result",{teamId,target})
    const updated=resultReply.parse(await call("update_result",{teamId,idempotencyKey:"update-result",entry:{...entry,value:{...entry.value,score:"31"}},expectedVersion:refreshed.version}))
    await db.insert(trainingCheersTable).values({resultId:created.saved.result.id,userId:"agent_other"})
    await call("delete_result",{teamId,idempotencyKey:"delete-result",target,expectedVersion:updated.version})
    expect(await db.select().from(trainingResultsTable)).toHaveLength(0)
    expect(await db.select().from(trainingCheersTable)).toHaveLength(0)
  })

  // @lat: [[training-agent-services#Verification#Owned library round lifecycle]]
  it("preserves library rounds through edits and removes only the owned attempt on deletion",async()=>{
    const created=workoutReply.parse(await call("create_workout",{teamId,idempotencyKey:"library",workout}))
    const entry={kind:"direct",value:{trainingDate:"2026-09-05",itemId:"attempt",workoutId:created.workout.id,score:"",asRx:true,roundScores:[{score:"10"},{score:"20"},{score:"30"}],notes:"private"}}
    const result=resultReply.parse(await call("create_result",{teamId,idempotencyKey:"rounds",entry}))
    expect(await db.select().from(scoreRoundsTable)).toHaveLength(3)
    const week=await call("get_training_week",{teamId,trackId:"agent_track",startDate:"2026-09-05"})
    expect(week).toMatchObject({personalDays:[expect.objectContaining({trainingDate:"2026-09-05",state:"projection",personalSession:expect.objectContaining({compositionState:"result_only"})}),...Array(6).fill(expect.anything())]})
    await call("delete_workout",{teamId,idempotencyKey:"archive-performed",workoutId:created.workout.id,expectedVersion:created.version})
    await expect(call("create_result",{teamId,idempotencyKey:"archived-new-attempt",entry:{...entry,value:{...entry.value,itemId:"new-attempt"}}})).rejects.toThrow("FORBIDDEN")
    const changed=resultReply.parse(await call("update_result",{teamId,idempotencyKey:"new-rounds",expectedVersion:result.version,entry:{...entry,value:{...entry.value,roundScores:[{score:"11"},{score:"22"},{score:"33"}]}}}))
    const [session]=await db.select().from(personalTrainingSessionsTable)
    expect(session.items).toEqual([])
    expect(session.compositionState).toBe("result_only")
    const target={kind:"direct",trainingDate:"2026-09-05",itemId:"attempt"}
    await call("delete_result",{teamId,idempotencyKey:"delete-rounds",target,expectedVersion:changed.version})
    expect(await db.select().from(scoresTable)).toHaveLength(0)
    expect(await db.select().from(scoreRoundsTable)).toHaveLength(0)
    expect(await db.select().from(personalTrainingResultsTable)).toHaveLength(0)
    expect((await db.select().from(personalTrainingSessionsTable))[0]).toEqual(session)
  })

  // @lat: [[training-agent-services#Verification#Archived composition snapshots]]
  it("preserves an archived workout in an existing day while excluding it from new selection",async()=>{
    const created=workoutReply.parse(await call("create_workout",{teamId,idempotencyKey:"planned-library",workout}))
    const item={id:"planned",kind:"library",workoutId:created.workout.id}
    const saved=await call("save_personal_training_day",{teamId,idempotencyKey:"planned-day",trainingDate:"2026-09-07",expectedRevision:0,items:[item]})
    const first=z.object({session:z.object({revision:z.number(),items:z.array(z.unknown())})}).parse(saved).session
    await call("delete_workout",{teamId,idempotencyKey:"archive-planned",workoutId:created.workout.id,expectedVersion:created.version})
    const edited=await call("save_personal_training_day",{teamId,idempotencyKey:"edit-planned",trainingDate:"2026-09-07",expectedRevision:first.revision,items:[{...item,role:"strength"}]})
    expect(edited).toMatchObject({session:{items:[{...first.items[0] as object,role:"strength"}]}})
  })

  // @lat: [[training-agent-services#Verification#Private day and programmer mutations]]
  it("separates personal composition, draft and publish scopes with replay-safe revisions",async()=>{
    const personal=await call("save_personal_training_day",{teamId,idempotencyKey:"day",trainingDate:"2026-09-06",expectedRevision:0,items:[{id:"personal",kind:"personal",block:{...block,id:"personal"}}]})
    expect(personal).toMatchObject({session:{revision:1}})
    const draft={teamId,idempotencyKey:"draft",trackId:"agent_track",trainingDate:"2026-09-06",timezone:"UTC",expectedRevision:0,content}
    const saved=await call("save_programming_draft",draft)
    const session=z.object({session:z.object({id:z.string(),revision:z.number()})}).parse(saved).session
    const publish={teamId,idempotencyKey:"publish",sessionId:session.id,expectedRevision:session.revision}
    await expect(call("publish_programming",publish,{...deps,actor:{...deps.actor,scopes:["programming:write"]}})).rejects.toThrow("programming:publish")
    const published=await call("publish_programming",publish)
    expect(published).toMatchObject({session:{publishedVersion:1}})
    expect(await call("publish_programming",publish)).toEqual(published)
    await db.update(teamMembershipTable).set({roleId:"member"}).where(eq(teamMembershipTable.id,"agent_owner_membership"))
    await expect(call("publish_programming",publish)).rejects.toThrow("FORBIDDEN")
  })

  // @lat: [[training-agent-services#Verification#Discoverable mutation contracts]]
  it("advertises only permitted executable operations with serializable canonical schemas",()=>{
    const reads=listAgentOperations({...deps.actor,scopes:["training:read"]})
    expect(reads.every(operation=>operation.annotations.readOnlyHint)).toBe(true)
    expect(reads.map(operation=>operation.name)).not.toContain("create_workout")
    expect(()=>listAgentOperations({userId,scopes:["training:read"]})).toThrow("Incomplete")
    expect(listAgentOperations(deps.actor).find(operation=>operation.name === "update_workout")?.annotations.destructiveHint).toBe(true)
    for(const operation of listAgentOperations(deps.actor)) expect(()=>JSON.stringify(operation)).not.toThrow()
  })
})
