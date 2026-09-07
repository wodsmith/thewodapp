import { FileInput, LockKeyhole } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  useWorkoutImportAccess,
  workoutImportDestinationKey,
} from "@/hooks/use-workout-import"
import type { WorkoutImportDestination } from "@/lib/workout-import"
import {
  WorkoutImportPanel,
  type WorkoutImportPanelProps,
} from "./workout-import-panel"

export function WorkoutImportAccessButton({
  destination,
  onClick,
}: {
  destination: WorkoutImportDestination
  onClick: () => void
}) {
  const access = useWorkoutImportAccess(destination)
  const allowed = access.result?.hasAccess === true
  return (
    <Button
      type="button"
      variant="outline"
      className="h-auto max-w-full min-h-11 whitespace-normal text-left"
      disabled={access.loading || (!allowed && !access.error)}
      onClick={() => {
        if (!allowed) void access.refresh()
        else onClick()
      }}
      title={
        allowed
          ? undefined
          : (access.error ??
            "Workout import access required for this destination")
      }
    >
      {allowed ? (
        <FileInput className="mr-2 h-4 w-4" aria-hidden="true" />
      ) : (
        <LockKeyhole className="mr-2 h-4 w-4" aria-hidden="true" />
      )}
      {access.loading
        ? "Checking import access…"
        : allowed
          ? "Import workout"
          : access.error
            ? "Retry import access check"
            : "Workout import access required"}
    </Button>
  )
}

export function WorkoutImportEntry({
  disabled = false,
  onOpenChange,
  ...props
}: Omit<WorkoutImportPanelProps, "onClose" | "onSaved"> & {
  onSaved: (
    result: Parameters<WorkoutImportPanelProps["onSaved"]>[0],
    signal: AbortSignal,
  ) => Promise<void> | void
  disabled?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const [open, setOpen] = useState(false)
  const handoffController = useRef<AbortController | null>(null)
  useEffect(() => () => handoffController.current?.abort(), [])
  const panelSignal = handoffController.current?.signal
  function changeOpen(next: boolean) {
    handoffController.current?.abort()
    handoffController.current = next ? new AbortController() : null
    setHandoffError(null)
    setOpen(next)
  }
  const [handoffError, setHandoffError] = useState<string | null>(null)
  useEffect(() => {
    onOpenChange?.(open)
    return () => onOpenChange?.(false)
  }, [open, onOpenChange])
  const access = useWorkoutImportAccess(props.destination)
  const allowed = access.result?.hasAccess === true
  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-auto max-w-full min-h-11 whitespace-normal text-left"
          disabled={disabled || access.loading || (!allowed && !access.error)}
          onClick={(event) => {
            if (!allowed) {
              event.preventDefault()
              void access.refresh()
            }
          }}
        >
          {allowed ? (
            <FileInput className="mr-2 h-4 w-4" aria-hidden="true" />
          ) : (
            <LockKeyhole className="mr-2 h-4 w-4" aria-hidden="true" />
          )}
          {access.loading
            ? "Checking import access…"
            : allowed
              ? "Import workout"
              : access.error
                ? "Retry import access check"
                : "Workout import access required"}
        </Button>
      </DialogTrigger>
      <DialogContent
        className="flex max-h-[100dvh] w-full flex-col overflow-hidden sm:max-h-[90dvh] sm:max-w-3xl motion-reduce:animate-none"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Import workout</DialogTitle>
          <DialogDescription>
            Paste a workout or upload a screenshot. Review the prescription and
            scoring before creating it.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 min-w-0 overflow-y-auto overscroll-contain px-1 pb-2">
          {handoffError && (
            <p role="alert" className="mb-4 text-sm text-destructive">
              {handoffError}
            </p>
          )}
          {open && (
            <WorkoutImportPanel
              key={workoutImportDestinationKey(props.destination)}
              {...props}
              onClose={() => changeOpen(false)}
              onSaved={async (result) => {
                if (!panelSignal || panelSignal.aborted) {
                  throw new Error(
                    "The import was closed. Your workout is saved in the library; add it from there when ready.",
                  )
                }
                setHandoffError(null)
                try {
                  await props.onSaved(result, panelSignal)
                  if (!panelSignal.aborted) changeOpen(false)
                } catch (cause) {
                  if (!panelSignal.aborted)
                    setHandoffError(
                      cause instanceof Error
                        ? cause.message
                        : "Your workout is saved in the library, but could not be added here. Try again.",
                    )
                  throw cause
                }
              }}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
