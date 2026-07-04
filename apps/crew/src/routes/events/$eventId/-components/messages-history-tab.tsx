import { CheckCircle2, XCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { CrewMessageHistoryEntry } from "@/server-fns/crew-message-fns"
import { formatDateTimeInTimezone } from "@/utils/timezone-utils"

const KIND_LABELS: Record<CrewMessageHistoryEntry["kind"], string> = {
  confirmation: "Assignment invites",
  reminder: "Reminder",
  broadcast: "Custom message",
}

export function MessagesHistoryTab({
  history,
  timezone,
}: {
  history: CrewMessageHistoryEntry[]
  timezone: string
}) {
  if (history.length === 0) {
    return (
      <div className="rounded-md border bg-card p-8 text-center shadow-sm">
        <p className="text-sm text-muted-foreground">
          No messages have been sent yet.
        </p>
      </div>
    )
  }

  return (
    <ul className="space-y-3">
      {history.map((entry) => (
        <li key={entry.id} className="rounded-md border bg-card p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{KIND_LABELS[entry.kind]}</Badge>
                <p className="font-medium">{entry.subject}</p>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {entry.sentAt
                  ? formatDateTimeInTimezone(
                      entry.sentAt,
                      timezone,
                      "EEE, MMM d h:mm a",
                    )
                  : "Not sent"}{" "}
                · {entry.recipientCount} recipient
                {entry.recipientCount === 1 ? "" : "s"}
              </p>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                {entry.delivered} delivered
              </span>
              {entry.failed > 0 ? (
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <XCircle className="h-4 w-4 text-destructive" />
                  {entry.failed} failed
                </span>
              ) : null}
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}
