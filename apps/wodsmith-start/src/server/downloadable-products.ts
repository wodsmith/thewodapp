import "server-only"

import { and, eq, inArray } from "drizzle-orm"
import { getDb } from "@/db"
import {
  COMMERCE_PRODUCT_TYPE,
  COMMERCE_PURCHASE_STATUS,
  COMPETITION_PRODUCT_ACCESS,
  COMPETITION_PRODUCT_DELIVERY,
  COMPETITION_PRODUCT_STATUS,
  type CompetitionProductAccess,
  commerceProductTable,
  commercePurchaseTable,
  competitionProductFilesTable,
  competitionProductsTable,
  competitionRegistrationsTable,
  competitionsTable,
  REGISTRATION_STATUS,
  teamMembershipTable,
} from "@/db/schema"
import { hasDownloadEntitlement } from "@/utils/download-entitlement"

export interface DownloadableProduct {
  id: string
  name: string
  description: string | null
  access: CompetitionProductAccess
  competition: {
    id: string
    name: string
    slug: string
  }
  files: Array<{
    id: string
    title: string
    originalFilename: string
    fileSize: number
    mimeType: string
  }>
}

async function getRegisteredCompetitionIds(
  userId: string,
): Promise<Set<string>> {
  const db = getDb()
  const [directRegistrations, memberships] = await Promise.all([
    db.query.competitionRegistrationsTable.findMany({
      where: and(
        eq(competitionRegistrationsTable.userId, userId),
        eq(competitionRegistrationsTable.status, REGISTRATION_STATUS.ACTIVE),
      ),
      columns: { eventId: true },
    }),
    db.query.teamMembershipTable.findMany({
      where: and(
        eq(teamMembershipTable.userId, userId),
        eq(teamMembershipTable.isActive, true),
      ),
      columns: { teamId: true },
    }),
  ])

  const competitionIds = new Set(directRegistrations.map((row) => row.eventId))
  const teamIds = memberships.map((membership) => membership.teamId)
  if (teamIds.length > 0) {
    const teamRegistrations =
      await db.query.competitionRegistrationsTable.findMany({
        where: and(
          inArray(competitionRegistrationsTable.athleteTeamId, teamIds),
          eq(competitionRegistrationsTable.status, REGISTRATION_STATUS.ACTIVE),
        ),
        columns: { eventId: true },
      })
    for (const row of teamRegistrations) competitionIds.add(row.eventId)
  }
  return competitionIds
}

async function getPurchasedDownloadProductIds(
  userId: string,
): Promise<Set<string>> {
  const db = getDb()
  const rows = await db
    .select({ productId: commerceProductTable.resourceId })
    .from(commercePurchaseTable)
    .innerJoin(
      commerceProductTable,
      eq(commercePurchaseTable.productId, commerceProductTable.id),
    )
    .where(
      and(
        eq(commercePurchaseTable.userId, userId),
        eq(commercePurchaseTable.status, COMMERCE_PURCHASE_STATUS.COMPLETED),
        eq(commerceProductTable.type, COMMERCE_PRODUCT_TYPE.ADDON),
      ),
    )
  return new Set(rows.map((row) => row.productId))
}

export async function canUserAccessCompetitionProduct(
  userId: string,
  product: { id: string; competitionId: string; access: string },
): Promise<boolean> {
  const needsRegistration =
    product.access === COMPETITION_PRODUCT_ACCESS.INCLUDED_WITH_REGISTRATION
  const registeredCompetitionIds = needsRegistration
    ? await getRegisteredCompetitionIds(userId)
    : new Set<string>()
  const purchasedProductIds = needsRegistration
    ? new Set<string>()
    : await getPurchasedDownloadProductIds(userId)
  return hasDownloadEntitlement(product, {
    registeredCompetitionIds,
    purchasedProductIds,
  })
}

export async function getUserDownloadableProducts(
  userId: string,
): Promise<DownloadableProduct[]> {
  const db = getDb()
  const [registeredCompetitionIds, purchasedProductIds] = await Promise.all([
    getRegisteredCompetitionIds(userId),
    getPurchasedDownloadProductIds(userId),
  ])

  const [includedProducts, purchasedProducts] = await Promise.all([
    registeredCompetitionIds.size > 0
      ? db.query.competitionProductsTable.findMany({
          where: and(
            eq(
              competitionProductsTable.delivery,
              COMPETITION_PRODUCT_DELIVERY.DOWNLOAD,
            ),
            eq(
              competitionProductsTable.access,
              COMPETITION_PRODUCT_ACCESS.INCLUDED_WITH_REGISTRATION,
            ),
            eq(
              competitionProductsTable.status,
              COMPETITION_PRODUCT_STATUS.ACTIVE,
            ),
            inArray(competitionProductsTable.competitionId, [
              ...registeredCompetitionIds,
            ]),
          ),
        })
      : Promise.resolve([]),
    purchasedProductIds.size > 0
      ? db.query.competitionProductsTable.findMany({
          where: and(
            eq(
              competitionProductsTable.delivery,
              COMPETITION_PRODUCT_DELIVERY.DOWNLOAD,
            ),
            eq(
              competitionProductsTable.access,
              COMPETITION_PRODUCT_ACCESS.OPTIONAL_PURCHASE,
            ),
            inArray(competitionProductsTable.id, [...purchasedProductIds]),
          ),
        })
      : Promise.resolve([]),
  ])

  const products = [...includedProducts, ...purchasedProducts].filter(
    (product, index, all) =>
      all.findIndex((candidate) => candidate.id === product.id) === index,
  )
  if (products.length === 0) return []

  const [files, competitions] = await Promise.all([
    db.query.competitionProductFilesTable.findMany({
      where: inArray(
        competitionProductFilesTable.productId,
        products.map((product) => product.id),
      ),
    }),
    db.query.competitionsTable.findMany({
      where: inArray(competitionsTable.id, [
        ...new Set(products.map((product) => product.competitionId)),
      ]),
      columns: { id: true, name: true, slug: true },
    }),
  ])
  const competitionById = new Map(
    competitions.map((competition) => [competition.id, competition]),
  )

  const downloads: DownloadableProduct[] = []
  for (const product of products) {
    const competition = competitionById.get(product.competitionId)
    if (!competition) continue
    downloads.push({
      id: product.id,
      name: product.name,
      description: product.description,
      access: product.access,
      competition,
      files: files
        .filter((file) => file.productId === product.id)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((file) => ({
          id: file.id,
          title: file.title,
          originalFilename: file.originalFilename,
          fileSize: file.fileSize,
          mimeType: file.mimeType,
        })),
    })
  }
  return downloads.sort(
    (a, b) =>
      a.competition.name.localeCompare(b.competition.name) ||
      a.name.localeCompare(b.name),
  )
}

export async function getAuthorizedDownloadFile(
  userId: string,
  fileId: string,
) {
  const db = getDb()
  const file = await db.query.competitionProductFilesTable.findFirst({
    where: eq(competitionProductFilesTable.id, fileId),
  })
  if (!file) return null
  const product = await db.query.competitionProductsTable.findFirst({
    where: and(
      eq(competitionProductsTable.id, file.productId),
      eq(
        competitionProductsTable.delivery,
        COMPETITION_PRODUCT_DELIVERY.DOWNLOAD,
      ),
    ),
  })
  if (!product) return null
  if (!(await canUserAccessCompetitionProduct(userId, product))) return null
  return file
}
