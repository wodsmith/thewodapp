"use client"

import {Check, Loader2, Sparkles, X} from "lucide-react"
import {Badge} from "@/components/ui/badge"
import {Button} from "@/components/ui/button"
import {Card, CardContent} from "@/components/ui/card"
import {cn} from "@/utils/cn"
import type {
  AcceptedProposal,
  JudgeSummary,
  ProposalConfidence,
} from "./use-streaming-proposals"

interface ProposalCardProps {
  proposal: AcceptedProposal
  judge?: JudgeSummary
  status: "pending" | "accepting" | "accepted" | "discarded"
  errorMessage?: string
  onAccept: () => void
  onDiscard: () => void
}

const CONFIDENCE_STYLES: Record<ProposalConfidence, string> = {
  high: "bg-emerald-100 text-emerald-900",
  medium: "bg-amber-100 text-amber-900",
  low: "bg-rose-100 text-rose-900",
}

export function ProposalCard(props: ProposalCardProps) {
  const {proposal, judge, status, errorMessage, onAccept, onDiscard} = props
  const p = proposal.proposal

  const lastHeat = p.startingHeat + p.heatsCount - 1
  const heatRange =
    p.heatsCount === 1
      ? `Heat ${p.startingHeat}`
      : `Heats ${p.startingHeat}–${lastHeat}`

  const lanePattern =
    p.laneShiftPattern === "stay"
      ? `Lane ${p.startingLane}`
      : `Lane ${p.startingLane} → shift right`

  return (
    <Card
      className={cn(
        "transition-opacity",
        status === "discarded" && "opacity-50",
        status === "accepted" && "border-emerald-300",
      )}
    >
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className="font-medium">
                {judge?.displayName ?? p.membershipId}
              </span>
              <Badge
                variant="secondary"
                className={cn("text-xs", CONFIDENCE_STYLES[p.confidence])}
              >
                {p.confidence}
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm">
              {heatRange} • {lanePattern}
            </p>
          </div>

          <div className="flex shrink-0 gap-1">
            {status === "accepted" ? (
              <Badge variant="outline" className="gap-1 border-emerald-400">
                <Check className="h-3 w-3" /> Saved
              </Badge>
            ) : status === "accepting" ? (
              <Button size="sm" variant="ghost" disabled>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              </Button>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="default"
                  onClick={onAccept}
                  disabled={status === "discarded"}
                >
                  <Check className="mr-1 h-3.5 w-3.5" /> Accept
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onDiscard}
                  disabled={status === "discarded"}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
          </div>
        </div>

        <p className="text-foreground text-sm italic">"{p.reason}"</p>

        {errorMessage ? (
          <p className="rounded border border-destructive/30 bg-destructive/10 px-2 py-1 text-destructive text-xs">
            {errorMessage}
          </p>
        ) : null}

        {judge?.availability && p.confidence === "low" ? (
          <p className="text-muted-foreground text-xs">
            Availability: {judge.availability.replace("_", " ")}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
