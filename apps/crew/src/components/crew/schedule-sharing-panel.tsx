import { Link } from "@tanstack/react-router"
import { Check, Copy, ExternalLink, Send } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { CrewPublicScheduleView } from "@/components/crew/public-schedule-view"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  getCrewPublishedScheduleManagerFn,
  publishCrewScheduleFn,
  unpublishCrewScheduleFn,
} from "@/server-fns/crew-published-schedule-fns"

type ManagerData = Awaited<ReturnType<typeof getCrewPublishedScheduleManagerFn>>

// @lat: [[crew#Published Volunteer Schedule]]
export function CrewScheduleSharingPanel({
  initialData,
}: {
  initialData: ManagerData
}) {
  const [data, setData] = useState(initialData)
  const [busy, setBusy] = useState<"publish" | "unpublish" | "refresh" | null>(
    null,
  )
  const [copied, setCopied] = useState<"link" | "message" | null>(null)
  const [view, setView] = useState<"draft" | "published">("draft")
  const [origin, setOrigin] = useState("")
  useEffect(() => setOrigin(window.location.origin), [])
  const shareUrl = origin
    ? new URL(data.sharePath, origin).href
    : data.sharePath
  const visibleSchedule =
    view === "published" && data.published ? data.published : data.preview

  async function updatePublication(
    action: "publish" | "unpublish" | "refresh",
  ) {
    setBusy(action)
    try {
      const operation =
        action === "publish"
          ? publishCrewScheduleFn
          : action === "unpublish"
            ? unpublishCrewScheduleFn
            : getCrewPublishedScheduleManagerFn
      const result = await operation({ data: { eventId: data.event.id } })
      setData(result)
      if (action === "unpublish") setView("draft")
      toast.success(
        action === "publish"
          ? "Schedule published. Your link is ready to share."
          : action === "unpublish"
            ? "Schedule taken offline. You can publish it again when ready."
            : "Preview refreshed.",
      )
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not update the schedule. Please try again.",
      )
    } finally {
      setBusy(null)
    }
  }

  async function copy(kind: "link" | "message") {
    const message = `The volunteer schedule for ${data.event.name} is ready.\n\nFind your name to see your shifts, locations, and judge assignments. No login needed:\n${shareUrl}\n\nKeep this link handy for updates. Please contact your competition organizer if anything looks wrong.\n\nPowered by WODsmith Crew.`
    try {
      await navigator.clipboard.writeText(kind === "link" ? shareUrl : message)
      setCopied(kind)
      toast.success(
        kind === "link" ? "Schedule link copied" : "Volunteer message copied",
      )
    } catch {
      toast.error(
        "Copy isn’t available in this browser. Select and copy the link below.",
      )
    }
  }

  return (
    <section className="space-y-7">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold">Schedule</h2>
          <p className="max-w-xl text-sm text-muted-foreground">
            Review each volunteer’s shifts and judge assignments, then publish a
            link for your crew.
          </p>
        </div>
        <Button asChild variant="outline" className="min-h-11">
          <Link
            to="/events/$eventId/exports"
            params={{ eventId: data.event.id }}
            search={{ tab: "schedule" }}
          >
            Print or download
          </Link>
        </Button>
      </header>

      <section
        aria-label="Schedule publishing"
        className="space-y-5 rounded-lg border p-5"
      >
        <div className="space-y-2">
          <h3 className="font-semibold">
            {data.published
              ? !data.hasAccess
                ? "Your published link is unavailable"
                : data.draftChanged
                  ? "You have unpublished changes"
                  : "Your schedule is published"
              : "Your schedule is a draft"}
          </h3>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {data.published
              ? !data.hasAccess
                ? "Event access is inactive. Restore access to make this version available, or unpublish it below."
                : "Volunteers see the last version you published. Publish again when your changes are ready."
              : "Publish when you’re ready for volunteers to see their assignments. You can keep editing before then."}
          </p>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Anyone with the published link can look up names and assignments.
            Contact details and private notes are excluded.
          </p>
        </div>
        {data.hasAccess ? (
          <div className="flex flex-wrap gap-3">
            <Button
              className="min-h-11"
              disabled={
                busy !== null ||
                !data.preview ||
                (Boolean(data.published) && !data.draftChanged)
              }
              onClick={() => void updatePublication("publish")}
            >
              <Send />
              {busy === "publish"
                ? "Publishing…"
                : data.published
                  ? "Publish changes"
                  : "Publish schedule"}
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <Button asChild className="min-h-11">
              <Link
                to="/events/$eventId/billing"
                params={{ eventId: data.event.id }}
                search={{ crew_checkout: undefined }}
              >
                Unlock publishing and printing
              </Link>
            </Button>
            <p className="text-sm text-muted-foreground">
              One purchase covers this competition. Keep building your draft for
              free.
            </p>
          </div>
        )}
        {data.published && (
          <Button
            variant="ghost"
            className="min-h-11"
            disabled={busy !== null}
            onClick={() => void updatePublication("unpublish")}
          >
            {busy === "unpublish" ? "Taking offline…" : "Unpublish"}
          </Button>
        )}
        {data.published && data.hasAccess && (
          <div className="space-y-3 border-t pt-5">
            <label
              htmlFor="crew-share-url"
              className="block text-sm font-medium"
            >
              Volunteer schedule link
            </label>
            <Input
              id="crew-share-url"
              readOnly
              value={shareUrl}
              className="h-11 text-base md:text-base"
              onFocus={(event) => event.target.select()}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="min-h-11"
                onClick={() => void copy("link")}
              >
                {copied === "link" ? <Check /> : <Copy />} Copy link
              </Button>
              <Button
                variant="outline"
                className="min-h-11"
                onClick={() => void copy("message")}
              >
                {copied === "message" ? <Check /> : <Copy />} Copy volunteer
                message
              </Button>
              <Button asChild variant="ghost" className="min-h-11">
                <a href={data.sharePath} target="_blank" rel="noreferrer">
                  <ExternalLink /> Open published schedule
                </a>
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Paste the link or message into Competition Corner’s volunteer
              messaging or your usual email tool.
            </p>
          </div>
        )}
      </section>

      <section aria-label="Volunteer schedule preview" className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
          <fieldset className="flex flex-wrap gap-2" aria-label="Preview version">
            <Button
              variant={view === "draft" ? "secondary" : "ghost"}
              className="min-h-11"
              aria-pressed={view === "draft"}
              onClick={() => setView("draft")}
            >
              Draft preview
            </Button>
            {data.published && (
              <Button
                variant={view === "published" ? "secondary" : "ghost"}
                className="min-h-11"
                aria-pressed={view === "published"}
                onClick={() => setView("published")}
              >
                Published version
              </Button>
            )}
          </fieldset>
          <Button
            variant="ghost"
            className="min-h-11"
            disabled={busy !== null}
            onClick={() => void updatePublication("refresh")}
          >
            {busy === "refresh" ? "Refreshing…" : "Refresh preview"}
          </Button>
        </div>
        <div className="mx-auto max-w-2xl rounded-lg border p-5 sm:p-7">
          {visibleSchedule ? (
            <CrewPublicScheduleView
              key={view}
              schedule={visibleSchedule}
              preview
            />
          ) : (
            <p role="alert" className="text-sm text-destructive">
              {data.previewError ??
                "Draft preview is unavailable. Check your assignments, then refresh the preview."}
            </p>
          )}
        </div>
      </section>
    </section>
  )
}
