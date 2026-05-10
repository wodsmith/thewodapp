"use client"

import {useServerFn} from "@tanstack/react-start"
import {Loader2, Send, Sparkles} from "lucide-react"
import {useMemo, useState} from "react"
import {toast} from "sonner"
import {Button} from "@/components/ui/button"
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card"
import {Label} from "@/components/ui/label"
import {Textarea} from "@/components/ui/textarea"
import {createJudgeRotationFn} from "@/server-fns/judge-rotation-fns"
import {ProposalCard} from "./proposal-card"
import {
  type AcceptedProposal,
  useStreamingProposals,
} from "./use-streaming-proposals"

interface AiSuggestionPanelProps {
  competitionId: string
  organizingTeamId: string
  competitionTeamId: string
  trackWorkoutId: string
  onProposalAccepted?: () => void
}

type ProposalUiStatus = "pending" | "accepting" | "accepted" | "discarded"

export function AiSuggestionPanel(props: AiSuggestionPanelProps) {
  const {state, start, cancel} = useStreamingProposals()
  const [instructions, setInstructions] = useState("")
  const [statusByProposal, setStatusByProposal] = useState<
    Record<string, ProposalUiStatus>
  >({})
  const [errorByProposal, setErrorByProposal] = useState<
    Record<string, string | undefined>
  >({})

  const createRotation = useServerFn(createJudgeRotationFn)

  const judgeMap = useMemo(
    () => new Map(state.judges.map((j) => [j.membershipId, j])),
    [state.judges],
  )

  const visibleProposals = state.proposals.filter(
    (p) => statusByProposal[p.proposalId] !== "discarded",
  )
  const acceptedCount = Object.values(statusByProposal).filter(
    (s) => s === "accepted",
  ).length

  const handleGenerate = () => {
    setStatusByProposal({})
    setErrorByProposal({})
    start({
      competitionId: props.competitionId,
      organizingTeamId: props.organizingTeamId,
      competitionTeamId: props.competitionTeamId,
      trackWorkoutId: props.trackWorkoutId,
      organizerInstructions: instructions.trim() || undefined,
    })
  }

  const handleAccept = async (p: AcceptedProposal) => {
    setStatusByProposal((m) => ({...m, [p.proposalId]: "accepting"}))
    setErrorByProposal((m) => ({...m, [p.proposalId]: undefined}))
    try {
      await createRotation({
        data: {
          teamId: props.organizingTeamId,
          competitionId: props.competitionId,
          trackWorkoutId: props.trackWorkoutId,
          membershipId: p.proposal.membershipId,
          startingHeat: p.proposal.startingHeat,
          startingLane: p.proposal.startingLane,
          heatsCount: p.proposal.heatsCount,
          laneShiftPattern: p.proposal.laneShiftPattern,
          notes: `AI: ${p.proposal.reason}`,
        },
      })
      setStatusByProposal((m) => ({...m, [p.proposalId]: "accepted"}))
      toast.success("Rotation saved")
      props.onProposalAccepted?.()
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to save"
      setStatusByProposal((m) => ({...m, [p.proposalId]: "pending"}))
      setErrorByProposal((m) => ({...m, [p.proposalId]: message}))
      toast.error(message)
    }
  }

  const handleAcceptAll = async () => {
    for (const p of visibleProposals) {
      if (statusByProposal[p.proposalId] === "accepted") continue
      // sequential to avoid concurrent buffer-violation races
      // eslint-disable-next-line no-await-in-loop
      await handleAccept(p)
    }
  }

  const handleDiscard = (proposalId: string) => {
    setStatusByProposal((m) => ({...m, [proposalId]: "discarded"}))
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Suggest with AI
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="instructions">Instructions (optional)</Label>
            <Textarea
              id="instructions"
              placeholder="e.g. Save Hannah for the morning. Eric prefers heats 1–3."
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={2}
              maxLength={2000}
              disabled={state.status === "streaming"}
            />
          </div>

          <div className="flex items-center gap-2">
            {state.status === "streaming" ? (
              <Button variant="outline" onClick={cancel}>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Cancel
              </Button>
            ) : (
              <Button onClick={handleGenerate}>
                <Send className="mr-2 h-4 w-4" />
                {state.status === "done" ? "Regenerate" : "Generate"}
              </Button>
            )}

            {state.status === "done" && visibleProposals.length > 0 ? (
              <Button variant="default" onClick={handleAcceptAll}>
                Accept all ({visibleProposals.length - acceptedCount})
              </Button>
            ) : null}
          </div>

          {state.error ? (
            <p className="rounded border border-destructive/30 bg-destructive/10 px-2 py-1 text-destructive text-xs">
              {state.error}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {state.coverageBefore && state.coverageAfterIfAllAccepted ? (
        <CoverageProjection
          before={state.coverageBefore.coveragePercent}
          after={state.coverageAfterIfAllAccepted.coveragePercent}
          totalSlots={state.coverageBefore.totalSlots}
        />
      ) : null}

      {visibleProposals.length > 0 ? (
        <div className="space-y-2">
          {visibleProposals.map((p) => (
            <ProposalCard
              key={p.proposalId}
              proposal={p}
              judge={judgeMap.get(p.proposal.membershipId)}
              status={statusByProposal[p.proposalId] ?? "pending"}
              errorMessage={errorByProposal[p.proposalId]}
              onAccept={() => handleAccept(p)}
              onDiscard={() => handleDiscard(p.proposalId)}
            />
          ))}
        </div>
      ) : state.status === "done" ? (
        <Card>
          <CardContent className="p-4 text-muted-foreground text-sm">
            No proposals were generated.{" "}
            {state.narrative
              ? `Agent said: "${state.narrative}"`
              : "Try adjusting instructions and regenerating."}
          </CardContent>
        </Card>
      ) : null}

      {state.narrative && visibleProposals.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Agent summary</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-muted-foreground text-sm">
              {state.narrative}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {state.conflicts.length > 0 ? (
        <details className="rounded-md border border-border bg-muted/30 p-2 text-xs">
          <summary className="cursor-pointer text-muted-foreground">
            {state.conflicts.length} rejected attempt(s)
          </summary>
          <ul className="mt-2 space-y-1">
            {state.conflicts.map((c, i) => (
              <li key={`${c.proposal.membershipId}-${i}`}>
                <span className="font-medium">
                  {judgeMap.get(c.proposal.membershipId)?.displayName ??
                    c.proposal.membershipId}
                </span>{" "}
                @ heat {c.proposal.startingHeat} lane{" "}
                {c.proposal.startingLane}: {c.conflict.message}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  )
}

function CoverageProjection(props: {
  before: number
  after: number
  totalSlots: number
}) {
  const delta = props.after - props.before
  return (
    <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
      Coverage:{" "}
      <span className="font-medium">{props.before}%</span> →{" "}
      <span className="font-medium">{props.after}%</span>{" "}
      <span className="text-muted-foreground">
        {delta > 0 ? `(+${delta} pts)` : delta < 0 ? `(${delta} pts)` : ""} •{" "}
        {props.totalSlots} slot(s) total
      </span>
    </div>
  )
}
