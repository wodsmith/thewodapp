"use client"

import {useCallback, useRef, useState} from "react"

export type LaneShiftPattern = "stay" | "shift_right"
export type ProposalConfidence = "high" | "medium" | "low"

export interface ProposedRotationPayload {
  membershipId: string
  startingHeat: number
  startingLane: number
  heatsCount: number
  laneShiftPattern: LaneShiftPattern
  reason: string
  confidence: ProposalConfidence
}

export interface AcceptedProposal {
  proposalId: string
  proposal: ProposedRotationPayload
}

export interface RejectedProposal {
  proposal: ProposedRotationPayload
  conflict: {kind: string; message: string}
}

export interface CoverageStats {
  coveragePercent: number
  coveredSlots: number
  totalSlots: number
}

export interface JudgeSummary {
  membershipId: string
  displayName: string
  availability?: string
}

export interface StreamingProposalsState {
  status: "idle" | "streaming" | "done" | "error"
  judges: JudgeSummary[]
  proposals: AcceptedProposal[]
  conflicts: RejectedProposal[]
  narrative: string
  coverageBefore: CoverageStats | null
  coverageAfterIfAllAccepted: CoverageStats | null
  error: string | null
}

export interface StartStreamInput {
  competitionId: string
  organizingTeamId: string
  competitionTeamId: string
  trackWorkoutId: string
  organizerInstructions?: string
}

interface ProposalEventData {
  proposalId: string
  proposal: ProposedRotationPayload
}

interface ConflictEventData {
  proposal: ProposedRotationPayload
  conflict: {kind: string; message: string}
}

interface DoneEventData {
  proposalCount: number
  coverageBefore: CoverageStats
  coverageAfterIfAllAccepted: CoverageStats
}

const initialState: StreamingProposalsState = {
  status: "idle",
  judges: [],
  proposals: [],
  conflicts: [],
  narrative: "",
  coverageBefore: null,
  coverageAfterIfAllAccepted: null,
  error: null,
}

/**
 * React hook that POSTs to /api/judge-scheduler/suggest, parses the SSE
 * response, and exposes the live state of the agent's run. Returns helpers to
 * start / cancel / discard a proposal locally.
 */
export function useStreamingProposals() {
  const [state, setState] = useState<StreamingProposalsState>(initialState)
  const abortRef = useRef<AbortController | null>(null)

  const start = useCallback(async (input: StartStreamInput) => {
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac

    setState({...initialState, status: "streaming"})

    let response: Response
    try {
      response = await fetch("/api/judge-scheduler/suggest", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(input),
        signal: ac.signal,
      })
    } catch (e) {
      if (ac.signal.aborted) return
      setState((s) => ({
        ...s,
        status: "error",
        error: e instanceof Error ? e.message : "Network error",
      }))
      return
    }

    if (!response.ok || !response.body) {
      let message = `Request failed (${response.status})`
      try {
        const json = (await response.json()) as {error?: string}
        if (json.error) message = json.error
      } catch {
        /* ignore */
      }
      setState((s) => ({...s, status: "error", error: message}))
      return
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ""

    try {
      while (true) {
        const {done, value} = await reader.read()
        if (done) break
        buffer += decoder.decode(value, {stream: true})

        let separatorIdx: number
        while ((separatorIdx = buffer.indexOf("\n\n")) !== -1) {
          const rawEvent = buffer.slice(0, separatorIdx)
          buffer = buffer.slice(separatorIdx + 2)
          handleSseEvent(rawEvent, setState)
        }
      }
    } catch (e) {
      if (ac.signal.aborted) return
      setState((s) => ({
        ...s,
        status: "error",
        error: e instanceof Error ? e.message : "Stream interrupted",
      }))
    }
  }, [])

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setState((s) => (s.status === "streaming" ? {...s, status: "idle"} : s))
  }, [])

  const discardProposal = useCallback((proposalId: string) => {
    setState((s) => ({
      ...s,
      proposals: s.proposals.filter((p) => p.proposalId !== proposalId),
    }))
  }, [])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setState(initialState)
  }, [])

  return {state, start, cancel, discardProposal, reset}
}

function handleSseEvent(
  raw: string,
  setState: (
    updater: (s: StreamingProposalsState) => StreamingProposalsState,
  ) => void,
): void {
  let eventType = "message"
  let dataLine = ""
  for (const line of raw.split("\n")) {
    if (line.startsWith("event:")) eventType = line.slice(6).trim()
    else if (line.startsWith("data:")) dataLine += line.slice(5).trim()
  }

  if (!dataLine) return

  let data: unknown
  try {
    data = JSON.parse(dataLine)
  } catch {
    return
  }

  switch (eventType) {
    case "init": {
      const d = data as {judges: JudgeSummary[]; coverageBefore: CoverageStats}
      setState((s) => ({
        ...s,
        judges: d.judges,
        coverageBefore: d.coverageBefore,
      }))
      break
    }
    case "proposal": {
      const d = data as ProposalEventData
      setState((s) => ({...s, proposals: [...s.proposals, d]}))
      break
    }
    case "conflict": {
      const d = data as ConflictEventData
      setState((s) => ({...s, conflicts: [...s.conflicts, d]}))
      break
    }
    case "narrative": {
      const d = data as {text: string}
      setState((s) => ({...s, narrative: d.text}))
      break
    }
    case "done": {
      const d = data as DoneEventData
      setState((s) => ({
        ...s,
        status: "done",
        coverageBefore: d.coverageBefore,
        coverageAfterIfAllAccepted: d.coverageAfterIfAllAccepted,
      }))
      break
    }
    case "error": {
      const d = data as {message: string}
      setState((s) => ({...s, status: "error", error: d.message}))
      break
    }
  }
}
