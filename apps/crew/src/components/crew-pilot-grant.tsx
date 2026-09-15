import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { type FormEvent, useId, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { grantCrewPilotAccessFn } from "@/server-fns/crew-billing-fns"

export function CrewPilotGrant({
  eventId,
  eventName,
  billingState,
  alreadyGranted,
}: {
  eventId: string
  eventName: string
  billingState: string
  alreadyGranted: boolean
}) {
  const router = useRouter()
  const grant = useServerFn(grantCrewPilotAccessFn)
  const reasonId = useId()
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const result = await grant({ data: { eventId, reason } })
      toast.success(
        result.status === "granted"
          ? "Free pilot access granted"
          : "Pilot grant already recorded",
      )
      await router.invalidate()
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not grant pilot access.",
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mt-6 space-y-3 border-t pt-4">
      <h4 className="font-semibold">Free pilot access</h4>
      {alreadyGranted ? (
        <p className="text-sm text-muted-foreground">
          A pilot grant has already been recorded for this event.
        </p>
      ) : billingState !== "unpaid" ? (
        <p className="text-sm text-muted-foreground">
          Pilot grants require an unpaid event. Resolve the current billing
          state before granting access.
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Give {eventName} free access to publish, share, and print its
            volunteer schedule.
          </p>
          <div className="space-y-1">
            <label htmlFor={reasonId} className="text-sm font-medium">
              Grant reason
            </label>
            <textarea
              id={reasonId}
              required
              minLength={3}
              maxLength={500}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="min-h-24 w-full rounded-md border bg-background p-2 text-sm"
              placeholder="Pilot organizer and agreed feedback"
            />
          </div>
          <Button type="submit" disabled={busy || reason.trim().length < 3}>
            {busy ? "Granting…" : "Grant free event access"}
          </Button>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </form>
      )}
    </section>
  )
}
