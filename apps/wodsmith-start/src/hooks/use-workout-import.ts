import { useAgent } from "agents/react"
import { useCallback, useEffect, useRef, useState } from "react"
import type {
  WorkoutImportDestination,
  WorkoutImportInput,
  WorkoutImportRevisionInput,
} from "@/lib/workout-import"
import type {
  WorkoutImportAgentState,
  WorkoutImportSessionResponse,
  WorkoutImportSourceResponse,
} from "@/lib/workout-import/transport"
import { getWorkoutImportAccessFn } from "@/server-fns/workout-import-fns"

export function workoutImportDestinationKey(
  destination: WorkoutImportDestination,
) {
  return destination.kind === "personal"
    ? "personal"
    : `track:${destination.trackId}`
}

export function workoutImportError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  if (
    /access[_ ]required|not authenticated|entitlement|4403|unauthorized|forbidden/i.test(
      message,
    )
  )
    return "AI Workout Import access required for this destination. Check access again to continue."
  if (/rate_limit|quota|budget|limit_exceeded/i.test(message))
    return "The import limit has been reached. Keep your source and try again later."
  if (/expired|source_missing|not_found/i.test(message))
    return "This import source has expired or is unavailable. Upload the image again or paste the source text."
  if (/timeout|provider|model/i.test(message))
    return "The AI provider could not finish reading. Your edits are safe; try reading again."
  if (/question|allowed answer|workout field/i.test(message))
    return "Check each answer and make the matching correction in the workout fields before saving."
  if (/movement|scaling group/i.test(message))
    return "A movement or scaling group is unavailable. Choose an available catalog entry or remove it before saving."
  if (/already saved/i.test(message))
    return "This import has already been saved. Return to your workout library before creating another workout."
  if (/stale|revision|conflict/i.test(message))
    return "This import changed in another session. Close and reopen it to review the latest proposal before saving."
  if (/image|upload|content.type|size/i.test(message))
    return "The image could not be uploaded. Choose a PNG, JPEG, or WebP up to 10 MiB and try again."
  if (/network|fetch|disconnect|socket|connection/i.test(message))
    return "Connection lost. Your local edits are safe. Reconnect before retrying; an uncertain save can be retried safely."
  return "The import could not finish. Your local edits are safe. Check the workout and try again."
}

export function isWorkoutImportAccessError(error: unknown): boolean {
  return /access[_ ]required|not authenticated|entitlement|4403|unauthorized|forbidden/i.test(
    error instanceof Error ? error.message : String(error),
  )
}

export function useWorkoutImportAccess(
  destination: WorkoutImportDestination,
  active = false,
) {
  const key = workoutImportDestinationKey(destination)
  type Result = Awaited<ReturnType<typeof getWorkoutImportAccessFn>>
  const [state, setState] = useState<{
    key: string
    result: Result | null
    loading: boolean
  }>({ key, result: null, loading: true })
  const currentKey = useRef(key)
  currentKey.current = key
  const destinationRef = useRef(destination)
  destinationRef.current = destination
  const refresh = useCallback(async () => {
    const requestedKey = currentKey.current
    try {
      const result = await getWorkoutImportAccessFn({
        data: { destination: destinationRef.current },
      })
      if (currentKey.current === requestedKey)
        setState({ key: requestedKey, result, loading: false })
      return result
    } catch {
      if (currentKey.current === requestedKey)
        setState({
          key: requestedKey,
          result: { hasAccess: false },
          loading: false,
        })
      return { hasAccess: false } as const
    }
  }, [])
  useEffect(() => {
    void key
    void refresh()
  }, [key, refresh])
  useEffect(() => {
    if (!active) return
    const onFocus = () => void refresh()
    window.addEventListener("focus", onFocus)
    const timer = window.setInterval(onFocus, 30_000)
    return () => {
      window.removeEventListener("focus", onFocus)
      window.clearInterval(timer)
    }
  }, [active, refresh])
  const result = state.key === key ? state.result : null
  return { result, loading: state.key !== key || state.loading, refresh }
}

async function importRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, credentials: "same-origin" })
  if (!response.ok) {
    let code = `HTTP ${response.status}`
    try {
      const body = (await response.json()) as {
        code?: string
        error?: { code?: string } | string
      }
      code =
        body.code ??
        (typeof body.error === "string" ? body.error : body.error?.code) ??
        code
    } catch {
      /* A failed upstream may not return JSON. */
    }
    if (response.status === 401 || response.status === 403)
      code = "access_required"
    throw new Error(code)
  }
  return response.json() as Promise<T>
}

export function createImportSession(destination: WorkoutImportDestination) {
  return importRequest<WorkoutImportSessionResponse>(
    "/api/workout-import/sessions",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ destination }),
    },
  )
}
export function uploadImportSource(importId: string, file: File) {
  return importRequest<WorkoutImportSourceResponse>(
    `/api/workout-import/sessions/${encodeURIComponent(importId)}/source`,
    { method: "PUT", headers: { "Content-Type": file.type }, body: file },
  )
}

export function cancelImportSession(importId: string) {
  return importRequest<unknown>(
    `/api/workout-import/sessions/${encodeURIComponent(importId)}/cancel`,
    { method: "POST" },
  )
}

export function getImportSnapshot(importId: string) {
  return importRequest<WorkoutImportAgentState>(
    `/api/workout-import/sessions/${encodeURIComponent(importId)}`,
  )
}

/** Mounted only after a destination access check and server-created session. */
export function useWorkoutImport(importId: string, onAccessLost: () => void) {
  const [snapshot, setSnapshot] = useState<WorkoutImportAgentState | null>(null)
  const [ready, setReady] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const agent = useAgent<WorkoutImportAgentState>({
    agent: "workout-import-agent",
    name: importId,
    onStateUpdate(state) {
      setSnapshot(state)
      if (state.error?.code === "access_required") onAccessLost()
    },
    onClose(event) {
      setReady(false)
      if (event.code === 4403) onAccessLost()
      else setConnectionError("Connection lost. Reconnecting to your import…")
    },
    onOpen() {
      setReady(true)
      setConnectionError(null)
    },
  })
  useEffect(() => {
    let cancelled = false
    void getImportSnapshot(importId)
      .then((state) => {
        if (!cancelled) setSnapshot(state)
      })
      .catch((error) => {
        if (cancelled) return
        if (isWorkoutImportAccessError(error)) onAccessLost()
        setConnectionError(workoutImportError(error))
      })
    return () => {
      cancelled = true
    }
  }, [importId, onAccessLost])
  const read = (input: WorkoutImportInput) => agent.call("readWorkout", [input])
  const revise = (input: WorkoutImportRevisionInput) =>
    agent.call("reviseWorkout", [input])
  return {
    ready,
    state: agent.state ?? snapshot,
    read,
    revise,
    cancel: () => agent.call("cancel", []),
    connectionError,
  }
}
