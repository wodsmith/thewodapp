import { and, asc, eq, inArray, ne } from "drizzle-orm"
import { type Database, getDb } from "@/db"
import {
  benchmarkBatteriesTable,
  benchmarkTestsTable,
  benchmarkTierThresholdsTable,
} from "@/db/schemas/benchmarks"
import {
  createCompetitionRegistrationId,
  createTeamMembershipId,
} from "@/db/schemas/common"
import {
  competitionRegistrationsTable,
  competitionsTable,
  REGISTRATION_STATUS,
} from "@/db/schemas/competitions"
import { trackWorkoutsTable } from "@/db/schemas/programming"
import { scalingLevelsTable } from "@/db/schemas/scaling"
import { scoresTable } from "@/db/schemas/scores"
import { SYSTEM_ROLES_ENUM, teamMembershipTable } from "@/db/schemas/teams"
import { userTable } from "@/db/schemas/users"
import { videoSubmissionsTable } from "@/db/schemas/video-submissions"
import { waiverSignaturesTable, waiversTable } from "@/db/schemas/waivers"
import type { TiebreakScheme } from "@/db/schemas/workouts"
import {
  type AbsoluteTierEventTable,
  BenchmarkConfigError,
  calculateAbsoluteTier,
} from "@/lib/scoring/algorithms"
import { getSortDirection } from "@/lib/scoring/sort/direction"
import type { ScoreType, WorkoutScheme } from "@/lib/scoring/types"
import {
  benchmarkVariantSchema,
  type BenchmarkVariant,
  type BenchmarkVideoPolicy,
} from "@/schemas/benchmark.schema"
import { parseCompetitionSettings } from "@/utils/competition-settings"
import { checkBenchmarkOpenJoinRateLimit } from "./benchmark-open-join-rate-limit"

export interface BenchmarkSubmissionContext {
  batteryId: string
  competitionId: string
  competitionTeamId: string
  openDivisionId: string
  openDivisionTeamSize: number
  videoPolicy: BenchmarkVideoPolicy
  isOpenJoin: boolean
  testId: string
  competitionStatus: "draft" | "published" | string
  competitionVisibility: "public" | "private" | string
  batteryStatus: "draft" | "published" | "archived" | string
}

export interface BenchmarkRegistration {
  id: string
  divisionId: string | null
  captainUserId: string | null
  athleteTeamId: string | null
  isCaptain: boolean
}

export interface BenchmarkScoreWriteInput {
  userId: string
  teamId: string
  workoutId: string
  competitionEventId: string
  scheme: WorkoutScheme
  scoreType: ScoreType
  scoreValue: number | null
  status: "scored" | "cap"
  statusOrder: number
  sortKey: string | null
  tiebreakScheme: TiebreakScheme | null
  tiebreakValue: number | null
  timeCapMs: number | null
  secondaryValue: number | null
  recordedAt: Date
}

export interface BenchmarkScoreWriteResult {
  written: boolean
  retainedCurrentBest: boolean
  scoreId?: string
  candidateTier: number
  existingTier?: number
}

interface ExistingBenchmarkScore {
  id: string
  scoreValue: number | null
  status: string
  benchmarkVariant: string | null
  verificationStatus: string | null
}

type BenchmarkScoreDb = Pick<Database, "insert" | "select" | "update">

export async function isBenchmarkCompetition(
  competitionId: string,
): Promise<boolean> {
  const db = getDb()
  const [battery] = await db
    .select({ id: benchmarkBatteriesTable.id })
    .from(benchmarkBatteriesTable)
    .where(eq(benchmarkBatteriesTable.competitionId, competitionId))
    .limit(1)

  if (battery) return true

  const [competition] = await db
    .select({ competitionType: competitionsTable.competitionType })
    .from(competitionsTable)
    .where(eq(competitionsTable.id, competitionId))
    .limit(1)

  return competition?.competitionType === "benchmark"
}

export async function getBenchmarkSubmissionContext(
  competitionId: string,
  trackWorkoutId: string,
): Promise<BenchmarkSubmissionContext | null> {
  const db = getDb()
  const [battery] = await db
    .select({
      batteryId: benchmarkBatteriesTable.id,
      videoPolicy: benchmarkBatteriesTable.videoPolicy,
      isOpenJoin: benchmarkBatteriesTable.isOpenJoin,
      batteryStatus: benchmarkBatteriesTable.status,
      competitionTeamId: competitionsTable.competitionTeamId,
      competitionStatus: competitionsTable.status,
      competitionVisibility: competitionsTable.visibility,
      competitionSettings: competitionsTable.settings,
    })
    .from(benchmarkBatteriesTable)
    .innerJoin(
      competitionsTable,
      eq(benchmarkBatteriesTable.competitionId, competitionsTable.id),
    )
    .where(eq(benchmarkBatteriesTable.competitionId, competitionId))
    .limit(1)

  if (!battery) return null

  const settings = parseCompetitionSettings(battery.competitionSettings)
  const scalingGroupId = settings?.divisions?.scalingGroupId
  if (!scalingGroupId) {
    throw new BenchmarkConfigError(
      "Benchmark competition is missing an Open division scaling group",
    )
  }

  const openDivisions = await db
    .select({
      id: scalingLevelsTable.id,
      teamSize: scalingLevelsTable.teamSize,
    })
    .from(scalingLevelsTable)
    .where(eq(scalingLevelsTable.scalingGroupId, scalingGroupId))
    .orderBy(asc(scalingLevelsTable.position))

  if (openDivisions.length !== 1) {
    throw new BenchmarkConfigError(
      "Benchmark competitions must have exactly one Open division",
    )
  }

  const [test] = await db
    .select({
      id: benchmarkTestsTable.id,
      includedInScoring: benchmarkTestsTable.includedInScoring,
    })
    .from(trackWorkoutsTable)
    .innerJoin(
      benchmarkTestsTable,
      eq(trackWorkoutsTable.benchmarkTestId, benchmarkTestsTable.id),
    )
    .where(
      and(
        eq(trackWorkoutsTable.id, trackWorkoutId),
        eq(benchmarkTestsTable.batteryId, battery.batteryId),
      ),
    )
    .limit(1)

  if (!test) {
    throw new BenchmarkConfigError(
      "Benchmark event is missing its source benchmark test",
    )
  }

  if (!test.includedInScoring) {
    throw new BenchmarkConfigError(
      "Deferred benchmark tests cannot receive scored submissions",
    )
  }

  return {
    batteryId: battery.batteryId,
    competitionId,
    competitionTeamId: battery.competitionTeamId,
    openDivisionId: openDivisions[0].id,
    openDivisionTeamSize: openDivisions[0].teamSize,
    videoPolicy: battery.videoPolicy,
    isOpenJoin: battery.isOpenJoin,
    testId: test.id,
    competitionStatus: battery.competitionStatus,
    competitionVisibility: battery.competitionVisibility,
    batteryStatus: battery.batteryStatus,
  }
}

export async function getBenchmarkProfileVariant(
  userId: string,
): Promise<BenchmarkVariant> {
  const db = getDb()
  const [user] = await db
    .select({ gender: userTable.gender })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1)

  const parsed = benchmarkVariantSchema.safeParse(user?.gender)
  if (!parsed.success) {
    throw new Error("Complete your athlete profile gender before submitting")
  }

  return parsed.data
}

export async function ensureBenchmarkOpenJoinRegistration({
  context,
  userId,
  now = new Date(),
}: {
  context: BenchmarkSubmissionContext
  userId: string
  now?: Date
}): Promise<BenchmarkRegistration> {
  if (!context.isOpenJoin) {
    throw new Error(
      "You must be registered for this benchmark before submitting",
    )
  }

  assertBenchmarkBoardOpenForSubmissions(context)

  if (context.openDivisionTeamSize !== 1) {
    throw new BenchmarkConfigError(
      "Benchmark submissions only support individual Open divisions",
    )
  }

  const rateLimit = await checkBenchmarkOpenJoinRateLimit({
    userId,
    competitionId: context.competitionId,
    now,
  })
  if (!rateLimit.allowed) {
    throw new Error("Too many benchmark join attempts. Please try again later.")
  }

  await assertRequiredWaiversSigned({
    competitionId: context.competitionId,
    userId,
  })

  const db = getDb()
  const registration = await db.transaction(async (tx) => {
    const [existingRegistration] = await tx
      .select({
        id: competitionRegistrationsTable.id,
        divisionId: competitionRegistrationsTable.divisionId,
        captainUserId: competitionRegistrationsTable.captainUserId,
        athleteTeamId: competitionRegistrationsTable.athleteTeamId,
      })
      .from(competitionRegistrationsTable)
      .where(
        and(
          eq(competitionRegistrationsTable.eventId, context.competitionId),
          eq(competitionRegistrationsTable.userId, userId),
          eq(competitionRegistrationsTable.divisionId, context.openDivisionId),
          ne(competitionRegistrationsTable.status, REGISTRATION_STATUS.REMOVED),
        ),
      )
      .limit(1)

    if (existingRegistration) {
      return { ...existingRegistration, isCaptain: true }
    }

    const [existingMembership] = await tx
      .select({ id: teamMembershipTable.id })
      .from(teamMembershipTable)
      .where(
        and(
          eq(teamMembershipTable.teamId, context.competitionTeamId),
          eq(teamMembershipTable.userId, userId),
          eq(teamMembershipTable.isActive, true),
        ),
      )
      .limit(1)

    const teamMemberId = existingMembership?.id ?? createTeamMembershipId()
    if (!existingMembership) {
      await tx.insert(teamMembershipTable).values({
        id: teamMemberId,
        teamId: context.competitionTeamId,
        userId,
        roleId: SYSTEM_ROLES_ENUM.MEMBER,
        isSystemRole: true,
        joinedAt: now,
        isActive: true,
      })
    }

    await tx
      .insert(competitionRegistrationsTable)
      .values({
        id: createCompetitionRegistrationId(),
        eventId: context.competitionId,
        userId,
        teamMemberId,
        divisionId: context.openDivisionId,
        registeredAt: now,
        captainUserId: userId,
        athleteTeamId: null,
        metadata: JSON.stringify({ benchmarkOpenJoin: true }),
      })
      .onDuplicateKeyUpdate({ set: { updatedAt: now } })

    const [createdRegistration] = await tx
      .select({
        id: competitionRegistrationsTable.id,
        divisionId: competitionRegistrationsTable.divisionId,
        captainUserId: competitionRegistrationsTable.captainUserId,
        athleteTeamId: competitionRegistrationsTable.athleteTeamId,
      })
      .from(competitionRegistrationsTable)
      .where(
        and(
          eq(competitionRegistrationsTable.eventId, context.competitionId),
          eq(competitionRegistrationsTable.userId, userId),
          eq(competitionRegistrationsTable.divisionId, context.openDivisionId),
          ne(competitionRegistrationsTable.status, REGISTRATION_STATUS.REMOVED),
        ),
      )
      .limit(1)

    if (!createdRegistration) {
      throw new Error("Failed to join benchmark board")
    }

    return { ...createdRegistration, isCaptain: true }
  })

  return registration
}

export async function saveBenchmarkScore({
  context,
  variant,
  score,
  now = new Date(),
}: {
  context: BenchmarkSubmissionContext
  variant: BenchmarkVariant
  score: BenchmarkScoreWriteInput
  now?: Date
}): Promise<BenchmarkScoreWriteResult> {
  const db = getDb()
  return db.transaction((tx) =>
    saveBenchmarkScoreInTransaction({
      db: tx,
      context,
      variant,
      score,
      now,
    }),
  )
}

export async function saveBenchmarkScoreInTransaction({
  db,
  context,
  variant,
  score,
  now = new Date(),
}: {
  db: BenchmarkScoreDb
  context: BenchmarkSubmissionContext
  variant: BenchmarkVariant
  score: BenchmarkScoreWriteInput
  now?: Date
}): Promise<BenchmarkScoreWriteResult> {
  if (score.scoreValue === null) {
    throw new Error("A score is required when submitting")
  }
  const candidateValue = score.scoreValue

  assertBenchmarkBoardOpenForSubmissions(context)

  const table = await loadAbsoluteTierTable(context.testId, score.scoreType)
  const candidateTier = calculateAbsoluteTier(
    {
      userId: score.userId,
      value: candidateValue,
      status: score.status,
      variant,
    },
    table,
    score.scheme,
  )

  const [existingScore] = await db
    .select({
      id: scoresTable.id,
      scoreValue: scoresTable.scoreValue,
      status: scoresTable.status,
      benchmarkVariant: scoresTable.benchmarkVariant,
      verificationStatus: scoresTable.verificationStatus,
    })
    .from(scoresTable)
    .where(
      and(
        eq(scoresTable.competitionEventId, score.competitionEventId),
        eq(scoresTable.userId, score.userId),
        eq(scoresTable.scalingLevelId, context.openDivisionId),
      ),
    )
    .for("update")
    .limit(1)

  const existingTier = existingScore
    ? calculateExistingTier({
        existingScore,
        table,
        scheme: score.scheme,
      })
    : undefined

  if (
    existingScore &&
    existingTier !== undefined &&
    !doesBenchmarkScoreImprove({
      candidateTier,
      candidateValue,
      existingTier,
      existingValue: existingScore.scoreValue,
      scheme: score.scheme,
      scoreType: score.scoreType,
    })
  ) {
    return {
      written: false,
      retainedCurrentBest: true,
      scoreId: existingScore.id,
      candidateTier,
      existingTier,
    }
  }

  const scoreValues = {
    userId: score.userId,
    teamId: score.teamId,
    workoutId: score.workoutId,
    competitionEventId: score.competitionEventId,
    scheme: score.scheme,
    scoreType: score.scoreType,
    scoreValue: candidateValue,
    status: score.status,
    statusOrder: score.statusOrder,
    sortKey: score.sortKey,
    tiebreakScheme: score.tiebreakScheme,
    tiebreakValue: score.tiebreakValue,
    timeCapMs: score.timeCapMs,
    secondaryValue: score.secondaryValue,
    scalingLevelId: context.openDivisionId,
    benchmarkVariant: variant,
    asRx: true,
    recordedAt: score.recordedAt,
  }

  if (existingScore) {
    await db
      .update(scoresTable)
      .set({
        ...scoreValues,
        verificationStatus: null,
        verifiedAt: null,
        verifiedByUserId: null,
        penaltyType: null,
        penaltyPercentage: null,
        noRepCount: null,
        updatedAt: now,
      })
      .where(eq(scoresTable.id, existingScore.id))

    return {
      written: true,
      retainedCurrentBest: false,
      scoreId: existingScore.id,
      candidateTier,
      existingTier,
    }
  }

  await db.insert(scoresTable).values(scoreValues)

  return {
    written: true,
    retainedCurrentBest: false,
    candidateTier,
  }
}

export async function isBenchmarkVideoEvidenceRequired({
  context,
  variant,
  score,
}: {
  context: BenchmarkSubmissionContext
  variant: BenchmarkVariant
  score: BenchmarkScoreWriteInput
}): Promise<boolean> {
  if (context.videoPolicy === "never") return false
  if (context.videoPolicy === "always") return true

  if (score.scoreValue === null) {
    throw new Error("A score is required when submitting")
  }

  const table = await loadAbsoluteTierTable(context.testId, score.scoreType)
  const candidateTier = calculateAbsoluteTier(
    {
      userId: score.userId,
      value: score.scoreValue,
      status: score.status,
      variant,
    },
    table,
    score.scheme,
  )
  const thresholds = table.thresholdsByVariant.get(variant)
  const topTier = Math.max(...(thresholds ?? []).map((row) => row.tier))

  return candidateTier >= topTier
}

export async function resetBenchmarkVideoReviewState(
  submissionId: string,
  now = new Date(),
  db: Pick<Database, "update"> = getDb(),
): Promise<void> {
  await db
    .update(videoSubmissionsTable)
    .set({
      reviewStatus: "pending",
      statusUpdatedAt: now,
      reviewerNotes: null,
      reviewedAt: null,
      reviewedBy: null,
      updatedAt: now,
    })
    .where(eq(videoSubmissionsTable.id, submissionId))
}

function assertBenchmarkBoardOpenForSubmissions(
  context: BenchmarkSubmissionContext,
) {
  if (
    context.batteryStatus !== "published" ||
    context.competitionStatus !== "published" ||
    context.competitionVisibility !== "public"
  ) {
    throw new Error("This benchmark board is not open for submissions")
  }
}

async function assertRequiredWaiversSigned({
  competitionId,
  userId,
}: {
  competitionId: string
  userId: string
}) {
  const db = getDb()
  const requiredWaivers = await db
    .select({ id: waiversTable.id })
    .from(waiversTable)
    .where(
      and(
        eq(waiversTable.competitionId, competitionId),
        eq(waiversTable.required, true),
      ),
    )

  if (requiredWaivers.length === 0) return

  const waiverIds = requiredWaivers.map((waiver) => waiver.id)
  const signedWaivers = await db
    .select({ waiverId: waiverSignaturesTable.waiverId })
    .from(waiverSignaturesTable)
    .where(
      and(
        eq(waiverSignaturesTable.userId, userId),
        inArray(waiverSignaturesTable.waiverId, waiverIds),
      ),
    )

  const signedIds = new Set(
    signedWaivers.map((signature) => signature.waiverId),
  )
  if (waiverIds.some((waiverId) => !signedIds.has(waiverId))) {
    throw new Error(
      "Please sign required waivers before joining this benchmark",
    )
  }
}

async function loadAbsoluteTierTable(
  testId: string,
  scoreType: ScoreType,
): Promise<AbsoluteTierEventTable> {
  const db = getDb()
  const thresholdRows = await db
    .select({
      variant: benchmarkTierThresholdsTable.variant,
      tier: benchmarkTierThresholdsTable.tier,
      value: benchmarkTierThresholdsTable.thresholdValue,
    })
    .from(benchmarkTierThresholdsTable)
    .where(eq(benchmarkTierThresholdsTable.testId, testId))
    .orderBy(asc(benchmarkTierThresholdsTable.tier))

  if (thresholdRows.length === 0) {
    throw new BenchmarkConfigError(
      `Missing benchmark thresholds for test ${testId}`,
    )
  }

  const thresholdsByVariant = new Map<
    string,
    { tier: number; value: number }[]
  >()
  for (const row of thresholdRows) {
    const rows = thresholdsByVariant.get(row.variant) ?? []
    rows.push({ tier: row.tier, value: row.value })
    thresholdsByVariant.set(row.variant, rows)
  }

  return {
    scoreType,
    thresholdsByVariant,
  }
}

function calculateExistingTier({
  existingScore,
  table,
  scheme,
}: {
  existingScore: ExistingBenchmarkScore
  table: AbsoluteTierEventTable
  scheme: WorkoutScheme
}): number {
  if (
    existingScore.verificationStatus === "invalid" ||
    existingScore.scoreValue === null ||
    !existingScore.benchmarkVariant
  ) {
    return 0
  }

  return calculateAbsoluteTier(
    {
      userId: "existing",
      value: existingScore.scoreValue,
      status: existingScore.status === "cap" ? "cap" : "scored",
      variant: existingScore.benchmarkVariant,
    },
    table,
    scheme,
  )
}

function doesBenchmarkScoreImprove({
  candidateTier,
  candidateValue,
  existingTier,
  existingValue,
  scheme,
  scoreType,
}: {
  candidateTier: number
  candidateValue: number
  existingTier: number
  existingValue: number | null
  scheme: WorkoutScheme
  scoreType: ScoreType
}) {
  if (candidateTier !== existingTier) {
    return candidateTier > existingTier
  }

  if (existingValue === null) return true

  const sortDirection = getSortDirection(scheme, scoreType)
  return sortDirection === "asc"
    ? candidateValue < existingValue
    : candidateValue > existingValue
}
