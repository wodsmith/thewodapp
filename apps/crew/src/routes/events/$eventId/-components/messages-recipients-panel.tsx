import { Loader2, Search, Send, Users } from "lucide-react"
import { useMemo } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getCrewAssignmentConfirmationStatusLabel } from "@/lib/crew/assignment-confirmation-display"
import type { CrewAssignmentCommunicationState } from "@/server-fns/crew-confirmation-fns"
import type {
  CrewMessageComposerData,
  CrewMessageFilters,
  CrewMessageRecipient,
} from "@/server-fns/crew-message-fns"
import { formatDateTimeInTimezone } from "@/utils/timezone-utils"

const ALL_ROLES_VALUE = "__all_roles__"
const ALL_SHIFTS_VALUE = "__all_shifts__"

const SKIP_REASON_LABELS: Record<string, string> = {
  missing_email: "No email on file",
  already_sent: "Already sent",
  responded: "Already responded",
  not_due: "Not due yet",
  past_shift: "Shift has passed",
}

function stateLabel(state: CrewAssignmentCommunicationState): string {
  if (state === "not_ready") return "Not ready"
  return getCrewAssignmentConfirmationStatusLabel(state)
}

export function MessageRecipientsPanel({
  mode,
  filters,
  filterOptions,
  recipients,
  isLoading,
  previewError,
  selectedKeys,
  timezone,
  subject,
  isSending,
  onFiltersChange,
  onToggle,
  onSelectAllEligible,
  onClearSelection,
  onSend,
}: {
  mode: "assignment_confirmation" | "reminder" | "custom_broadcast"
  filters: CrewMessageFilters
  filterOptions: CrewMessageComposerData["filterOptions"]
  recipients: CrewMessageRecipient[]
  isLoading: boolean
  previewError: string | null
  selectedKeys: Set<string>
  timezone: string
  subject: string
  isSending: boolean
  onFiltersChange: (filters: CrewMessageFilters) => void
  onToggle: (key: string) => void
  onSelectAllEligible: () => void
  onClearSelection: () => void
  onSend: () => void
}) {
  const eligible = useMemo(
    () => recipients.filter((r) => r.eligible),
    [recipients],
  )
  const selectedEligibleCount = eligible.filter((r) =>
    selectedKeys.has(r.key),
  ).length
  const allEligibleSelected =
    eligible.length > 0 && selectedEligibleCount === eligible.length

  const skipBreakdown = useMemo(() => {
    const counts = new Map<string, number>()
    for (const r of recipients) {
      if (r.eligible || !r.skipReason) continue
      counts.set(r.skipReason, (counts.get(r.skipReason) ?? 0) + 1)
    }
    return counts
  }, [recipients])
  const skippedTotal = recipients.length - eligible.length

  const selectedStates = new Set(filters.states ?? [])

  function toggleState(state: CrewAssignmentCommunicationState) {
    const next = new Set(selectedStates)
    if (next.has(state)) {
      next.delete(state)
    } else {
      next.add(state)
    }
    onFiltersChange({
      ...filters,
      states: next.size > 0 ? Array.from(next) : undefined,
    })
  }

  return (
    <div className="flex h-full flex-col rounded-md border bg-card shadow-sm">
      <div className="space-y-4 border-b p-4">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold">Recipients</h3>
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <span className="text-sm text-muted-foreground">
              {eligible.length} eligible
            </span>
          )}
        </div>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search recipients"
            className="pl-8"
            placeholder="Search by name or email"
            value={filters.search ?? ""}
            onChange={(e) =>
              onFiltersChange({
                ...filters,
                search: e.target.value || undefined,
              })
            }
          />
        </div>

        {mode !== "custom_broadcast" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Role</Label>
              <Select
                value={filters.roles?.[0] ?? ALL_ROLES_VALUE}
                onValueChange={(value) =>
                  onFiltersChange({
                    ...filters,
                    roles: value === ALL_ROLES_VALUE ? undefined : [value],
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_ROLES_VALUE}>All roles</SelectItem>
                  {filterOptions.roles.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Shift</Label>
              <Select
                value={filters.shiftIds?.[0] ?? ALL_SHIFTS_VALUE}
                onValueChange={(value) =>
                  onFiltersChange({
                    ...filters,
                    shiftIds: value === ALL_SHIFTS_VALUE ? undefined : [value],
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All shifts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_SHIFTS_VALUE}>All shifts</SelectItem>
                  {filterOptions.shifts.map((shift) => (
                    <SelectItem key={shift.id} value={shift.id}>
                      {shift.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {mode !== "custom_broadcast" && filterOptions.states.length > 0 && (
          <div className="space-y-1.5">
            <Label className="text-xs">Response state</Label>
            <div className="flex flex-wrap gap-2">
              {filterOptions.states.map((state) => (
                <label
                  key={state}
                  htmlFor={`recipient-state-${state}`}
                  className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs"
                >
                  <Checkbox
                    id={`recipient-state-${state}`}
                    checked={selectedStates.has(state)}
                    onCheckedChange={() => toggleState(state)}
                  />
                  {stateLabel(state)}
                </label>
              ))}
            </div>
          </div>
        )}

        {mode !== "custom_broadcast" && (
          <label
            htmlFor="recipients-include-already-sent"
            className="flex items-center gap-2 text-sm"
          >
            <Checkbox
              id="recipients-include-already-sent"
              checked={filters.includeAlreadySent ?? false}
              onCheckedChange={(checked) =>
                onFiltersChange({
                  ...filters,
                  includeAlreadySent: checked === true ? true : undefined,
                })
              }
            />
            Include volunteers already sent this message
          </label>
        )}

        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            className="font-medium text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-60"
            disabled={eligible.length === 0}
            onClick={onSelectAllEligible}
          >
            {allEligibleSelected
              ? "All eligible selected"
              : "Select all eligible"}
          </button>
          {selectedKeys.size > 0 ? (
            <button
              type="button"
              className="text-muted-foreground hover:underline"
              onClick={onClearSelection}
            >
              Clear
            </button>
          ) : null}
        </div>
      </div>

      <div className="min-h-[16rem] flex-1 overflow-y-auto">
        {isLoading && recipients.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            Loading recipients...
          </p>
        ) : previewError ? (
          <p className="p-4 text-sm text-destructive">
            Could not load recipients. {previewError}
          </p>
        ) : recipients.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            No volunteers match these filters.
          </p>
        ) : (
          <ul className="divide-y">
            {recipients.map((recipient) => {
              const checked = selectedKeys.has(recipient.key)
              return (
                <li
                  key={recipient.key}
                  className={`flex items-start gap-3 p-3 ${
                    recipient.eligible ? "" : "opacity-60"
                  }`}
                >
                  <Checkbox
                    className="mt-0.5"
                    aria-label={`Select ${recipient.volunteerName}`}
                    checked={checked}
                    disabled={!recipient.eligible}
                    onCheckedChange={() => onToggle(recipient.key)}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {recipient.volunteerName}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {recipient.volunteerEmail ?? "No email on file"}
                    </p>
                    {mode !== "custom_broadcast" ? (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {recipient.shiftName} · {recipient.roleLabel} ·{" "}
                        {formatDateTimeInTimezone(
                          recipient.startsAt,
                          timezone,
                          "EEE, MMM d h:mm a",
                        )}
                      </p>
                    ) : null}
                  </div>
                  {!recipient.eligible && recipient.skipReason ? (
                    <span className="shrink-0 rounded-md border bg-background px-2 py-0.5 text-xs text-muted-foreground">
                      {SKIP_REASON_LABELS[recipient.skipReason] ??
                        recipient.skipReason}
                    </span>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="sticky bottom-0 border-t bg-card p-4">
        {skippedTotal > 0 ? (
          <p className="mb-2 text-xs text-muted-foreground">
            {skippedTotal} skipped
            {skipBreakdown.size > 0
              ? ` (${Array.from(skipBreakdown.entries())
                  .map(
                    ([reason, count]) =>
                      `${count} ${SKIP_REASON_LABELS[reason] ?? reason}`,
                  )
                  .join(", ")})`
              : ""}
          </p>
        ) : null}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              className="w-full"
              disabled={selectedEligibleCount === 0 || isSending}
            >
              {isSending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Send to {selectedEligibleCount} volunteer
              {selectedEligibleCount === 1 ? "" : "s"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Send this message?</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-2 text-sm">
                  <p>
                    Sending <span className="font-medium">{subject}</span> to{" "}
                    <span className="font-medium">
                      {selectedEligibleCount} volunteer
                      {selectedEligibleCount === 1 ? "" : "s"}
                    </span>
                    .
                  </p>
                  {skippedTotal > 0 ? (
                    <p className="text-muted-foreground">
                      {skippedTotal} ineligible volunteer
                      {skippedTotal === 1 ? "" : "s"} in this view will be
                      skipped.
                    </p>
                  ) : null}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={onSend}>Send</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}
