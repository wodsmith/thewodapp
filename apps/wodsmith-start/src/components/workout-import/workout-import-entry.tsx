import { LockKeyhole, Sparkles } from "lucide-react"
import { useState } from "react"
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
            "AI Workout Import access required for this destination")
      }
    >
      {allowed ? (
        <Sparkles className="mr-2 h-4 w-4" aria-hidden="true" />
      ) : (
        <LockKeyhole className="mr-2 h-4 w-4" aria-hidden="true" />
      )}
      {access.loading
        ? "Checking AI access…"
        : allowed
          ? "Create with AI"
          : access.error
            ? "Retry AI access check"
            : "AI Workout Import access required"}
    </Button>
  )
}

export function WorkoutImportEntry(
  props: Omit<WorkoutImportPanelProps, "onClose">,
) {
  const [open, setOpen] = useState(false)
  const access = useWorkoutImportAccess(props.destination)
  const allowed = access.result?.hasAccess === true
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-auto max-w-full min-h-11 whitespace-normal text-left"
          disabled={access.loading || (!allowed && !access.error)}
          onClick={(event) => {
            if (!allowed) {
              event.preventDefault()
              void access.refresh()
            }
          }}
        >
          {allowed ? (
            <Sparkles className="mr-2 h-4 w-4" aria-hidden="true" />
          ) : (
            <LockKeyhole className="mr-2 h-4 w-4" aria-hidden="true" />
          )}
          {access.loading
            ? "Checking AI access…"
            : allowed
              ? "Create with AI"
              : access.error
                ? "Retry AI access check"
                : "AI Workout Import access required"}
        </Button>
      </DialogTrigger>
      <DialogContent
        className="flex max-h-[100dvh] w-full flex-col overflow-hidden sm:max-h-[90dvh] sm:max-w-3xl motion-reduce:animate-none"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Create with AI</DialogTitle>
          <DialogDescription>
            Paste a workout or upload a screenshot. Review the prescription and
            scoring before creating it.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 min-w-0 overflow-y-auto overscroll-contain px-1 pb-2">
          {open && (
            <WorkoutImportPanel
              key={workoutImportDestinationKey(props.destination)}
              {...props}
              onClose={() => setOpen(false)}
              onSaved={async (result) => {
                await props.onSaved(result)
                setOpen(false)
              }}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
