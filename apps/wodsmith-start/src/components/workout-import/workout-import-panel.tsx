import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react"
import {
  cancelImportSession,
  createImportSession,
  getImportSnapshot,
  isWorkoutImportAccessError,
  uploadImportSource,
  useWorkoutImport,
  useWorkoutImportAccess,
  workoutImportDestinationKey,
  workoutImportError,
} from "@/hooks/use-workout-import"
import { trackEvent } from "@/lib/posthog"
import type {
  WorkoutImportDestination,
  WorkoutImportInput,
  WorkoutImportRevisionInput,
  WorkoutImportSaveInput,
  WorkoutImportSaveResult,
} from "@/lib/workout-import"
import type { WorkoutImportAgentState } from "@/lib/workout-import/transport"
import { getAllMovementsFn } from "@/server-fns/movement-fns"
import { saveWorkoutImportFn } from "@/server-fns/workout-import-fns"
import { WorkoutImportWorkspace } from "./workout-import-workspace"

interface ImportConnectionHandle {
  read: (input: WorkoutImportInput) => Promise<unknown>
  revise: (input: WorkoutImportRevisionInput) => Promise<unknown>
  cancel: () => Promise<unknown>
}
const ImportConnection = forwardRef<
  ImportConnectionHandle,
  {
    importId: string
    onAccessLost: () => void
    onState: (state: WorkoutImportAgentState | null) => void
    onConnectionError: (error: string | null) => void
    onReady: () => void
  }
>(function ImportConnection(props, ref) {
  const importer = useWorkoutImport(props.importId, props.onAccessLost)
  useImperativeHandle(ref, () => ({
    read: importer.read,
    revise: importer.revise,
    cancel: importer.cancel,
  }))
  useEffect(
    () => props.onState(importer.state),
    [importer.state, props.onState],
  )
  useEffect(
    () => props.onConnectionError(importer.connectionError),
    [importer.connectionError, props.onConnectionError],
  )
  useEffect(() => {
    if (importer.ready) props.onReady()
  }, [importer.ready, props.onReady])
  return null
})

const stageLabels: Record<WorkoutImportAgentState["status"], string> = {
  idle: "Paste a workout or upload a screenshot to begin.",
  reading: "Reading workout…",
  checking: "Checking scoring…",
  ready: "Workout proposal ready for review.",
  needs_input: "This workout needs your input.",
  failed: "Reading could not finish. Your edits are still here.",
  cancelled: "Reading cancelled.",
}
export interface WorkoutImportPanelProps {
  destination: WorkoutImportDestination
  saveLabel: string
  track?: { trackOrder: number; notes?: string }
  onSaved: (result: WorkoutImportSaveResult) => Promise<void> | void
  onClose: () => void
}

/** Parent keys by destination so requests cannot be carried into another team. */
export function WorkoutImportPanel(props: WorkoutImportPanelProps) {
  const access = useWorkoutImportAccess(props.destination, true)
  const [revoked, setRevoked] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [snapshot, setSnapshot] = useState<WorkoutImportAgentState | null>(null)
  const [stage, setStage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [sourceUrl, setSourceUrl] = useState<string>()
  const [movements, setMovements] = useState<
    Awaited<ReturnType<typeof getAllMovementsFn>>["movements"]
  >([])
  const connection = useRef<ImportConnectionHandle>(null)
  const waiting = useRef<(() => void) | null>(null)
  const operation = useRef(false)
  const trackedStage = useRef<string | null>(null)
  const startedAt = useRef<number | null>(null)
  const mounted = useRef(true)
  const restored = useRef(false)
  const allowed = access.result?.hasAccess === true && !revoked
  const actorId = access.result?.hasAccess ? access.result.scope.userId : ""
  const storageKey = `workout-import:${actorId}:${workoutImportDestinationKey(props.destination)}`
  const onAccessLost = useCallback(() => {
    setRevoked(true)
    setError("AI Workout Import access required for this destination.")
  }, [])
  const onReady = useCallback(() => {
    waiting.current?.()
    waiting.current = null
  }, [])
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  useEffect(() => {
    if (!allowed) return
    let cancelled = false
    void getAllMovementsFn()
      .then((result) => {
        if (!cancelled) setMovements(result.movements)
      })
      .catch(() => {
        if (!cancelled)
          setError(
            "The movement catalog could not load. Reopen import before reviewing movement matches.",
          )
      })
    return () => {
      cancelled = true
    }
  }, [allowed])
  useEffect(() => {
    if (!allowed || restored.current) return
    restored.current = true
    let cancelled = false
    const savedId = sessionStorage.getItem(storageKey)
    if (savedId)
      void getImportSnapshot(savedId)
        .then((state) => {
          if (cancelled) return
          setSessionId(savedId)
          setSnapshot(state)
          if (state.draft?.source.imageId)
            setSourceUrl(
              `/api/workout-import/sessions/${encodeURIComponent(savedId)}/source`,
            )
        })
        .catch((issue) => {
          if (cancelled) return
          if (isWorkoutImportAccessError(issue)) onAccessLost()
          else sessionStorage.removeItem(storageKey)
        })
    return () => {
      cancelled = true
      restored.current = false
    }
  }, [allowed, storageKey, onAccessLost])

  useEffect(() => {
    if (
      !snapshot ||
      !["ready", "needs_input", "failed"].includes(snapshot.status)
    )
      return
    const eventKey = `${snapshot.requestId}:${snapshot.status}`
    if (trackedStage.current === eventKey) return
    trackedStage.current = eventKey
    trackEvent(`workout_import_${snapshot.status}`, {
      destination: props.destination.kind,
      revision: snapshot.draft?.revision,
      issue_count: snapshot.draft?.unresolved.length ?? 0,
      duration_ms: startedAt.current
        ? Date.now() - startedAt.current
        : undefined,
    })
  }, [snapshot, props.destination.kind])

  const checkedOperation = async (work: () => Promise<void>) => {
    if (operation.current) return
    operation.current = true
    setError(null)
    try {
      const current = await access.refresh()
      if (!current.hasAccess) {
        onAccessLost()
        throw new Error("access_required")
      }
      await work()
    } catch (issue) {
      if (isWorkoutImportAccessError(issue)) onAccessLost()
      const message = workoutImportError(issue)
      setError(message)
      trackEvent("workout_import_failed", {
        destination: props.destination.kind,
        error_category: isWorkoutImportAccessError(issue)
          ? "access_required"
          : "request_failed",
      })
      throw new Error(message)
    } finally {
      operation.current = false
      setStage(null)
    }
  }
  const ensureSession = async () => {
    if (sessionId && connection.current) return sessionId
    const session = sessionId
      ? { importId: sessionId }
      : await createImportSession(props.destination)
    if (!mounted.current) throw new Error("connection_closed")
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        waiting.current = null
        reject(new Error("socket_timeout"))
      }, 15_000)
      waiting.current = () => {
        window.clearTimeout(timeout)
        resolve()
      }
      setSessionId(session.importId)
      sessionStorage.setItem(storageKey, session.importId)
    })
    return session.importId
  }
  const onSave = async (input: WorkoutImportSaveInput) => {
    await checkedOperation(async () => {
      const result = await saveWorkoutImportFn({ data: input })
      sessionStorage.removeItem(storageKey)
      trackEvent("workout_created", {
        workout_id: result.workoutId,
        workout_scheme: input.workout.scheme,
        workout_scope: input.workout.scope,
        import_source_type: snapshot?.draft?.source.imageId ? "image" : "text",
        import_destination: props.destination.kind,
      })
      await props.onSaved(result)
    })
  }
  const label = access.result?.hasAccess
    ? props.destination.kind === "track"
      ? `Add to ${access.result.trackName ?? "programming track"} · ${access.result.teamName}`
      : `Private workout · ${access.result.teamName}`
    : props.destination.kind === "track"
      ? "Programming track"
      : "Personal workout"
  return (
    <>
      {allowed && sessionId && (
        <ImportConnection
          ref={connection}
          importId={sessionId}
          onAccessLost={onAccessLost}
          onState={setSnapshot}
          onReady={onReady}
          onConnectionError={setConnectionError}
        />
      )}
      <WorkoutImportWorkspace
        destinationLabel={label}
        saveLabel={props.saveLabel}
        track={props.track}
        draft={snapshot?.draft ?? null}
        stage={
          stage ??
          (snapshot
            ? stageLabels[snapshot.status]
            : access.loading
              ? "Checking import access…"
              : stageLabels.idle)
        }
        busy={
          !!stage ||
          snapshot?.status === "reading" ||
          snapshot?.status === "checking"
        }
        accessRequired={!access.loading && !allowed}
        error={
          error ??
          connectionError ??
          (snapshot?.error ? workoutImportError(snapshot.error.code) : null)
        }
        sourceUrl={sourceUrl}
        movements={movements}
        scalingGroups={
          access.result?.hasAccess ? access.result.scalingGroups : []
        }
        onRead={(text, file, requestId) =>
          checkedOperation(async () => {
            setStage(file ? "Uploading image…" : "Starting import…")
            const importId = await ensureSession()
            if (!mounted.current || !connection.current)
              throw new Error("connection_closed")
            const image = file ? await uploadImportSource(importId, file) : null
            setSourceUrl(image?.url)
            startedAt.current = Date.now()
            trackEvent("workout_import_started", {
              source_type: file ? "image" : "text",
              destination: props.destination.kind,
            })
            setStage("Reading workout…")
            if (!connection.current) throw new Error("connection_lost")
            await connection.current.read({
              importId,
              requestId,
              expectedRevision: snapshot?.draft?.revision ?? 0,
              source: { text, ...(image ? { imageId: image.imageId } : {}) },
            })
          })
        }
        onRevise={(workout, instruction, requestId) =>
          checkedOperation(async () => {
            if (!sessionId || !snapshot?.draft || !connection.current)
              throw new Error("connection_lost")
            startedAt.current = Date.now()
            setStage("Reading your correction…")
            await connection.current.revise({
              importId: sessionId,
              requestId,
              expectedRevision: snapshot.draft.revision,
              workout,
              instruction,
            })
          })
        }
        onSave={onSave}
        onCancel={async () => {
          if (sessionId) await cancelImportSession(sessionId)
          sessionStorage.removeItem(storageKey)
          setSessionId(null)
          setSnapshot(null)
          setSourceUrl(undefined)
          setStage(null)
        }}
        onClose={props.onClose}
        onCheckAccess={() => {
          void access.refresh().then((result) => {
            if (result.hasAccess) {
              setRevoked(false)
              setError(null)
            }
          })
        }}
      />
    </>
  )
}
