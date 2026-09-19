import { describe, expect, it, vi } from "vitest"

import { ok, type Result } from "../../src/core"
import {
  decodeCompetitionDivisionId,
  decodeCompetitionEventId,
  decodeCompetitionId,
  decodeOrganizationId,
  decodeRegistrationId,
  decodeUserId,
  type CompetitionDivisionId,
} from "../../src/identity"
import {
  decideScoreRemoval,
  handleRemoveCompetitionScore,
  type ParticipationEventProof,
  type RemoveCompetitionScoreCommand,
  type ScoreCommandError,
  type ScoreRemovalStore,
  type ScoreRemovalTransaction,
  type ScoreResultId,
} from "../../src/scores"

function decoded<T>(result: Result<T, unknown>): T {
  if (!result.ok) throw new Error("invalid test identifier")
  return result.value
}

const ids = {
  competition: decoded(decodeCompetitionId("comp_test")),
  organization: decoded(decodeOrganizationId("team_test")),
  event: decoded(decodeCompetitionEventId("trwk_test")),
  registration: decoded(decodeRegistrationId("creg_test")),
  athlete: decoded(decodeUserId("usr_test")),
  division: decoded(decodeCompetitionDivisionId("slvl_test")),
}

function command(
  division: RemoveCompetitionScoreCommand["division"] = {
    kind: "division",
    divisionId: ids.division,
  },
): RemoveCompetitionScoreCommand {
  return {
    kind: "RemoveCompetitionScore",
    competitionId: ids.competition,
    organizationId: ids.organization,
    competitionEventId: ids.event,
    athleteId: ids.athlete,
    division,
    reason: "organizer-clear",
  }
}

function proof(
  division: ParticipationEventProof["division"] = {
    kind: "division",
    divisionId: ids.division,
  },
): ParticipationEventProof {
  return {
    registrationId: ids.registration,
    competitionId: ids.competition,
    organizationId: ids.organization,
    competitionEventId: ids.event,
    athleteId: ids.athlete,
    division,
  }
}

function scoreId(value: string): ScoreResultId {
  return value as ScoreResultId
}

function store(input?: {
  identity?: Result<ParticipationEventProof, ScoreCommandError>
  resultIds?: readonly ScoreResultId[]
  failAt?: "rounds" | "results"
}) {
  const events: string[] = []
  let durable = ["score-before"]
  const tx: ScoreRemovalTransaction = {
    resolveIdentity: vi.fn(async () => {
      events.push("resolve")
      return input?.identity ?? ok(proof())
    }),
    findResultIds: vi.fn(async () => {
      events.push("find")
      return input?.resultIds ?? [scoreId("score-1")]
    }),
    removeRoundProjections: vi.fn(async () => {
      events.push("rounds")
      durable = []
      if (input?.failAt === "rounds") throw new Error("round failure")
    }),
    removeResultProjections: vi.fn(async () => {
      events.push("results")
      if (input?.failAt === "results") throw new Error("result failure")
      durable = []
    }),
  }
  const removalStore: ScoreRemovalStore = {
    transaction: vi.fn(async (work) => {
      const before = [...durable]
      try {
        return await work(tx)
      } catch (error) {
        durable = before
        throw error
      }
    }),
  }

  return { removalStore, tx, events, durable: () => durable }
}

describe("score removal decision", () => {
  // @lat: [[competition-results#Competition Result Commands#Removal identity proof]]
  it("rejects any independently mismatched identity dimension", () => {
    const otherDivision = "slvl_other" as CompetitionDivisionId
    const result = decideScoreRemoval({
      command: command(),
      identity: {
        ...proof({ kind: "division", divisionId: otherDivision }),
        organizationId: decodeOrganizationId("team_other").ok
          ? decoded(decodeOrganizationId("team_other"))
          : ids.organization,
      },
      resultIds: [],
    })

    expect(result).toEqual({
      ok: false,
      error: {
        kind: "ContextMismatch",
        mismatches: ["organization", "division"],
      },
    })
  })

  it("represents an open division explicitly", () => {
    expect(
      decideScoreRemoval({
        command: command({ kind: "open" }),
        identity: proof({ kind: "open" }),
        resultIds: [scoreId("score-open")],
      }),
    ).toEqual({
      ok: true,
      value: {
        resultIds: ["score-open"],
        facts: [
          expect.objectContaining({
            kind: "ResultRemoved",
            removedResultIds: ["score-open"],
          }),
        ],
      },
    })
  })
})

describe("score removal command", () => {
  // @lat: [[competition-results#Competition Result Commands#Atomic score removal]]
  it("resolves identity and deletes round projections before result projections", async () => {
    const fixture = store({
      resultIds: [scoreId("score-1"), scoreId("score-legacy-duplicate")],
    })

    const result = await handleRemoveCompetitionScore({
      command: command(),
      store: fixture.removalStore,
    })

    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({ removedCount: 2 }),
    })
    expect(fixture.events).toEqual(["resolve", "find", "rounds", "results"])
    expect(fixture.removalStore.transaction).toHaveBeenCalledTimes(1)
  })

  it("is idempotent when the proven scope has no result", async () => {
    const fixture = store({ resultIds: [] })

    const result = await handleRemoveCompetitionScore({
      command: command(),
      store: fixture.removalStore,
    })

    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({ removedCount: 0 }),
    })
    expect(fixture.tx.removeRoundProjections).not.toHaveBeenCalled()
    expect(fixture.tx.removeResultProjections).not.toHaveBeenCalled()
  })

  it("does not query or mutate projections when identity cannot be proven", async () => {
    const fixture = store({
      identity: { ok: false, error: { kind: "AmbiguousParticipation" } },
    })

    expect(
      await handleRemoveCompetitionScore({
        command: command(),
        store: fixture.removalStore,
      }),
    ).toEqual({ ok: false, error: { kind: "AmbiguousParticipation" } })
    expect(fixture.tx.findResultIds).not.toHaveBeenCalled()
    expect(fixture.tx.removeRoundProjections).not.toHaveBeenCalled()
  })

  // @lat: [[competition-results#Competition Result Commands#Removal fault rollback]]
  it.each(["rounds", "results"] as const)(
    "returns a retryable storage error and relies on rollback after %s failure",
    async (failAt) => {
      const fixture = store({ failAt })

      expect(
        await handleRemoveCompetitionScore({
          command: command(),
          store: fixture.removalStore,
        }),
      ).toEqual({
        ok: false,
        error: {
          kind: "StorageUnavailable",
          retryable: true,
          cause: expect.any(Error),
        },
      })
      expect(fixture.durable()).toEqual(["score-before"])
    },
  )
})
