import "server-only"

import { runWithStartContext } from "@tanstack/start-storage-context"
import * as addressFns from "@/server-fns/address-fns"
import * as broadcastFns from "@/server-fns/broadcast-fns"
import * as cohostCompetitionFns from "@/server-fns/cohost/cohost-competition-fns"
import * as cohostCouponFns from "@/server-fns/cohost/cohost-coupon-fns"
import * as cohostDivisionFns from "@/server-fns/cohost/cohost-division-fns"
import * as cohostEventFns from "@/server-fns/cohost/cohost-event-fns"
import * as cohostEventResourceFns from "@/server-fns/cohost/cohost-event-resources-fns"
import * as cohostJudgeRotationFns from "@/server-fns/cohost/cohost-judge-rotation-fns"
import * as cohostJudgingSheetFns from "@/server-fns/cohost/cohost-judging-sheet-fns"
import * as cohostLocationFns from "@/server-fns/cohost/cohost-location-fns"
import * as cohostPricingFns from "@/server-fns/cohost/cohost-pricing-fns"
import * as cohostRegistrationFns from "@/server-fns/cohost/cohost-registration-fns"
import * as cohostRegistrationQuestionFns from "@/server-fns/cohost/cohost-registration-questions-fns"
import * as cohostResultsFns from "@/server-fns/cohost/cohost-results-fns"
import * as cohostRevenueFns from "@/server-fns/cohost/cohost-revenue-fns"
import * as cohostReviewNoteFns from "@/server-fns/cohost/cohost-review-note-fns"
import * as cohostScheduleFns from "@/server-fns/cohost/cohost-schedule-fns"
import * as cohostScoringFns from "@/server-fns/cohost/cohost-scoring-fns"
import * as cohostSettingsFns from "@/server-fns/cohost/cohost-settings-fns"
import * as cohostSponsorFns from "@/server-fns/cohost/cohost-sponsor-fns"
import * as cohostSubmissionFns from "@/server-fns/cohost/cohost-submission-fns"
import * as cohostVolunteerFns from "@/server-fns/cohost/cohost-volunteer-fns"
import * as cohostWaiverFns from "@/server-fns/cohost/cohost-waiver-fns"
import * as cohostWorkoutFns from "@/server-fns/cohost/cohost-workout-fns"
import * as cohostFns from "@/server-fns/cohost-fns"
import * as commerceFns from "@/server-fns/commerce-fns"
import * as competitionDetailFns from "@/server-fns/competition-detail-fns"
import * as competitionDivisionFns from "@/server-fns/competition-divisions-fns"
import * as competitionEventFns from "@/server-fns/competition-event-fns"
import * as competitionFns from "@/server-fns/competition-fns"
import * as competitionHeatFns from "@/server-fns/competition-heats-fns"
import * as competitionInviteFns from "@/server-fns/competition-invite-fns"
import * as competitionScoreFns from "@/server-fns/competition-score-fns"
import * as competitionWorkoutFns from "@/server-fns/competition-workouts-fns"
import * as couponFns from "@/server-fns/coupon-fns"
import * as divisionResultsFns from "@/server-fns/division-results-fns"
import * as eventDivisionMappingFns from "@/server-fns/event-division-mapping-fns"
import * as eventResourceFns from "@/server-fns/event-resources-fns"
import * as judgeAssignmentFns from "@/server-fns/judge-assignment-fns"
import * as judgeRotationFns from "@/server-fns/judge-rotation-fns"
import * as judgeSchedulingFns from "@/server-fns/judge-scheduling-fns"
import * as judgingSheetFns from "@/server-fns/judging-sheet-fns"
import * as leaderboardFns from "@/server-fns/leaderboard-fns"
import * as movementFns from "@/server-fns/movement-fns"
import * as organizerAthleteFns from "@/server-fns/organizer-athlete-fns"
import * as purchaseTransferFns from "@/server-fns/purchase-transfer-fns"
import * as registrationFns from "@/server-fns/registration-fns"
import * as registrationQuestionFns from "@/server-fns/registration-questions-fns"
import * as reviewNoteFns from "@/server-fns/review-note-fns"
import * as seriesCohostFns from "@/server-fns/series-cohost-fns"
import * as seriesDivisionMappingFns from "@/server-fns/series-division-mapping-fns"
import * as seriesEventTemplateFns from "@/server-fns/series-event-template-fns"
import * as sponsorFns from "@/server-fns/sponsor-fns"
import * as stripeConnectFns from "@/server-fns/stripe-connect-fns"
import * as submissionVerificationFns from "@/server-fns/submission-verification-fns"
import * as videoSubmissionFns from "@/server-fns/video-submission-fns"
import * as videoValidationFns from "@/server-fns/video-validation-fns"
import * as videoVoteFns from "@/server-fns/video-vote-fns"
import * as volunteerFns from "@/server-fns/volunteer-fns"
import * as volunteerScheduleFns from "@/server-fns/volunteer-schedule-fns"
import * as volunteerShiftFns from "@/server-fns/volunteer-shift-fns"
import * as waiverFns from "@/server-fns/waiver-fns"
import * as workoutFns from "@/server-fns/workout-fns"

type ServerFnResult = {
  result?: unknown
  error?: unknown
}

type CrossJsonNode =
  | { t: 0; s: number }
  | { t: 1; s: string }
  | { t: 2; s: 0 | 1 | 2 | 3 }
  | { t: 9; a: CrossJsonNode[] }
  | { t: 10; p: { k: string[]; v: CrossJsonNode[] } }

type CompiledServerFnHandler = {
  __executeServer?: (opts: {
    data: unknown
    context: Record<string, unknown>
    headers: HeadersInit
    signal: AbortSignal
  }) => Promise<ServerFnResult | unknown>
}

type ServerFnHandler = ((args: { data: unknown }) => Promise<unknown>) &
  CompiledServerFnHandler
type ServerFnModule = Record<string, unknown>

export type CompetitionOperationMode = "read" | "write"

export interface CompetitionOperationSpec {
  id: string
  exportName: string
  category: string
  categoryTitle: string
  mode: CompetitionOperationMode
  source: string
  description: string
  input: string
}

interface OperationModule {
  category: string
  title: string
  source: string
  description: string
  module: ServerFnModule
}

interface CompetitionOperation extends CompetitionOperationSpec {
  handler: ServerFnHandler
}

const operationModules: OperationModule[] = [
  {
    category: "competitions",
    title: "Competitions",
    source: "src/server-fns/competition-fns.ts",
    description:
      "Create, update, list, and delete competitions and competition series.",
    module: competitionFns,
  },
  {
    category: "competitionDetails",
    title: "Competition Details",
    source: "src/server-fns/competition-detail-fns.ts",
    description:
      "Read competition details, registration counts, organizer athletes, settings, and delete competitions.",
    module: competitionDetailFns,
  },
  {
    category: "divisions",
    title: "Divisions",
    source: "src/server-fns/competition-divisions-fns.ts",
    description:
      "Manage competition divisions, division ordering, capacities, and scaling templates.",
    module: competitionDivisionFns,
  },
  {
    category: "events",
    title: "Events",
    source: "src/server-fns/competition-workouts-fns.ts",
    description:
      "Create, edit, reorder, remove, and describe competition workouts/events.",
    module: competitionWorkoutFns,
  },
  {
    category: "submissionWindows",
    title: "Submission Windows",
    source: "src/server-fns/competition-event-fns.ts",
    description:
      "Manage online competition event records and submission windows.",
    module: competitionEventFns,
  },
  {
    category: "workoutLibrary",
    title: "Workout Library",
    source: "src/server-fns/workout-fns.ts",
    description:
      "Search and manage reusable workouts used when building competition events.",
    module: workoutFns,
  },
  {
    category: "movements",
    title: "Movements",
    source: "src/server-fns/movement-fns.ts",
    description:
      "Read and manage movement metadata used by workouts, review notes, and judging sheets.",
    module: movementFns,
  },
  {
    category: "eventDivisionMappings",
    title: "Event-Division Mappings",
    source: "src/server-fns/event-division-mapping-fns.ts",
    description: "Control which divisions perform which competition events.",
    module: eventDivisionMappingFns,
  },
  {
    category: "schedule",
    title: "Schedule, Heats, and Locations",
    source: "src/server-fns/competition-heats-fns.ts",
    description:
      "Manage venues, heats, heat assignments, publishing, and schedule data.",
    module: competitionHeatFns,
  },
  {
    category: "addresses",
    title: "Addresses",
    source: "src/server-fns/address-fns.ts",
    description: "Create, update, and read address records used by venues.",
    module: addressFns,
  },
  {
    category: "scores",
    title: "Scores",
    source: "src/server-fns/competition-score-fns.ts",
    description: "Read score entry grids and create, update, or delete scores.",
    module: competitionScoreFns,
  },
  {
    category: "leaderboards",
    title: "Leaderboards",
    source: "src/server-fns/leaderboard-fns.ts",
    description:
      "Read public, organizer-preview, and event leaderboard data for results review.",
    module: leaderboardFns,
  },
  {
    category: "results",
    title: "Results Publishing",
    source: "src/server-fns/division-results-fns.ts",
    description: "Read and publish per-event division result visibility.",
    module: divisionResultsFns,
  },
  {
    category: "registrations",
    title: "Registrations",
    source: "src/server-fns/registration-fns.ts",
    description:
      "Manage registration payment, manual registration, removal, division transfer, refunds, and team invites.",
    module: registrationFns,
  },
  {
    category: "purchaseTransfers",
    title: "Purchase Transfers",
    source: "src/server-fns/purchase-transfer-fns.ts",
    description:
      "Initiate, cancel, and list registration purchase transfers for organizer athlete management.",
    module: purchaseTransferFns,
  },
  {
    category: "organizerAthletes",
    title: "Organizer Athlete Detail",
    source: "src/server-fns/organizer-athlete-fns.ts",
    description:
      "Manage per-registration athlete details, roster slots, answers, affiliates, scores, and videos.",
    module: organizerAthleteFns,
  },
  {
    category: "invites",
    title: "Competition Invites",
    source: "src/server-fns/competition-invite-fns.ts",
    description:
      "Manage invite sources, allocations, rosters, active invites, bespoke invitees, and sending invites.",
    module: competitionInviteFns,
  },
  {
    category: "waivers",
    title: "Waivers",
    source: "src/server-fns/waiver-fns.ts",
    description:
      "Manage waiver templates, signatures, ordering, and athlete signing.",
    module: waiverFns,
  },
  {
    category: "volunteers",
    title: "Volunteers",
    source: "src/server-fns/volunteer-fns.ts",
    description:
      "Manage volunteer roster, invitations, role types, score access, and assignments.",
    module: volunteerFns,
  },
  {
    category: "volunteerShifts",
    title: "Volunteer Shifts",
    source: "src/server-fns/volunteer-shift-fns.ts",
    description: "Create, edit, delete, and assign volunteers to shifts.",
    module: volunteerShiftFns,
  },
  {
    category: "volunteerSchedule",
    title: "Volunteer Schedule",
    source: "src/server-fns/volunteer-schedule-fns.ts",
    description: "Read volunteer schedule and membership data.",
    module: volunteerScheduleFns,
  },
  {
    category: "judgeScheduling",
    title: "Judge Scheduling",
    source: "src/server-fns/judge-scheduling-fns.ts",
    description:
      "Assign judges to heats, inspect conflicts, and read judge schedule data.",
    module: judgeSchedulingFns,
  },
  {
    category: "broadcasts",
    title: "Broadcasts",
    source: "src/server-fns/broadcast-fns.ts",
    description:
      "Preview audiences, send broadcasts, list broadcasts, and inspect delivery.",
    module: broadcastFns,
  },
  {
    category: "pricingRevenue",
    title: "Pricing and Revenue",
    source: "src/server-fns/commerce-fns.ts",
    description:
      "Manage registration fee configuration, division fees, Stripe status, and revenue stats.",
    module: commerceFns,
  },
  {
    category: "stripeConnect",
    title: "Stripe Connect",
    source: "src/server-fns/stripe-connect-fns.ts",
    description:
      "Manage organizer payout onboarding, account status, dashboard links, and balances.",
    module: stripeConnectFns,
  },
  {
    category: "coupons",
    title: "Coupons",
    source: "src/server-fns/coupon-fns.ts",
    description: "Create, list, validate, and deactivate competition coupons.",
    module: couponFns,
  },
  {
    category: "sponsors",
    title: "Sponsors",
    source: "src/server-fns/sponsor-fns.ts",
    description:
      "Manage sponsors, sponsor groups, sponsor ordering, and workout sponsor assignments.",
    module: sponsorFns,
  },
  {
    category: "cohosts",
    title: "Cohosts",
    source: "src/server-fns/cohost-fns.ts",
    description:
      "Manage cohost invites, active cohosts, permissions, and removal.",
    module: cohostFns,
  },
  {
    category: "eventResources",
    title: "Event Resources",
    source: "src/server-fns/event-resources-fns.ts",
    description:
      "Manage event resource links/files and their ordering for event detail pages.",
    module: eventResourceFns,
  },
  {
    category: "judgeAssignments",
    title: "Judge Assignment Versions",
    source: "src/server-fns/judge-assignment-fns.ts",
    description:
      "Read, publish, and roll back judge assignment versions for rotations.",
    module: judgeAssignmentFns,
  },
  {
    category: "judgeRotations",
    title: "Judge Rotations",
    source: "src/server-fns/judge-rotation-fns.ts",
    description:
      "Manage judge rotations, event defaults, batch edits, and occupied-lane adjustments.",
    module: judgeRotationFns,
  },
  {
    category: "judgingSheets",
    title: "Judging Sheets",
    source: "src/server-fns/judging-sheet-fns.ts",
    description: "Manage judging sheets attached to competition events.",
    module: judgingSheetFns,
  },
  {
    category: "submissionVerification",
    title: "Submission Verification",
    source: "src/server-fns/submission-verification-fns.ts",
    description:
      "Verify online submissions, enter adjusted scores, and manage verification logs.",
    module: submissionVerificationFns,
  },
  {
    category: "videoSubmissions",
    title: "Video Submissions",
    source: "src/server-fns/video-submission-fns.ts",
    description:
      "Read and manage athlete video submissions, review state, sibling submissions, and organizer video URLs.",
    module: videoSubmissionFns,
  },
  {
    category: "reviewNotes",
    title: "Review Notes",
    source: "src/server-fns/review-note-fns.ts",
    description:
      "Create, edit, delete, and list video review notes for online submission judging.",
    module: reviewNoteFns,
  },
  {
    category: "videoVotes",
    title: "Video Votes",
    source: "src/server-fns/video-vote-fns.ts",
    description:
      "Read video vote details, flagged submissions, and cast video votes when permitted.",
    module: videoVoteFns,
  },
  {
    category: "videoValidation",
    title: "Video Validation",
    source: "src/server-fns/video-validation-fns.ts",
    description:
      "Validate single or batch video URLs before accepting online submissions.",
    module: videoValidationFns,
  },
  {
    category: "registrationQuestions",
    title: "Registration Questions",
    source: "src/server-fns/registration-questions-fns.ts",
    description:
      "Manage athlete/volunteer registration questions, answers, and series questions.",
    module: registrationQuestionFns,
  },
  {
    category: "seriesDivisions",
    title: "Series Division Templates",
    source: "src/server-fns/series-division-mapping-fns.ts",
    description:
      "Manage series division templates, mappings, preview sync, and sync to competitions.",
    module: seriesDivisionMappingFns,
  },
  {
    category: "seriesEvents",
    title: "Series Event Templates",
    source: "src/server-fns/series-event-template-fns.ts",
    description:
      "Manage series event templates, event mappings, resource/sheet sync, and competition sync previews.",
    module: seriesEventTemplateFns,
  },
  {
    category: "seriesCohosts",
    title: "Series Cohosts",
    source: "src/server-fns/series-cohost-fns.ts",
    description:
      "Invite, list, remove, and update cohost permissions across a competition series.",
    module: seriesCohostFns,
  },
  {
    category: "cohostCompetition",
    title: "Cohost Competition",
    source: "src/server-fns/cohost/cohost-competition-fns.ts",
    description:
      "Cohost-scoped competition reads and settings writes under granted permissions.",
    module: cohostCompetitionFns,
  },
  {
    category: "cohostDivisions",
    title: "Cohost Divisions",
    source: "src/server-fns/cohost/cohost-division-fns.ts",
    description: "Cohost-scoped division and capacity management.",
    module: cohostDivisionFns,
  },
  {
    category: "cohostEvents",
    title: "Cohost Events",
    source: "src/server-fns/cohost/cohost-workout-fns.ts",
    description: "Cohost-scoped event/workout management.",
    module: cohostWorkoutFns,
  },
  {
    category: "cohostSubmissionWindows",
    title: "Cohost Submission Windows",
    source: "src/server-fns/cohost/cohost-event-fns.ts",
    description: "Cohost-scoped submission window management.",
    module: cohostEventFns,
  },
  {
    category: "cohostSchedule",
    title: "Cohost Schedule",
    source: "src/server-fns/cohost/cohost-schedule-fns.ts",
    description: "Cohost-scoped heat scheduling and schedule publishing.",
    module: cohostScheduleFns,
  },
  {
    category: "cohostLocations",
    title: "Cohost Locations",
    source: "src/server-fns/cohost/cohost-location-fns.ts",
    description: "Cohost-scoped venue/location management.",
    module: cohostLocationFns,
  },
  {
    category: "cohostScoring",
    title: "Cohost Scoring",
    source: "src/server-fns/cohost/cohost-scoring-fns.ts",
    description: "Cohost-scoped score entry and score deletion.",
    module: cohostScoringFns,
  },
  {
    category: "cohostResults",
    title: "Cohost Results",
    source: "src/server-fns/cohost/cohost-results-fns.ts",
    description: "Cohost-scoped result publishing.",
    module: cohostResultsFns,
  },
  {
    category: "cohostRegistrations",
    title: "Cohost Registrations",
    source: "src/server-fns/cohost/cohost-registration-fns.ts",
    description:
      "Cohost-scoped registration list, manual registration, removal, transfers, questions, and answers.",
    module: cohostRegistrationFns,
  },
  {
    category: "cohostRegistrationQuestions",
    title: "Cohost Registration Questions",
    source: "src/server-fns/cohost/cohost-registration-questions-fns.ts",
    description: "Cohost-scoped registration question management.",
    module: cohostRegistrationQuestionFns,
  },
  {
    category: "cohostWaivers",
    title: "Cohost Waivers",
    source: "src/server-fns/cohost/cohost-waiver-fns.ts",
    description: "Cohost-scoped waiver management.",
    module: cohostWaiverFns,
  },
  {
    category: "cohostVolunteers",
    title: "Cohost Volunteers",
    source: "src/server-fns/cohost/cohost-volunteer-fns.ts",
    description: "Cohost-scoped volunteers, shifts, invitations, and roles.",
    module: cohostVolunteerFns,
  },
  {
    category: "cohostSponsors",
    title: "Cohost Sponsors",
    source: "src/server-fns/cohost/cohost-sponsor-fns.ts",
    description: "Cohost-scoped sponsor and sponsor group management.",
    module: cohostSponsorFns,
  },
  {
    category: "cohostCoupons",
    title: "Cohost Coupons",
    source: "src/server-fns/cohost/cohost-coupon-fns.ts",
    description: "Cohost-scoped coupon management.",
    module: cohostCouponFns,
  },
  {
    category: "cohostPricing",
    title: "Cohost Pricing",
    source: "src/server-fns/cohost/cohost-pricing-fns.ts",
    description: "Cohost-scoped registration pricing management.",
    module: cohostPricingFns,
  },
  {
    category: "cohostRevenue",
    title: "Cohost Revenue",
    source: "src/server-fns/cohost/cohost-revenue-fns.ts",
    description: "Cohost-scoped revenue statistics.",
    module: cohostRevenueFns,
  },
  {
    category: "cohostReviewNotes",
    title: "Cohost Review Notes",
    source: "src/server-fns/cohost/cohost-review-note-fns.ts",
    description: "Cohost-scoped review notes and workout movement lookups.",
    module: cohostReviewNoteFns,
  },
  {
    category: "cohostSubmissions",
    title: "Cohost Submissions",
    source: "src/server-fns/cohost/cohost-submission-fns.ts",
    description: "Cohost-scoped video submission review and verification.",
    module: cohostSubmissionFns,
  },
  {
    category: "cohostEventResources",
    title: "Cohost Event Resources",
    source: "src/server-fns/cohost/cohost-event-resources-fns.ts",
    description: "Cohost-scoped event resource management.",
    module: cohostEventResourceFns,
  },
  {
    category: "cohostJudgeRotations",
    title: "Cohost Judge Rotations",
    source: "src/server-fns/cohost/cohost-judge-rotation-fns.ts",
    description:
      "Cohost-scoped judge rotations, publishing, rollback, and occupied-lane adjustments.",
    module: cohostJudgeRotationFns,
  },
  {
    category: "cohostJudgingSheets",
    title: "Cohost Judging Sheets",
    source: "src/server-fns/cohost/cohost-judging-sheet-fns.ts",
    description: "Cohost-scoped judging sheet management.",
    module: cohostJudgingSheetFns,
  },
  {
    category: "cohostSettings",
    title: "Cohost Settings",
    source: "src/server-fns/cohost/cohost-settings-fns.ts",
    description: "Cohost-scoped capacity, scoring, and rotation settings.",
    module: cohostSettingsFns,
  },
]

function isServerFunction(
  exportName: string,
  value: unknown,
): value is ServerFnHandler {
  return exportName.endsWith("Fn") && typeof value === "function"
}

function inferMode(exportName: string): CompetitionOperationMode {
  return /^(get|list|check|can|preview|validate|export|cohostGet|cohostList|cohostCheck|cohostCan|cohostPreview|cohostValidate)/.test(
    exportName,
  )
    ? "read"
    : "write"
}

function describeOperation(
  moduleInfo: OperationModule,
  exportName: string,
): string {
  const base = exportName.replace(/Fn$/, "")
  return `${moduleInfo.description} Calls ${exportName}; use operation id "${moduleInfo.category}.${base}".`
}

function buildOperations(): CompetitionOperation[] {
  return operationModules.flatMap((moduleInfo) =>
    Object.entries(moduleInfo.module)
      .filter(([exportName, value]) => isServerFunction(exportName, value))
      .map(([exportName, handler]) => {
        const base = exportName.replace(/Fn$/, "")
        return {
          id: `${moduleInfo.category}.${base}`,
          exportName,
          category: moduleInfo.category,
          categoryTitle: moduleInfo.title,
          mode: inferMode(exportName),
          source: moduleInfo.source,
          description: describeOperation(moduleInfo, exportName),
          input:
            "Pass the same data object this TanStack server function expects. Do not wrap it in { data }; wodsmith.call does that for you.",
          handler: handler as ServerFnHandler,
        }
      }),
  )
}

const operations = buildOperations()
const operationsById = new Map(
  operations.map((operation) => [operation.id, operation]),
)

function createMcpStartContext(request?: Request) {
  return {
    getRouter: async () => {
      throw new Error("Router is not available during MCP operation execution")
    },
    startOptions: {
      functionMiddleware: [],
      serializationAdapters: [],
    },
    contextAfterGlobalMiddlewares: {},
    request:
      request ??
      new Request("https://wodsmith-mcp.internal/operation", {
        method: "POST",
      }),
    executedRequestMiddlewares: new Set(),
  }
}

async function callServerFunction(
  handler: ServerFnHandler,
  input: unknown,
  request?: Request,
): Promise<unknown> {
  const executeServer = handler.__executeServer
  if (typeof executeServer === "function") {
    const abortController = new AbortController()
    const response = await runWithStartContext(
      createMcpStartContext(request),
      () =>
        executeServer({
          data: input ?? {},
          context: {},
          headers: {},
          signal: abortController.signal,
        }),
    )

    return unwrapServerFunctionResponse(response)
  }

  return handler({ data: input ?? {} })
}

async function unwrapServerFunctionResponse(
  response: ServerFnResult | Response | unknown,
): Promise<unknown> {
  if (response instanceof Response) {
    if (!response.ok) {
      throw new Error(`Server function failed with status ${response.status}`)
    }

    const contentType = response.headers.get("Content-Type") ?? ""
    const isSerialized = response.headers.has("x-tss-serialized")

    if (isSerialized && contentType.includes("application/json")) {
      const payload = await response.json()
      const unwrapped = fromSimpleCrossJson(payload as CrossJsonNode)
      return unwrapServerFunctionResponse(unwrapped)
    }

    if (contentType.includes("application/json")) {
      return response.json()
    }

    return response
  }

  if (
    response &&
    typeof response === "object" &&
    "error" in response &&
    response.error
  ) {
    throw response.error
  }

  if (response && typeof response === "object" && "result" in response) {
    return response.result
  }

  return response
}

function fromSimpleCrossJson(node: CrossJsonNode): unknown {
  switch (node.t) {
    case 0:
    case 1:
      return node.s
    case 2:
      if (node.s === 0) return null
      if (node.s === 1) return undefined
      if (node.s === 2) return true
      return false
    case 9:
      return node.a.map(fromSimpleCrossJson)
    case 10:
      return Object.fromEntries(
        node.p.k.map((key, index) => [
          key,
          fromSimpleCrossJson(node.p.v[index] as CrossJsonNode),
        ]),
      )
    default:
      throw new Error("Unsupported serialized server function result")
  }
}

export const competitionOperationSpecs: CompetitionOperationSpec[] =
  operations.map(({ handler: _handler, ...spec }) => spec)

export function listCompetitionOperationSpecs(): CompetitionOperationSpec[] {
  return competitionOperationSpecs
}

export async function callCompetitionOperation(
  operationId: string,
  input: unknown,
  request?: Request,
): Promise<unknown> {
  const operation = operationsById.get(operationId)
  if (!operation) {
    throw new Error(`Unknown competition operation: ${operationId}`)
  }

  return callServerFunction(operation.handler, input, request)
}
