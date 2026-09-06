import { getAgentByName } from "agents"
import { chargeWorkoutImportBudget } from "@/agents/workout-import-agent"
import { workoutImportDestinationSchema } from "@/lib/workout-import"
import { getSessionFromRequestCookie } from "@/utils/auth"
import { requireWorkoutImportAccess, WorkoutImportAccessError } from "./access"
import { readBoundedBody, WorkoutImportRuntimeError } from "./limits"
import { WorkoutImportSessionExpiredError } from "./session-errors"
import {
  createWorkoutImportSession,
  loadOwnedWorkoutImportSession,
  requireWorkoutImportSession,
} from "./sessions"
import { normalizeImportImage, sourceKey } from "./source"

const privateHeaders = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "Cross-Origin-Resource-Policy": "same-origin",
}

export function assertImportOrigin(request: Request) {
  const origin = request.headers.get("origin")
  const isMutation =
    !["GET", "HEAD"].includes(request.method) ||
    request.headers.get("upgrade")?.toLowerCase() === "websocket"
  if (
    (isMutation && origin !== new URL(request.url).origin) ||
    (origin && origin !== new URL(request.url).origin) ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    throw new WorkoutImportRuntimeError("access_required", 403)
}

/** Recognize only the import namespace; all other app/agent traffic is untouched. */
export async function handleWorkoutImportRequest(
  request: Request,
  env: Env,
): Promise<Response | null> {
  const url = new URL(request.url)
  const api =
    /^\/api\/workout-import\/sessions(?:\/([a-z0-9_-]{1,128})(?:\/(source|cancel))?)?\/?$/.exec(
      url.pathname,
    )
  const agent = /^\/agents\/workout-import-agent\/([a-z0-9_-]{1,128})\/?$/.exec(
    url.pathname,
  )
  if (!api && !agent) {
    if (
      url.pathname.startsWith("/agents/workout-import-agent") ||
      url.pathname.startsWith("/api/workout-import/")
    )
      return new Response("Not found", { status: 404, headers: privateHeaders })
    return null
  }
  let stage = "origin"
  try {
    assertImportOrigin(request)
    stage = "authentication"
    const actor = await getSessionFromRequestCookie(request)
    if (!actor?.userId)
      return Response.json(
        { error: { code: "access_required" } },
        { status: 401, headers: privateHeaders },
      )
    const ns = env.WORKOUT_IMPORT_AGENT
    if (api && !api[1] && request.method === "POST") {
      stage = "input"
      const body = JSON.parse(
        new TextDecoder().decode(await readBoundedBody(request.body, 4096)),
      )
      const destination = workoutImportDestinationSchema.parse(body.destination)
      stage = "access"
      const scope = await requireWorkoutImportAccess({
        userId: actor.userId,
        destination,
      })
      stage = "budget"
      await chargeWorkoutImportBudget(
        env,
        scope.userId,
        scope.teamId,
        "session",
      )
      stage = "session-create"
      const session = await createWorkoutImportSession({
        userId: actor.userId,
        destination,
      })
      stage = "agent-allocate"
      const stub = await getAgentByName(ns, session.importId)
      stage = "agent-initialize"
      await stub.initialize(session)
      return Response.json(
        {
          importId: session.importId,
          agentName: session.importId,
          expiresAt: session.expiresAt,
        },
        { status: 201, headers: privateHeaders },
      )
    }
    const importId = agent?.[1] ?? api?.[1]
    if (!importId)
      return new Response("Method not allowed", {
        status: 405,
        headers: privateHeaders,
      })
    const cancelling = api?.[2] === "cancel"
    if (cancelling && request.method !== "POST")
      return new Response("Method not allowed", {
        status: 405,
        headers: { ...privateHeaders, Allow: "POST" },
      })
    // Check the DB before getAgentByName: guessed IDs cannot allocate durable objects.
    stage = "access"
    const session = await (cancelling
      ? loadOwnedWorkoutImportSession
      : requireWorkoutImportSession)({ userId: actor.userId, importId })
    stage = "agent-allocate"
    const stub = await getAgentByName(ns, importId)
    if (cancelling) {
      stage = "cancel"
      await stub.cancelOwned(actor.userId)
      return Response.json({ cancelled: true }, { headers: privateHeaders })
    }
    stage = "agent-initialize"
    await stub.initialize(session)
    if (agent) {
      stage = "socket"
      if (
        request.method !== "GET" ||
        request.headers.get("upgrade")?.toLowerCase() !== "websocket"
      )
        return new Response("Not found", {
          status: 404,
          headers: privateHeaders,
        })
      return stub.fetch(request)
    }
    if (api?.[2] === "source") {
      stage = "source"
      if (request.method === "PUT") {
        const image = await normalizeImportImage(
          request,
          env.WORKOUT_IMPORT_IMAGES,
        )
        await stub.storeSource(actor.userId, image)
        return Response.json(
          {
            imageId: importId,
            url: `/api/workout-import/sessions/${importId}/source`,
          },
          { headers: privateHeaders },
        )
      }
      if (request.method === "GET") {
        const object = await env.WORKOUT_IMPORT_SOURCES.get(sourceKey(importId))
        if (
          !object ||
          Number(object.customMetadata?.expiresAt ?? 0) <= Date.now()
        )
          throw new WorkoutImportRuntimeError("source_expired", 410)
        stage = "access"
        await requireWorkoutImportSession({ userId: actor.userId, importId })
        return new Response(object.body, {
          headers: {
            ...privateHeaders,
            "Content-Type": "image/png",
            "Content-Disposition": 'inline; filename="workout-source.png"',
          },
        })
      }
    } else if (request.method === "GET") {
      stage = "snapshot"
      return Response.json(await stub.snapshot(actor.userId), {
        headers: privateHeaders,
      })
    }
    return new Response("Method not allowed", {
      status: 405,
      headers: privateHeaders,
    })
  } catch (error) {
    // Never return provider, database, source, filename or raw schema errors.
    const safe =
      error instanceof WorkoutImportSessionExpiredError
        ? new WorkoutImportRuntimeError("source_expired", 410)
        : error instanceof WorkoutImportRuntimeError
          ? error
          : error instanceof WorkoutImportAccessError ||
              ["origin", "authentication", "access"].includes(stage)
            ? new WorkoutImportRuntimeError("access_required", 403)
            : stage === "input"
              ? new WorkoutImportRuntimeError("invalid_source", 400)
              : new WorkoutImportRuntimeError("provider_error", 500)
    // Log only fixed stages/codes; raw errors may contain source or credentials.
    if (safe.status >= 500)
      console.error("workout-import-request-failed", { stage, code: safe.code })
    return Response.json(
      { error: { code: safe.code } },
      {
        status: safe.status,
        headers: {
          ...privateHeaders,
          ...(safe.status === 429 ? { "Retry-After": "86400" } : {}),
        },
      },
    )
  }
}
