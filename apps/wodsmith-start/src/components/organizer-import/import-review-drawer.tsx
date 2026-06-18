import { useRouter } from "@tanstack/react-router"
import { useAgent } from "agents/react"
import {
  AlertTriangle,
  Check,
  Loader2,
  RotateCcw,
  Send,
  Sparkles,
  Undo2,
  X,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import type { AgentImportRouteKind } from "@/db/schemas/agent-imports"
import type {
  AgentState,
  ApplyImportResult,
  EventProposal,
  VolunteerProposal,
} from "@/lib/organizer-file-import/schemas"
import {
  applyOrganizerImportFn,
  undoImportFn,
} from "@/server-fns/organizer-file-import-fns"
import { useSession } from "@/utils/auth-client"
import { routeKindLabel } from "./use-page-intent"

interface ImportReviewDrawerProps {
  importRunId: string
  competitionId: string
  routeKind: AgentImportRouteKind
  eventId?: string
  onClose: () => void
}

export function ImportReviewDrawer({
  importRunId,
  competitionId,
  routeKind,
  eventId,
  onClose,
}: ImportReviewDrawerProps) {
  const session = useSession()
  const router = useRouter()
  const userId = session?.userId ?? "anonymous"

  const agent = useAgent<AgentState>({
    agent: "organizer-file-import-agent",
    name: `${importRunId}__${userId}`,
  })

  const startedRef = useRef(false)
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [refineText, setRefineText] = useState("")
  const [isApplying, setIsApplying] = useState(false)
  const [isRefining, setIsRefining] = useState(false)
  const [isUndoing, setIsUndoing] = useState(false)
  const [receipt, setReceipt] = useState<ApplyImportResult | null>(null)

  const status = agent.state?.status ?? "parsing"
  const proposals = agent.state?.volunteerProposals ?? []
  const eventProposals = agent.state?.eventProposals ?? []
  const isEventMode = routeKind === "events" || routeKind === "event_detail"
  const thinkingLog = agent.state?.thinkingLog ?? []
  const parseWarnings = agent.state?.parseWarnings ?? []
  const clarification = agent.state?.clarification ?? null
  const errorMessage = agent.state?.errorMessage
  const isWorking = status === "parsing" || status === "thinking"
  const latestActivity = thinkingLog[thinkingLog.length - 1]?.message

  // Kick off the agent run once when the drawer mounts.
  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    agent.stub
      .start({ importRunId, competitionId, routeKind, eventId })
      .catch((err: unknown) =>
        toast.error(
          err instanceof Error ? err.message : "Failed to start the import",
        ),
      )
  }, [agent.stub, importRunId, competitionId, routeKind, eventId])

  const included = useMemo(
    () =>
      proposals.filter(
        (p) =>
          !excluded.has(p.proposalId) && p.action === "create" && !!p.email,
      ),
    [proposals, excluded],
  )
  const includedEvents = useMemo(
    () =>
      eventProposals.filter(
        (p) =>
          !excluded.has(p.proposalId) &&
          (p.action === "create" || p.action === "update"),
      ),
    [eventProposals, excluded],
  )
  const confirmCount = isEventMode ? includedEvents.length : included.length

  function toggleExcluded(proposalId: string) {
    setExcluded((prev) => {
      const next = new Set(prev)
      if (next.has(proposalId)) next.delete(proposalId)
      else next.add(proposalId)
      return next
    })
  }

  async function handleConfirm() {
    if (confirmCount === 0) return
    setIsApplying(true)
    try {
      const result = await applyOrganizerImportFn({
        data: {
          importRunId,
          volunteerProposals: isEventMode ? [] : included,
          eventProposals: isEventMode ? includedEvents : [],
        },
      })
      setReceipt(result)
      const appliedProposals = isEventMode ? includedEvents : included
      await agent.stub.markApplied({
        proposalIds: appliedProposals.map((p) => p.proposalId),
      })
      await router.invalidate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to apply import")
    } finally {
      setIsApplying(false)
    }
  }

  async function handleRefine() {
    const instruction = refineText.trim()
    if (!instruction) return
    setIsRefining(true)
    try {
      await agent.stub.refine({ instruction })
      setRefineText("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to refine")
    } finally {
      setIsRefining(false)
    }
  }

  async function handleUndo() {
    setIsUndoing(true)
    try {
      const result = await undoImportFn({ data: { importRunId } })
      toast.success(
        `Undid ${result.undoneCount} invitation${result.undoneCount === 1 ? "" : "s"}.`,
      )
      await router.invalidate()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to undo")
    } finally {
      setIsUndoing(false)
    }
  }

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 sm:max-w-lg"
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Import to {routeKindLabel(routeKind)}
          </SheetTitle>
          <SheetDescription>
            The assistant drafts changes from your file. Nothing is saved until
            you confirm.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-3 overflow-y-auto py-4">
          {errorMessage && (
            <Card className="border-destructive">
              <CardContent className="py-3 text-sm text-destructive">
                {errorMessage}
              </CardContent>
            </Card>
          )}

          {isWorking && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{latestActivity ?? "Reading your file…"}</span>
            </div>
          )}

          {parseWarnings.length > 0 && (
            <Card className="border-orange-300 dark:border-orange-900">
              <CardContent className="space-y-1 py-3 text-xs text-orange-700 dark:text-orange-400">
                {parseWarnings.map((w) => (
                  <div key={w} className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{w}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {clarification && (
            <Card className="border-primary/40">
              <CardContent className="py-3 text-sm">
                <p className="font-medium">{clarification.question}</p>
                {clarification.suggestedRouteKind && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    This looks like it belongs on the{" "}
                    {routeKindLabel(clarification.suggestedRouteKind)} page.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {receipt ? (
            <ReceiptView receipt={receipt} />
          ) : (
            !isWorking &&
            proposals.length === 0 &&
            eventProposals.length === 0 &&
            !clarification && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No importable rows were found in this file.
              </p>
            )
          )}

          {!receipt &&
            !isEventMode &&
            proposals.map((p) => (
              <ProposalRow
                key={p.proposalId}
                proposal={p}
                excluded={excluded.has(p.proposalId)}
                onToggle={() => toggleExcluded(p.proposalId)}
              />
            ))}

          {!receipt &&
            isEventMode &&
            eventProposals.map((p) => (
              <EventProposalRow
                key={p.proposalId}
                proposal={p}
                excluded={excluded.has(p.proposalId)}
                onToggle={() => toggleExcluded(p.proposalId)}
              />
            ))}
        </div>

        {!receipt && (
          <div className="space-y-3 border-t pt-4">
            <div className="space-y-2">
              <Textarea
                value={refineText}
                onChange={(e) => setRefineText(e.target.value)}
                placeholder={
                  isEventMode
                    ? "Refine in words — e.g. “skip the warm-up, set the AMRAP to 20 minutes”"
                    : "Refine in words — e.g. “make the coaches head judges, skip anyone without an email”"
                }
                rows={2}
                disabled={isWorking || isRefining}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefine}
                disabled={isWorking || isRefining || refineText.trim() === ""}
              >
                {isRefining ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RotateCcw className="mr-2 h-4 w-4" />
                )}
                Refine draft
              </Button>
            </div>

            <Button
              className="w-full"
              onClick={handleConfirm}
              disabled={isApplying || isWorking || confirmCount === 0}
            >
              {isApplying ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              {isEventMode
                ? `Confirm — apply ${confirmCount} event change${confirmCount === 1 ? "" : "s"}`
                : `Confirm — invite ${confirmCount} volunteer${
                    confirmCount === 1 ? "" : "s"
                  } (emails will send)`}
            </Button>
          </div>
        )}

        {receipt && (
          <div className="flex gap-2 border-t pt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleUndo}
              disabled={isUndoing}
            >
              {isUndoing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Undo2 className="mr-2 h-4 w-4" />
              )}
              Undo import
            </Button>
            <Button className="flex-1" onClick={onClose}>
              Done
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

function ProposalRow({
  proposal,
  excluded,
  onToggle,
}: {
  proposal: VolunteerProposal
  excluded: boolean
  onToggle: () => void
}) {
  const who = proposal.name ?? proposal.email ?? proposal.rowKey
  const isDuplicate =
    proposal.matchKind === "existing_member" ||
    proposal.matchKind === "existing_invite"
  const isBlocked = proposal.action === "needs_input"

  return (
    <div
      className={`rounded-md border p-3 transition-opacity ${
        excluded || isDuplicate || isBlocked
          ? "border-dashed opacity-60"
          : "border-border"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{who}</div>
          {proposal.email && (
            <div className="truncate text-xs text-muted-foreground">
              {proposal.email}
            </div>
          )}
        </div>
        <MatchBadge proposal={proposal} />
      </div>

      {proposal.roleTypes.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {proposal.roleTypes.map((r) => (
            <Badge key={r} variant="secondary" className="text-[10px]">
              {r.replace(/_/g, " ")}
            </Badge>
          ))}
        </div>
      )}

      {proposal.warnings.length > 0 && (
        <ul className="mt-1.5 space-y-0.5">
          {proposal.warnings.map((w) => (
            <li
              key={w}
              className="text-xs text-orange-600 dark:text-orange-400"
            >
              ⚠ {w}
            </li>
          ))}
        </ul>
      )}

      {!isDuplicate && !isBlocked && (
        <div className="mt-2 flex justify-end">
          <Button
            size="sm"
            variant={excluded ? "outline" : "ghost"}
            className="h-7 text-xs"
            onClick={onToggle}
          >
            {excluded ? (
              <>
                <Check className="mr-1 h-3 w-3" /> Include
              </>
            ) : (
              <>
                <X className="mr-1 h-3 w-3" /> Exclude
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  )
}

function MatchBadge({ proposal }: { proposal: VolunteerProposal }) {
  if (proposal.matchKind === "existing_member") {
    return <Badge variant="outline">Already a volunteer</Badge>
  }
  if (proposal.matchKind === "existing_invite") {
    return <Badge variant="outline">Already invited</Badge>
  }
  if (proposal.action === "needs_input") {
    return <Badge variant="destructive">Needs email</Badge>
  }
  return <Badge>New</Badge>
}

function formatDiffValue(value: unknown): string {
  if (value == null || value === "") return "—"
  const str = typeof value === "string" ? value : String(value)
  return str.length > 60 ? `${str.slice(0, 60)}…` : str
}

function EventProposalRow({
  proposal,
  excluded,
  onToggle,
}: {
  proposal: EventProposal
  excluded: boolean
  onToggle: () => void
}) {
  const isUpdate = proposal.action === "update"
  const isSkip = proposal.action === "skip"
  const actionable =
    proposal.action === "create" || proposal.action === "update"
  const changedFields = Object.entries(proposal.changedFields ?? {})
  return (
    <div
      className={`rounded-md border p-3 transition-opacity ${
        excluded || isSkip ? "border-dashed opacity-60" : "border-border"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{proposal.name}</div>
          {proposal.scheme && !isUpdate && (
            <div className="text-xs text-muted-foreground">
              {proposal.scheme.replace(/-/g, " ")}
            </div>
          )}
        </div>
        {isUpdate ? (
          <Badge variant="secondary">Update</Badge>
        ) : isSkip ? (
          <Badge variant="outline">Skip</Badge>
        ) : (
          <Badge>New event</Badge>
        )}
      </div>

      {isUpdate && changedFields.length > 0 && (
        <ul className="mt-2 space-y-1">
          {changedFields.map(([field, diff]) => (
            <li key={field} className="text-xs">
              <span className="font-medium">{field}</span>:{" "}
              <span className="text-muted-foreground line-through">
                {formatDiffValue(diff.before)}
              </span>{" "}
              → <span>{formatDiffValue(diff.after)}</span>
            </li>
          ))}
        </ul>
      )}

      {!isUpdate && proposal.description && (
        <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">
          {proposal.description}
        </p>
      )}

      {proposal.warnings.length > 0 && (
        <ul className="mt-1.5 space-y-0.5">
          {proposal.warnings.map((w) => (
            <li
              key={w}
              className="text-xs text-orange-600 dark:text-orange-400"
            >
              ⚠ {w}
            </li>
          ))}
        </ul>
      )}

      {actionable && (
        <div className="mt-2 flex justify-end">
          <Button
            size="sm"
            variant={excluded ? "outline" : "ghost"}
            className="h-7 text-xs"
            onClick={onToggle}
          >
            {excluded ? (
              <>
                <Check className="mr-1 h-3 w-3" /> Include
              </>
            ) : (
              <>
                <X className="mr-1 h-3 w-3" /> Exclude
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  )
}

function ReceiptView({ receipt }: { receipt: ApplyImportResult }) {
  return (
    <Card>
      <CardContent className="space-y-2 py-4 text-sm">
        <p className="font-medium">Import complete</p>
        <ul className="space-y-1 text-muted-foreground">
          <li>✅ {receipt.appliedCount} applied</li>
          <li>↩ {receipt.skippedCount} skipped</li>
          {receipt.failedCount > 0 && (
            <li className="text-destructive">
              ✕ {receipt.failedCount} could not be imported
            </li>
          )}
        </ul>
      </CardContent>
    </Card>
  )
}
