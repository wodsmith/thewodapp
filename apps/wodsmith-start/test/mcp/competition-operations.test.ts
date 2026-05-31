import { beforeEach, describe, expect, it, vi } from "vitest"

const movementFnState = vi.hoisted(() => ({
  directCalls: 0,
  serverCalls: 0,
  serverData: [] as unknown[],
  responseMode: "object" as "object" | "serialized-response",
}))

vi.mock("@tanstack/react-start", () => {
  const createServerFn = () => ({
    handler: (handler: unknown) => handler,
    inputValidator: () => ({
      handler: (handler: unknown) => handler,
    }),
  })

  return {
    createServerFn,
    createServerOnlyFn: (handler: unknown) => handler,
    json: (value: unknown, init?: ResponseInit) => Response.json(value, init),
  }
})

vi.mock("@/server-fns/movement-fns", () => {
  const getAllMovementsFn = Object.assign(
    async () => {
      movementFnState.directCalls += 1
      throw new Error("compiled server function fetcher was called directly")
    },
    {
      __executeServer: async (opts: { data: unknown }) => {
        movementFnState.serverCalls += 1
        movementFnState.serverData.push(opts.data)

        if (movementFnState.responseMode === "serialized-response") {
          return new Response(
            JSON.stringify({
              t: 10,
              p: {
                k: ["result"],
                v: [
                  {
                    t: 10,
                    p: {
                      k: ["ok", "data"],
                      v: [
                        { t: 2, s: 2 },
                        {
                          t: 10,
                          p: {
                            k: ["serialized"],
                            v: [{ t: 2, s: 2 }],
                          },
                        },
                      ],
                    },
                  },
                ],
              },
            }),
            {
              headers: {
                "Content-Type": "application/json",
                "x-tss-serialized": "true",
              },
            },
          )
        }

        return {
          result: {
            ok: true,
            data: opts.data,
          },
        }
      },
    },
  )

  return { getAllMovementsFn }
})

import {
  callCompetitionOperation,
  competitionOperationSpecs,
} from "@/mcp/competition-operations"

describe("competition MCP operation catalog", () => {
  beforeEach(() => {
    movementFnState.directCalls = 0
    movementFnState.serverCalls = 0
    movementFnState.serverData = []
    movementFnState.responseMode = "object"
  })

  it("generates stable unique ids for organizer and cohost competition functions", () => {
    const ids = competitionOperationSpecs.map((operation) => operation.id)
    expect(new Set(ids).size).toBe(ids.length)

    expect(ids).toEqual(
      expect.arrayContaining([
        "competitions.createCompetition",
        "competitionDetails.getCompetitionById",
        "divisions.addCompetitionDivision",
        "events.saveCompetitionEvent",
        "eventDivisionMappings.saveEventDivisionMappings",
        "workoutLibrary.getWorkouts",
        "movements.getAllMovements",
        "schedule.createHeat",
        "addresses.createAddress",
        "scores.saveCompetitionScore",
        "leaderboards.getCompetitionLeaderboard",
        "results.publishDivisionResults",
        "registrations.createManualRegistration",
        "purchaseTransfers.initiatePurchaseTransfer",
        "invites.issueInvites",
        "waivers.createWaiver",
        "volunteers.inviteVolunteer",
        "judgeScheduling.assignJudgeToHeat",
        "broadcasts.sendBroadcast",
        "pricingRevenue.updateCompetitionFeeConfig",
        "stripeConnect.getStripeConnectionStatus",
        "coupons.createCoupon",
        "sponsors.createSponsor",
        "cohosts.inviteCohost",
        "submissionVerification.verifySubmissionScore",
        "videoSubmissions.getOrganizerSubmissions",
        "reviewNotes.createReviewNote",
        "seriesDivisions.saveSeriesDivisionMappings",
        "seriesEvents.addEventToSeriesTemplate",
        "seriesCohosts.inviteSeriesCohost",
        "cohostSchedule.cohostCreateHeat",
      ]),
    )
  })

  it("executes compiled TanStack server functions through the server entrypoint", async () => {
    const input = { probe: true }

    await expect(
      callCompetitionOperation("movements.getAllMovements", input),
    ).resolves.toEqual({
      ok: true,
      data: input,
    })

    expect(movementFnState.directCalls).toBe(0)
    expect(movementFnState.serverCalls).toBe(1)
    expect(movementFnState.serverData).toEqual([input])
  })

  it("unwraps serialized Response values from compiled TanStack server functions", async () => {
    const input = { serialized: true }
    movementFnState.responseMode = "serialized-response"

    await expect(
      callCompetitionOperation("movements.getAllMovements", input),
    ).resolves.toEqual({
      ok: true,
      data: input,
    })

    expect(movementFnState.directCalls).toBe(0)
    expect(movementFnState.serverCalls).toBe(1)
    expect(movementFnState.serverData).toEqual([input])
  })
})
