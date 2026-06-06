import { and, eq } from "drizzle-orm"
import type { Database } from "@/db"
import { competitionsTable } from "@/db/schema"
import {
  createWaiverSignatureId,
  waiverSignaturesTable,
  waiversTable,
} from "@/db/schemas/waivers"

type VolunteerWaiverDb = Pick<Database, "insert" | "query">

export async function signRequiredVolunteerWaivers({
  db,
  userId,
  competitionTeamId,
  waiverIds = [],
  missingWaiverMessage = "Please agree to all required waivers before volunteering",
}: {
  db: VolunteerWaiverDb
  userId: string
  competitionTeamId: string
  waiverIds?: string[]
  missingWaiverMessage?: string
}) {
  const competition = await db.query.competitionsTable.findFirst({
    where: eq(competitionsTable.competitionTeamId, competitionTeamId),
  })

  if (!competition) {
    throw new Error("Competition not found")
  }

  const requiredWaivers = await db.query.waiversTable.findMany({
    where: and(
      eq(waiversTable.competitionId, competition.id),
      eq(waiversTable.requiredForVolunteers, true),
    ),
  })
  const requiredIds = new Set(requiredWaivers.map((waiver) => waiver.id))
  const signedIds = new Set(waiverIds)

  for (const waiver of requiredWaivers) {
    if (!signedIds.has(waiver.id)) {
      throw new Error(missingWaiverMessage)
    }
  }

  for (const waiverId of signedIds) {
    if (!requiredIds.has(waiverId)) continue

    const existingSignature = await db.query.waiverSignaturesTable.findFirst({
      where: and(
        eq(waiverSignaturesTable.waiverId, waiverId),
        eq(waiverSignaturesTable.userId, userId),
      ),
    })
    if (existingSignature) continue

    await db.insert(waiverSignaturesTable).values({
      id: createWaiverSignatureId(),
      waiverId,
      userId,
      registrationId: null,
      signedAt: new Date(),
    })
  }
}
