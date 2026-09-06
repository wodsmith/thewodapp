import {
  Agent,
  type Connection,
  type ConnectionContext,
  callable,
  type FiberRecoveryContext,
  getAgentByName,
  getCurrentAgent,
} from "agents"
import { createWorkersLogger } from "evlog/workers"
import { getDb } from "@/db"
import { movements } from "@/db/schemas/workouts"
import {
  type WorkoutImportInput,
  type WorkoutImportRevisionInput,
  workoutImportDraftSchema,
  workoutImportInputSchema,
  workoutImportRevisionInputSchema,
} from "@/lib/workout-import"
import {
  initialWorkoutImportState,
  type WorkoutImportAgentState,
  type WorkoutImportRetryInput,
} from "@/lib/workout-import/transport"
import {
  inferWorkoutImport,
  WORKOUT_IMPORT_MODEL,
} from "@/server/workout-import/inference"
import {
  awaitImportResult,
  IMPORT_LIMITS,
  WorkoutImportRuntimeError,
} from "@/server/workout-import/limits"
import {
  cleanupWorkoutImportSession,
  loadOwnedWorkoutImportSession,
  publishWorkoutImportRevision,
  requireWorkoutImportSession,
} from "@/server/workout-import/sessions"
import { loadImportImage, sourceKey } from "@/server/workout-import/source"
import { getSessionFromRequestCookie } from "@/utils/auth"

interface SessionIdentity {
  userId: string
  importId: string
  expiresAt: string
}
interface SocketIdentity {
  userId: string
  cookie: string
}
type ImportJob =
  | { kind: "read"; input: WorkoutImportInput }
  | { kind: "revise"; input: WorkoutImportRevisionInput }

/** Execution only: the database owns scope, reviewed revisions and save receipts. */
export class WorkoutImportAgent extends Agent<Env, WorkoutImportAgentState> {
  initialState = initialWorkoutImportState
  private abortController: AbortController | null = null
  private accepting = false

  // SDK's initial/broadcast state sync is synchronous and cannot recheck grants.
  // Opt out completely; send standard state messages only via deliver() below.
  shouldSendProtocolMessages() {
    return false
  }
  validateStateChange(
    _state: WorkoutImportAgentState,
    source: Connection | "server",
  ) {
    if (source !== "server") throw new Error("State is server-owned")
  }

  /** Native Worker RPC only. Not decorated: never callable from the browser. */
  async initialize(identity: SessionIdentity) {
    const existing = await this.ctx.storage.get<SessionIdentity>("identity")
    if (existing) {
      if (
        existing.userId !== identity.userId ||
        existing.importId !== identity.importId
      )
        throw new Error("Session mismatch")
      return
    }
    await requireWorkoutImportSession({
      userId: identity.userId,
      importId: identity.importId,
    })
    await this.ctx.storage.put("identity", identity)
    await this.schedule(new Date(identity.expiresAt), "expireSource")
  }

  private async identity() {
    const identity = await this.ctx.storage.get<SessionIdentity>("identity")
    if (!identity) throw new WorkoutImportRuntimeError("access_required", 403)
    return identity
  }

  private async access() {
    const identity = await this.identity()
    try {
      return await requireWorkoutImportSession({
        userId: identity.userId,
        importId: identity.importId,
      })
    } catch {
      throw new WorkoutImportRuntimeError("access_required", 403)
    }
  }

  private async socketActor(connection?: Connection) {
    const socket = connection ?? getCurrentAgent().connection
    const stored = socket?.state as SocketIdentity | undefined
    if (!socket || !stored?.cookie)
      throw new WorkoutImportRuntimeError("access_required", 403)
    const session = await getSessionFromRequestCookie(
      new Request("https://session.internal", {
        headers: { cookie: stored.cookie },
      }),
    )
    const identity = await this.identity()
    if (
      !session?.userId ||
      session.userId !== stored.userId ||
      session.userId !== identity.userId
    )
      throw new WorkoutImportRuntimeError("access_required", 403)
    return session.userId
  }

  async onConnect(connection: Connection, context: ConnectionContext) {
    try {
      const session = await getSessionFromRequestCookie(context.request)
      const identity = await this.identity()
      if (!session?.userId || session.userId !== identity.userId)
        throw new Error("Unauthorized")
      connection.setState({
        userId: session.userId,
        cookie: context.request.headers.get("cookie") ?? "",
      })
      await this.deliver(connection)
    } catch {
      connection.close(4403, "access_required")
    }
  }

  async onRequest() {
    return new Response("Not found", { status: 404 })
  }

  private async deliver(connection?: Connection) {
    const connections = connection ? [connection] : [...this.getConnections()]
    for (const socket of connections) {
      try {
        await this.socketActor(socket)
        const session = await this.access()
        const state = { ...this.state, draft: session.draft }
        socket.send(JSON.stringify({ type: "cf_agent_state", state }))
      } catch {
        socket.close(4403, "access_required")
      }
    }
  }

  /** Native HTTP snapshot; caller identity originates from the authenticated Worker. */
  async snapshot(userId: string): Promise<WorkoutImportAgentState> {
    const identity = await this.identity()
    if (identity.userId !== userId)
      throw new WorkoutImportRuntimeError("access_required", 403)
    const session = await this.access()
    return { ...this.state, draft: session.draft }
  }

  /** Native Worker RPC serializes source replacement against run acceptance. */
  async storeSource(userId: string, image: Uint8Array) {
    if (this.accepting || this.state.status !== "idle")
      throw new WorkoutImportRuntimeError("busy", 409)
    this.accepting = true
    try {
      const session = await this.access()
      if (session.userId !== userId || session.revision !== 0)
        throw new WorkoutImportRuntimeError("access_required", 403)
      await this.env.WORKOUT_IMPORT_SOURCES.put(
        sourceKey(session.importId),
        image,
        {
          httpMetadata: { contentType: "image/png" },
          customMetadata: { expiresAt: String(Date.parse(session.expiresAt)) },
        },
      )
      await this.access()
    } finally {
      this.accepting = false
    }
  }

  @callable()
  async getSnapshot() {
    return this.snapshot(await this.socketActor())
  }

  @callable()
  async readWorkout(input: WorkoutImportInput) {
    await this.socketActor()
    return this.accept({
      kind: "read",
      input: workoutImportInputSchema.parse(input),
    })
  }

  @callable()
  async reviseWorkout(input: WorkoutImportRevisionInput) {
    await this.socketActor()
    return this.accept({
      kind: "revise",
      input: workoutImportRevisionInputSchema.parse(input),
    })
  }

  @callable()
  async retryWorkout(input: WorkoutImportRetryInput) {
    await this.socketActor()
    await this.access()
    const previous = await this.ctx.storage.get<ImportJob>("job")
    if (!previous || this.state.status !== "failed")
      throw new WorkoutImportRuntimeError("stale_revision", 409)
    const next = { ...previous, input: { ...previous.input, ...input } }
    return this.accept(
      next.kind === "read"
        ? { kind: "read", input: workoutImportInputSchema.parse(next.input) }
        : {
            kind: "revise",
            input: workoutImportRevisionInputSchema.parse(next.input),
          },
    )
  }

  private async accept(job: ImportJob) {
    if (
      this.accepting ||
      this.state.status === "reading" ||
      this.state.status === "checking"
    )
      throw new WorkoutImportRuntimeError("busy", 409)
    this.accepting = true
    let didAccept = false
    try {
      const session = await this.access()
      if (
        job.input.importId !== session.importId ||
        job.input.expectedRevision !== session.revision
      )
        throw new WorkoutImportRuntimeError("stale_revision", 409)
      if (
        job.kind === "read" &&
        (session.revision !== 0 ||
          (job.input.source.imageId &&
            job.input.source.imageId !== session.importId))
      )
        throw new WorkoutImportRuntimeError("invalid_source")
      if (job.kind === "revise" && !session.draft)
        throw new WorkoutImportRuntimeError("stale_revision", 409)
      const runId = crypto.randomUUID()
      await this.ctx.storage.put("job", job)
      this.setState({
        ...this.state,
        status: "reading",
        error: null,
        runId,
        requestId: job.input.requestId,
      })
      didAccept = true
      // Register durable acceptance before returning. The fiber's body persists
      // progress; interrupted inference is offered as Retry, never replayed blindly.
      let accepted!: () => void
      let rejected!: (error: unknown) => void
      const registered = new Promise<void>((resolve, reject) => {
        accepted = resolve
        rejected = reject
      })
      void this.runFiber("workout-import", async () => {
        accepted()
        await this.execute(job, runId)
      }).catch(rejected)
      await registered
      await this.deliver()
      return { runId, requestId: job.input.requestId }
    } catch (error) {
      if (didAccept && !this.abortController)
        this.setState({
          ...this.state,
          status: "failed",
          error: { code: "interrupted" },
        })
      throw error instanceof WorkoutImportRuntimeError
        ? error
        : new WorkoutImportRuntimeError("provider_error", 503)
    } finally {
      this.accepting = false
    }
  }

  private async execute(job: ImportJob, runId: string) {
    const controller = new AbortController()
    this.abortController = controller
    const timer = setTimeout(
      () => controller.abort("timeout"),
      IMPORT_LIMITS.timeoutMs,
    )
    const log = createWorkersLogger(
      new Request("https://workout-import.internal/run"),
    )
    log.set({ action: "workout_import", model: WORKOUT_IMPORT_MODEL, runId })
    const started = Date.now()
    try {
      const session = await this.access()
      const source =
        job.kind === "read" ? job.input.source : session.draft?.source
      if (!source) throw new WorkoutImportRuntimeError("source_expired", 410)
      const imageBase64 = source.imageId
        ? await loadImportImage(
            this.env.WORKOUT_IMPORT_SOURCES,
            session.importId,
          )
        : undefined
      await this.access()
      const catalog = await getDb()
        .select({ id: movements.id, name: movements.name })
        .from(movements)
        .limit(5000)
      const currentWorkout =
        job.kind === "revise" ? job.input.workout : undefined
      const proposal = await awaitImportResult(
        inferWorkoutImport({
          ai: this.env.AI,
          gatewayId: this.env.WORKOUT_IMPORT_GATEWAY,
          text: source.text,
          imageBase64,
          currentWorkout,
          instruction:
            job.kind === "revise" ? job.input.instruction : undefined,
          movements: catalog,
          signal: controller,
          checkAccess: () => this.access(),
          beforeDispatch: async () => {
            const scope = await this.access()
            if (this.state.runId !== runId || controller.signal.aborted)
              throw new WorkoutImportRuntimeError("cancelled")
            const count =
              ((await this.ctx.storage.get<number>("dispatches")) ?? 0) + 1
            if (count > IMPORT_LIMITS.dispatchesPerSession)
              throw new WorkoutImportRuntimeError("rate_limited", 429)
            await chargeWorkoutImportBudget(
              this.env,
              scope.userId,
              scope.teamId,
              "dispatch",
            )
            await this.ctx.storage.put("dispatches", count)
            log.set({ dispatches: count })
          },
          onUsage: (usage) => log.set({ usage }),
        }),
        controller,
      )
      if (controller.signal.aborted || this.state.runId !== runId) return
      await this.access()
      this.setState({ ...this.state, status: "checking" })
      await this.deliver()
      const changedFields = Object.keys(proposal.workout).filter(
        (key) =>
          JSON.stringify(
            proposal.workout[key as keyof typeof proposal.workout],
          ) !==
          JSON.stringify(
            currentWorkout?.[key as keyof typeof proposal.workout],
          ),
      ) as Array<keyof typeof proposal.workout>
      const draft = workoutImportDraftSchema.parse({
        ...proposal,
        schemaVersion: 1,
        importId: session.importId,
        revision: session.revision + 1,
        requestId: job.input.requestId,
        status: proposal.unresolved.length ? "needs_input" : "ready",
        source,
        changedFields,
      })
      if (controller.signal.aborted || this.state.runId !== runId) return
      await publishWorkoutImportRevision({
        userId: session.userId,
        importId: session.importId,
        expectedRevision: job.input.expectedRevision,
        proposal,
        source,
        requestId: job.input.requestId,
        changedFields,
      })
      if (controller.signal.aborted || this.state.runId !== runId) return
      await this.access()
      this.setState({ ...this.state, status: draft.status, draft, error: null })
      log.set({ outcome: draft.status, revision: draft.revision })
      await this.deliver()
    } catch (error) {
      if (this.state.runId !== runId || this.state.status === "cancelled")
        return
      const code = controller.signal.aborted
        ? "timeout"
        : error instanceof WorkoutImportRuntimeError
          ? error.code
          : "provider_error"
      this.setState({ ...this.state, status: "failed", error: { code } })
      log.set({ outcome: "failed", errorCode: code })
      await this.deliver()
    } finally {
      clearTimeout(timer)
      if (this.abortController === controller) this.abortController = null
      log.set({ durationMs: Date.now() - started })
      log.emit()
    }
  }

  async onFiberRecovered(context: FiberRecoveryContext) {
    if (context.name !== "workout-import") return
    try {
      const session = await this.access()
      // Publication may have committed before eviction; recover it without another model call.
      this.setState(
        session.draft?.requestId === this.state.requestId
          ? {
              ...this.state,
              status: session.draft.status,
              draft: session.draft,
              error: null,
            }
          : {
              ...this.state,
              status: "failed",
              draft: session.draft,
              error: { code: "interrupted" },
            },
      )
      await this.deliver()
    } catch {
      await this.expireSource()
    }
  }

  @callable()
  async cancel() {
    const userId = await this.socketActor()
    return this.cancelOwned(userId)
  }

  /** Native Worker RPC for HTTP cancellation after a revoked socket closes. */
  async cancelOwned(userId: string) {
    const identity = await this.identity()
    if (identity.userId !== userId)
      throw new WorkoutImportRuntimeError("access_required", 403)
    this.abortController?.abort("cancelled")
    this.setState({ ...initialWorkoutImportState, status: "cancelled" })
    await cleanupWorkoutImportSession({ userId, importId: identity.importId })
    await this.expireSource()
    return { cancelled: true }
  }

  async expireSource() {
    const identity = await this.ctx.storage.get<SessionIdentity>("identity")
    this.abortController?.abort("expired")
    this.setState({ ...initialWorkoutImportState, status: "cancelled" })
    if (identity) {
      await this.env.WORKOUT_IMPORT_SOURCES.delete(sourceKey(identity.importId))
      await cleanupWorkoutImportSession({
        userId: identity.userId,
        importId: identity.importId,
      })
    }
    await this.ctx.storage.delete("job")
    for (const connection of this.getConnections())
      connection.close(4403, "source_expired")
  }

  /** Successful-save cleanup preserves DB expiry/receipts for lost-response retries. */
  async purgeSaved(userId: string) {
    const identity = await this.identity()
    if (identity.userId !== userId)
      throw new WorkoutImportRuntimeError("access_required", 403)
    const session = await loadOwnedWorkoutImportSession({
      userId,
      importId: identity.importId,
    })
    if (session.userId !== userId || session.revision < 1 || session.draft)
      throw new WorkoutImportRuntimeError("access_required", 403)
    this.abortController?.abort("saved")
    this.setState({ ...initialWorkoutImportState, status: "cancelled" })
    await this.env.WORKOUT_IMPORT_SOURCES.delete(sourceKey(session.importId))
    await this.ctx.storage.delete("job")
    for (const socket of this.getConnections()) socket.close(1000, "saved")
  }

  /** Native RPC only, on non-routable budget instances of this namespace. */
  async chargeBudget(kind: "session" | "dispatch", limit: number) {
    const key = `budget:${kind}`
    const day = Math.floor(Date.now() / 86_400_000)
    await this.ctx.storage.transaction(async (tx) => {
      const saved = await tx.get<{ day: number; count: number }>(key)
      const count = saved?.day === day ? saved.count + 1 : 1
      if (count > limit)
        throw new WorkoutImportRuntimeError("rate_limited", 429)
      await tx.put(key, { day, count })
    })
  }
}

export async function chargeWorkoutImportBudget(
  env: Env,
  userId: string,
  teamId: string,
  kind: "session" | "dispatch",
) {
  const ns = env.WORKOUT_IMPORT_AGENT
  const actor = await getAgentByName(ns, `budget-actor-${userId}`)
  const team = await getAgentByName(ns, `budget-team-${teamId}`)
  await actor.chargeBudget(
    kind,
    kind === "session"
      ? IMPORT_LIMITS.actorDailySessions
      : IMPORT_LIMITS.actorDailyDispatches,
  )
  await team.chargeBudget(
    kind,
    kind === "session"
      ? IMPORT_LIMITS.teamDailySessions
      : IMPORT_LIMITS.teamDailyDispatches,
  )
}
