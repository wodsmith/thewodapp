/**
 * Competition Add-on (Merch) Server Functions
 *
 * Organizer CRUD for the registration add-on catalog, the athlete-facing
 * catalog, and fulfillment reporting. Selling add-ons is gated behind the
 * `registration_addons` team feature entitlement, granted per organizing
 * team by platform admins via /admin/entitlements.
 */

import { createServerFn } from "@tanstack/react-start"
import { and, asc, eq, gt, inArray, or, sql } from "drizzle-orm"
import { z } from "zod"
import { FEATURES } from "@/config/features"
import { getDb } from "@/db"
import {
  COMMERCE_PRODUCT_TYPE,
  COMMERCE_PURCHASE_STATUS,
  COMPETITION_PRODUCT_ACCESS,
  COMPETITION_PRODUCT_DELIVERY,
  COMPETITION_PRODUCT_FILE_CLAIM_STATUS,
  COMPETITION_PRODUCT_STATUS,
  type CompetitionProductAccess,
  type CompetitionProductDelivery,
  commerceProductTable,
  commercePurchaseTable,
  competitionProductFileClaimsTable,
  competitionProductFilesTable,
  competitionProductsTable,
  competitionProductVariantsTable,
  competitionRegistrationsTable,
  competitionsTable,
  createCompetitionProductFileId,
  createCompetitionProductId,
  createCompetitionProductVariantId,
  REGISTRATION_STATUS,
  teamTable,
  userTable,
} from "@/db/schema"
import { getEvlog } from "@/lib/evlog"
import { logInfo, logWarning } from "@/lib/logging"
import type { FeeConfiguration } from "@/server/commerce/fee-calculator"
import { buildFeeConfig, type TeamFeeOverrides } from "@/server/commerce/utils"
import { hasFeature } from "@/server/entitlements"
import {
  getVariantRemaining,
  isAddonPurchasable,
  isVariantSoldOut,
} from "@/utils/addon-availability"
import { requireVerifiedEmail } from "@/utils/auth"
import { PENDING_PURCHASE_MAX_AGE_MINUTES } from "@/utils/competition-settings"
import { DEFAULT_TIMEZONE } from "@/utils/timezone-utils"

// ============================================================================
// Input Schemas
// ============================================================================

const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD format")

const variantInputSchema = z.object({
  id: z.string().min(1).optional(),
  label: z.string().trim().min(1, "Variant label is required").max(100),
  stockQty: z.number().int().min(0).nullable().optional(),
})

const productFileInputSchema = z.object({
  id: z.string().min(1).optional(),
  title: z.string().trim().min(1, "File title is required").max(255),
  r2Key: z.string().trim().min(1).max(600),
  originalFilename: z.string().trim().min(1).max(255),
  fileSize: z.number().int().positive(),
  mimeType: z.literal("application/pdf"),
})

const addonFieldsSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(255),
  description: z.string().max(2000).optional(),
  imageUrl: z.string().trim().url().max(1024).optional().or(z.literal("")),
  priceCents: z.number().int().min(0, "Price cannot be negative"),
  delivery: z
    .enum([
      COMPETITION_PRODUCT_DELIVERY.PICKUP,
      COMPETITION_PRODUCT_DELIVERY.DOWNLOAD,
    ])
    .optional(),
  access: z
    .enum([
      COMPETITION_PRODUCT_ACCESS.OPTIONAL_PURCHASE,
      COMPETITION_PRODUCT_ACCESS.INCLUDED_WITH_REGISTRATION,
    ])
    .optional(),
  maxPerAthlete: z.number().int().positive().nullable().optional(),
  availableUntil: dateStringSchema.nullable().optional(),
  status: z
    .enum([
      COMPETITION_PRODUCT_STATUS.ACTIVE,
      COMPETITION_PRODUCT_STATUS.HIDDEN,
      COMPETITION_PRODUCT_STATUS.ARCHIVED,
    ])
    .optional(),
  variants: z
    .array(variantInputSchema)
    .max(30)
    .refine(
      (variants) =>
        new Set(variants.map((v) => v.label.toLowerCase())).size ===
        variants.length,
      { message: "Variant labels must be unique" },
    )
    .optional(),
  files: z.array(productFileInputSchema).max(20).optional(),
})

const createAddonInputSchema = addonFieldsSchema.extend({
  competitionId: z.string().min(1, "Competition ID is required"),
  teamId: z.string().min(1, "Team ID is required"),
})

const updateAddonInputSchema = addonFieldsSchema.partial().extend({
  productId: z.string().min(1, "Product ID is required"),
  teamId: z.string().min(1, "Team ID is required"),
})

const listAddonsInputSchema = z.object({
  competitionId: z.string().min(1, "Competition ID is required"),
  teamId: z.string().min(1, "Team ID is required"),
})

const publicAddonsInputSchema = z.object({
  competitionId: z.string().min(1, "Competition ID is required"),
})

const ACTIVE_REGISTRATION_ENTITLEMENT_ERROR =
  "Included downloads cannot be changed in a way that revokes access while the competition has active registrations"

// ============================================================================
// Helpers
// ============================================================================

type SessionResult = Awaited<ReturnType<typeof requireVerifiedEmail>>

function assertTeamManageAccess(session: SessionResult, teamId: string) {
  const canManage =
    session.user?.role === "admin" ||
    session.teams?.find(
      (t) =>
        t.id === teamId && (t.role.id === "admin" || t.role.id === "owner"),
    )
  if (!canManage) throw new Error("Unauthorized")
}

async function requireAddonEntitlement(teamId: string) {
  const entitled = await hasFeature(teamId, FEATURES.REGISTRATION_ADDONS)
  if (!entitled) {
    throw new Error(
      "Registration add-ons are not enabled for your account. Contact WODsmith to enable merch sales.",
    )
  }
}

async function getOwnedCompetition(competitionId: string, teamId: string) {
  const db = getDb()
  const competition = await db.query.competitionsTable.findFirst({
    where: and(
      eq(competitionsTable.id, competitionId),
      eq(competitionsTable.organizingTeamId, teamId),
    ),
  })
  if (!competition) {
    throw new Error("Competition not found or does not belong to your team")
  }
  return competition
}

async function getOwnedAddon(productId: string, teamId: string) {
  const db = getDb()
  const product = await db.query.competitionProductsTable.findFirst({
    where: eq(competitionProductsTable.id, productId),
  })
  if (!product) throw new Error("Add-on not found")
  await getOwnedCompetition(product.competitionId, teamId)
  return product
}

function assertValidProductConfiguration(input: {
  priceCents: number
  delivery: CompetitionProductDelivery
  access: CompetitionProductAccess
  variants: Array<unknown>
  files: Array<unknown>
}) {
  if (
    input.access === COMPETITION_PRODUCT_ACCESS.INCLUDED_WITH_REGISTRATION &&
    input.delivery !== COMPETITION_PRODUCT_DELIVERY.DOWNLOAD
  ) {
    throw new Error("Included products must be downloadable")
  }
  if (
    input.access === COMPETITION_PRODUCT_ACCESS.INCLUDED_WITH_REGISTRATION &&
    input.priceCents !== 0
  ) {
    throw new Error("Products included with registration cannot have a price")
  }
  if (
    input.access === COMPETITION_PRODUCT_ACCESS.OPTIONAL_PURCHASE &&
    input.priceCents <= 0
  ) {
    throw new Error("Optional products must have a price greater than 0")
  }
  if (
    input.delivery === COMPETITION_PRODUCT_DELIVERY.DOWNLOAD &&
    input.files.length === 0
  ) {
    throw new Error("Downloadable products need at least one PDF")
  }
  if (
    input.delivery === COMPETITION_PRODUCT_DELIVERY.DOWNLOAD &&
    input.variants.length > 0
  ) {
    throw new Error("Downloadable products cannot have size or stock options")
  }
  if (
    input.delivery === COMPETITION_PRODUCT_DELIVERY.PICKUP &&
    input.files.length > 0
  ) {
    throw new Error("Physical products cannot have download files")
  }
}

function assertProductFileOwnership(
  competitionId: string,
  files: Array<{ r2Key: string }>,
) {
  const expectedPrefix = `competitions/product-downloads/${competitionId}/`
  if (files.some((file) => !file.r2Key.startsWith(expectedPrefix))) {
    throw new Error("A download file was not uploaded for this competition")
  }
  if (new Set(files.map((file) => file.r2Key)).size !== files.length) {
    throw new Error("Each download file must use a unique upload")
  }
}

function assertProductFileClaims(
  competitionId: string,
  r2Keys: string[],
  claims: Array<{ competitionId: string; r2Key: string; status: string }>,
) {
  const claimByKey = new Map(claims.map((claim) => [claim.r2Key, claim]))
  if (
    r2Keys.some(
      (r2Key) =>
        claimByKey.get(r2Key)?.competitionId !== competitionId ||
        claimByKey.get(r2Key)?.status !==
          COMPETITION_PRODUCT_FILE_CLAIM_STATUS.UPLOADED,
    )
  ) {
    throw new Error(
      "A download upload expired or is already attached. Upload the PDF again.",
    )
  }
}

/**
 * COMPLETED add-on sales for a competition, aggregated per
 * (catalog product, variant). Joins purchases through the lazily created
 * commerce product (type=ADDON, resourceId=<competition_products.id>).
 */
async function getAddonSalesAggregates(competitionId: string) {
  const db = getDb()
  const rows = await db
    .select({
      addonProductId: commerceProductTable.resourceId,
      variantId: commercePurchaseTable.variantId,
      units: sql<number>`SUM(${commercePurchaseTable.quantity})`,
      revenueCents: sql<number>`SUM(${commercePurchaseTable.totalCents})`,
      purchases: sql<number>`COUNT(*)`,
    })
    .from(commercePurchaseTable)
    .innerJoin(
      commerceProductTable,
      eq(commercePurchaseTable.productId, commerceProductTable.id),
    )
    .where(
      and(
        eq(commercePurchaseTable.competitionId, competitionId),
        eq(commercePurchaseTable.status, COMMERCE_PURCHASE_STATUS.COMPLETED),
        eq(commerceProductTable.type, COMMERCE_PRODUCT_TYPE.ADDON),
      ),
    )
    .groupBy(commerceProductTable.resourceId, commercePurchaseTable.variantId)

  return rows.map((r) => ({
    addonProductId: r.addonProductId,
    variantId: r.variantId,
    units: Number(r.units ?? 0),
    revenueCents: Number(r.revenueCents ?? 0),
    purchases: Number(r.purchases ?? 0),
  }))
}

async function getPendingAddonProductIds(competitionId: string) {
  const db = getDb()
  const cutoff = new Date(
    Date.now() - PENDING_PURCHASE_MAX_AGE_MINUTES * 60 * 1000,
  )
  const rows = await db
    .select({ productId: commerceProductTable.resourceId })
    .from(commercePurchaseTable)
    .innerJoin(
      commerceProductTable,
      eq(commercePurchaseTable.productId, commerceProductTable.id),
    )
    .where(
      and(
        eq(commercePurchaseTable.competitionId, competitionId),
        eq(commercePurchaseTable.status, COMMERCE_PURCHASE_STATUS.PENDING),
        gt(commercePurchaseTable.createdAt, cutoff),
        eq(commerceProductTable.type, COMMERCE_PRODUCT_TYPE.ADDON),
      ),
    )
  return new Set(rows.map((row) => row.productId))
}

async function loadProductsWithVariants(competitionId: string) {
  const db = getDb()
  const products = await db.query.competitionProductsTable.findMany({
    where: eq(competitionProductsTable.competitionId, competitionId),
    orderBy: [
      asc(competitionProductsTable.sortOrder),
      asc(competitionProductsTable.createdAt),
    ],
  })
  if (products.length === 0) return []

  const [variants, files] = await Promise.all([
    db.query.competitionProductVariantsTable.findMany({
      where: inArray(
        competitionProductVariantsTable.productId,
        products.map((p) => p.id),
      ),
      orderBy: [
        asc(competitionProductVariantsTable.sortOrder),
        asc(competitionProductVariantsTable.createdAt),
      ],
    }),
    db.query.competitionProductFilesTable.findMany({
      where: inArray(
        competitionProductFilesTable.productId,
        products.map((p) => p.id),
      ),
      orderBy: [
        asc(competitionProductFilesTable.sortOrder),
        asc(competitionProductFilesTable.createdAt),
      ],
    }),
  ])

  return products.map((product) => ({
    ...product,
    variants: variants
      .filter((v) => v.productId === product.id)
      .map((v) => ({
        id: v.id,
        label: v.label,
        stockQty: v.stockQty,
        soldQty: v.soldQty,
        sortOrder: v.sortOrder,
      })),
    files: files
      .filter((file) => file.productId === product.id)
      .map((file) => ({
        id: file.id,
        title: file.title,
        r2Key: file.r2Key,
        originalFilename: file.originalFilename,
        fileSize: file.fileSize,
        mimeType: file.mimeType,
        sortOrder: file.sortOrder,
      })),
  }))
}

// ============================================================================
// Organizer Server Functions
// ============================================================================

export interface OrganizerAddonVariant {
  id: string
  label: string
  stockQty: number | null
  soldQty: number
  sortOrder: number
  unitsSold: number
}

export interface OrganizerAddon {
  id: string
  competitionId: string
  name: string
  description: string | null
  imageUrl: string | null
  priceCents: number
  delivery: string
  access: string
  maxPerAthlete: number | null
  availableUntil: string | null
  status: string
  sortOrder: number
  variants: OrganizerAddonVariant[]
  files: Array<{
    id: string
    title: string
    r2Key: string
    originalFilename: string
    fileSize: number
    mimeType: string
    sortOrder: number
  }>
  unitsSold: number
  revenueCents: number
  hasPendingCheckout: boolean
}

/**
 * List all add-ons for a competition (organizer view: every status, with
 * sold counts) plus whether the team holds the entitlement.
 */
export const listCompetitionAddonsFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => listAddonsInputSchema.parse(data))
  .handler(async ({ data: input }) => {
    const session = await requireVerifiedEmail()
    assertTeamManageAccess(session, input.teamId)
    await getOwnedCompetition(input.competitionId, input.teamId)

    const [entitled, products, sales, pendingProductIds] = await Promise.all([
      hasFeature(input.teamId, FEATURES.REGISTRATION_ADDONS),
      loadProductsWithVariants(input.competitionId),
      getAddonSalesAggregates(input.competitionId),
      getPendingAddonProductIds(input.competitionId),
    ])

    const addons: OrganizerAddon[] = products.map((product) => {
      const productSales = sales.filter((s) => s.addonProductId === product.id)
      return {
        id: product.id,
        competitionId: product.competitionId,
        name: product.name,
        description: product.description,
        imageUrl: product.imageUrl,
        priceCents: product.priceCents,
        delivery: product.delivery,
        access: product.access,
        maxPerAthlete: product.maxPerAthlete,
        availableUntil: product.availableUntil,
        status: product.status,
        sortOrder: product.sortOrder,
        variants: product.variants.map((v) => ({
          ...v,
          unitsSold:
            productSales.find((s) => s.variantId === v.id)?.units ?? v.soldQty,
        })),
        files: product.files,
        unitsSold: productSales.reduce((sum, s) => sum + s.units, 0),
        revenueCents: productSales.reduce((sum, s) => sum + s.revenueCents, 0),
        hasPendingCheckout: pendingProductIds.has(product.id),
      }
    })

    return { entitled, addons }
  })

/**
 * Create an add-on product (with optional variants).
 * Requires team admin/owner role and the REGISTRATION_ADDONS entitlement.
 */
export const createCompetitionAddonFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => createAddonInputSchema.parse(data))
  .handler(async ({ data: input }) => {
    const session = await requireVerifiedEmail()
    assertTeamManageAccess(session, input.teamId)
    await requireAddonEntitlement(input.teamId)
    await getOwnedCompetition(input.competitionId, input.teamId)

    getEvlog()?.set({
      action: "create_competition_addon",
      teamId: input.teamId,
    })

    const db = getDb()
    const productId = createCompetitionProductId()
    const delivery = input.delivery ?? COMPETITION_PRODUCT_DELIVERY.PICKUP
    const access = input.access ?? COMPETITION_PRODUCT_ACCESS.OPTIONAL_PURCHASE
    const files = input.files ?? []
    const variants = input.variants ?? []
    assertValidProductConfiguration({
      priceCents: input.priceCents,
      delivery,
      access,
      files,
      variants,
    })
    assertProductFileOwnership(input.competitionId, files)
    await db.transaction(async (tx) => {
      const fileKeys = files.map((file) => file.r2Key).sort()
      if (fileKeys.length > 0) {
        await tx
          .select({ r2Key: competitionProductFileClaimsTable.r2Key })
          .from(competitionProductFileClaimsTable)
          .where(inArray(competitionProductFileClaimsTable.r2Key, fileKeys))
          .orderBy(competitionProductFileClaimsTable.r2Key)
          .for("update")
        const claims =
          await tx.query.competitionProductFileClaimsTable.findMany({
            where: inArray(competitionProductFileClaimsTable.r2Key, fileKeys),
          })
        assertProductFileClaims(input.competitionId, fileKeys, claims)
      }

      await tx.insert(competitionProductsTable).values({
        id: productId,
        competitionId: input.competitionId,
        name: input.name,
        description: input.description || null,
        imageUrl: input.imageUrl || null,
        priceCents: input.priceCents,
        delivery,
        access,
        maxPerAthlete:
          delivery === COMPETITION_PRODUCT_DELIVERY.DOWNLOAD
            ? 1
            : (input.maxPerAthlete ?? null),
        availableUntil:
          delivery === COMPETITION_PRODUCT_DELIVERY.DOWNLOAD
            ? null
            : (input.availableUntil ?? null),
        status: input.status ?? COMPETITION_PRODUCT_STATUS.ACTIVE,
      })

      if (input.variants && input.variants.length > 0) {
        await tx.insert(competitionProductVariantsTable).values(
          input.variants.map((variant, index) => ({
            id: createCompetitionProductVariantId(),
            productId,
            label: variant.label,
            stockQty: variant.stockQty ?? null,
            sortOrder: index,
          })),
        )
      }

      if (files.length > 0) {
        await tx.insert(competitionProductFilesTable).values(
          files.map((file, index) => ({
            id: createCompetitionProductFileId(),
            productId,
            title: file.title,
            r2Key: file.r2Key,
            originalFilename: file.originalFilename,
            fileSize: file.fileSize,
            mimeType: file.mimeType,
            sortOrder: index,
          })),
        )
        await tx.delete(competitionProductFileClaimsTable).where(
          inArray(
            competitionProductFileClaimsTable.r2Key,
            files.map((file) => file.r2Key),
          ),
        )
      }
    })

    logInfo({
      message: "[Addons] Add-on created",
      attributes: {
        productId,
        competitionId: input.competitionId,
        teamId: input.teamId,
        priceCents: input.priceCents,
        variantCount: input.variants?.length ?? 0,
      },
    })

    return { productId }
  })

/**
 * Update an add-on product and reconcile its variants.
 * Variants with completed sales (or any referencing purchase) can be edited
 * but not removed.
 */
export const updateCompetitionAddonFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => updateAddonInputSchema.parse(data))
  .handler(async ({ data: input }) => {
    const session = await requireVerifiedEmail()
    assertTeamManageAccess(session, input.teamId)
    await requireAddonEntitlement(input.teamId)
    const product = await getOwnedAddon(input.productId, input.teamId)

    getEvlog()?.set({
      action: "update_competition_addon",
      teamId: input.teamId,
    })

    const db = getDb()

    const existingFiles = await db.query.competitionProductFilesTable.findMany({
      where: eq(competitionProductFilesTable.productId, product.id),
    })
    const nextDelivery = input.delivery ?? product.delivery
    const nextAccess = input.access ?? product.access
    const nextFiles = input.files ?? existingFiles
    const existingVariants =
      await db.query.competitionProductVariantsTable.findMany({
        where: eq(competitionProductVariantsTable.productId, product.id),
      })
    const nextVariants = input.variants ?? existingVariants
    const nextPriceCents = input.priceCents ?? product.priceCents
    assertValidProductConfiguration({
      priceCents: nextPriceCents,
      delivery: nextDelivery,
      access: nextAccess,
      files: nextFiles,
      variants: nextVariants,
    })
    assertProductFileOwnership(product.competitionId, nextFiles)
    let removedFiles =
      input.files === undefined
        ? []
        : existingFiles.filter(
            (file) => !input.files?.some((incoming) => incoming.id === file.id),
          )

    // Product fields and variant reconciliation commit together — a variant
    // validation error (e.g. removing a variant with sales) must not leave
    // half-applied product changes behind.
    await db.transaction(async (tx) => {
      // Checkout locks the same catalog row before inserting PENDING purchase
      // rows. Sharing that lock closes the race between starting checkout and
      // changing how an existing product is fulfilled.
      await tx
        .select({ id: competitionProductsTable.id })
        .from(competitionProductsTable)
        .where(eq(competitionProductsTable.id, product.id))
        .for("update")

      const lockedProduct = await tx.query.competitionProductsTable.findFirst({
        where: eq(competitionProductsTable.id, product.id),
      })
      if (!lockedProduct) throw new Error("Add-on not found")
      const lockedFiles = await tx.query.competitionProductFilesTable.findMany({
        where: eq(competitionProductFilesTable.productId, product.id),
      })
      if (input.files !== undefined) {
        removedFiles = lockedFiles.filter(
          (file) => !input.files?.some((incoming) => incoming.id === file.id),
        )
      }
      const lockedNextDelivery = input.delivery ?? lockedProduct.delivery

      const revokesRegistrationEntitlement =
        lockedProduct.access ===
          COMPETITION_PRODUCT_ACCESS.INCLUDED_WITH_REGISTRATION &&
        lockedProduct.status === COMPETITION_PRODUCT_STATUS.ACTIVE &&
        ((input.access !== undefined &&
          input.access !==
            COMPETITION_PRODUCT_ACCESS.INCLUDED_WITH_REGISTRATION) ||
          (input.status !== undefined &&
            input.status !== COMPETITION_PRODUCT_STATUS.ACTIVE) ||
          removedFiles.length > 0)
      if (revokesRegistrationEntitlement) {
        const [activeRegistration] = await tx
          .select({ id: competitionRegistrationsTable.id })
          .from(competitionRegistrationsTable)
          .where(
            and(
              eq(
                competitionRegistrationsTable.eventId,
                lockedProduct.competitionId,
              ),
              eq(
                competitionRegistrationsTable.status,
                REGISTRATION_STATUS.ACTIVE,
              ),
            ),
          )
          .limit(1)
          .for("update")
        if (activeRegistration) {
          throw new Error(ACTIVE_REGISTRATION_ENTITLEMENT_ERROR)
        }
      }

      if (
        input.delivery !== undefined &&
        input.delivery !== lockedProduct.delivery
      ) {
        if (
          lockedProduct.access ===
          COMPETITION_PRODUCT_ACCESS.INCLUDED_WITH_REGISTRATION
        ) {
          throw new Error(
            "Delivery cannot be changed while a product is included with registration",
          )
        }
        const [purchase] = await tx
          .select({ status: commercePurchaseTable.status })
          .from(commercePurchaseTable)
          .innerJoin(
            commerceProductTable,
            eq(commercePurchaseTable.productId, commerceProductTable.id),
          )
          .where(
            and(
              eq(commerceProductTable.type, COMMERCE_PRODUCT_TYPE.ADDON),
              eq(commerceProductTable.resourceId, product.id),
              or(
                eq(
                  commercePurchaseTable.status,
                  COMMERCE_PURCHASE_STATUS.COMPLETED,
                ),
                and(
                  eq(
                    commercePurchaseTable.status,
                    COMMERCE_PURCHASE_STATUS.PENDING,
                  ),
                  gt(
                    commercePurchaseTable.createdAt,
                    new Date(
                      Date.now() - PENDING_PURCHASE_MAX_AGE_MINUTES * 60 * 1000,
                    ),
                  ),
                ),
              ),
            ),
          )
          .limit(1)
        if (purchase) {
          throw new Error(
            "Delivery cannot be changed after checkout has started for a product",
          )
        }
      }

      const newFiles = input.files?.filter((file) => !file.id) ?? []
      const newFileKeys = newFiles.map((file) => file.r2Key).sort()
      if (newFileKeys.length > 0) {
        await tx
          .select({ r2Key: competitionProductFileClaimsTable.r2Key })
          .from(competitionProductFileClaimsTable)
          .where(inArray(competitionProductFileClaimsTable.r2Key, newFileKeys))
          .orderBy(competitionProductFileClaimsTable.r2Key)
          .for("update")
        const claims =
          await tx.query.competitionProductFileClaimsTable.findMany({
            where: inArray(
              competitionProductFileClaimsTable.r2Key,
              newFileKeys,
            ),
          })
        assertProductFileClaims(product.competitionId, newFileKeys, claims)
      }

      await tx
        .update(competitionProductsTable)
        .set({
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.description !== undefined
            ? { description: input.description || null }
            : {}),
          ...(input.imageUrl !== undefined
            ? { imageUrl: input.imageUrl || null }
            : {}),
          ...(input.priceCents !== undefined
            ? { priceCents: input.priceCents }
            : {}),
          ...(input.delivery !== undefined ? { delivery: input.delivery } : {}),
          ...(input.access !== undefined ? { access: input.access } : {}),
          ...(input.maxPerAthlete !== undefined || input.delivery !== undefined
            ? {
                maxPerAthlete:
                  lockedNextDelivery === COMPETITION_PRODUCT_DELIVERY.DOWNLOAD
                    ? 1
                    : (input.maxPerAthlete ?? lockedProduct.maxPerAthlete),
              }
            : {}),
          ...(input.availableUntil !== undefined || input.delivery !== undefined
            ? {
                availableUntil:
                  lockedNextDelivery === COMPETITION_PRODUCT_DELIVERY.DOWNLOAD
                    ? null
                    : (input.availableUntil ?? lockedProduct.availableUntil),
              }
            : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          updatedAt: new Date(),
        })
        .where(eq(competitionProductsTable.id, product.id))

      if (input.variants !== undefined) {
        const existing = existingVariants
        const incomingIds = new Set(
          input.variants.map((v) => v.id).filter(Boolean),
        )

        // Remove variants dropped from the payload — but never ones that have
        // sold units or are referenced by any purchase (pending included).
        const removed = existing.filter((v) => !incomingIds.has(v.id))
        for (const variant of removed) {
          if (variant.soldQty > 0) {
            throw new Error(
              `Cannot remove variant "${variant.label}" — it has completed sales. Set its stock to 0 instead.`,
            )
          }
          const [referencing] = await tx
            .select({ count: sql<number>`COUNT(*)` })
            .from(commercePurchaseTable)
            .where(eq(commercePurchaseTable.variantId, variant.id))
          if (Number(referencing?.count ?? 0) > 0) {
            throw new Error(
              `Cannot remove variant "${variant.label}" — purchases reference it. Set its stock to 0 instead.`,
            )
          }
          await tx
            .delete(competitionProductVariantsTable)
            .where(eq(competitionProductVariantsTable.id, variant.id))
        }

        for (const [index, variant] of input.variants.entries()) {
          if (variant.id) {
            const current = existing.find((v) => v.id === variant.id)
            if (!current) throw new Error("Variant not found on this add-on")
            await tx
              .update(competitionProductVariantsTable)
              .set({
                label: variant.label,
                stockQty: variant.stockQty ?? null,
                sortOrder: index,
                updatedAt: new Date(),
              })
              .where(eq(competitionProductVariantsTable.id, variant.id))
          } else {
            await tx.insert(competitionProductVariantsTable).values({
              id: createCompetitionProductVariantId(),
              productId: product.id,
              label: variant.label,
              stockQty: variant.stockQty ?? null,
              sortOrder: index,
            })
          }
        }
      }

      if (input.files !== undefined) {
        if (removedFiles.length > 0) {
          await tx.delete(competitionProductFilesTable).where(
            inArray(
              competitionProductFilesTable.id,
              removedFiles.map((file) => file.id),
            ),
          )
        }
        for (const [index, file] of input.files.entries()) {
          if (file.id) {
            const current = lockedFiles.find(
              (existing) => existing.id === file.id,
            )
            if (!current)
              throw new Error("Download file not found on this product")
            if (current.r2Key !== file.r2Key) {
              throw new Error("An attached download file cannot be replaced")
            }
            await tx
              .update(competitionProductFilesTable)
              .set({
                title: file.title,
                r2Key: file.r2Key,
                originalFilename: file.originalFilename,
                fileSize: file.fileSize,
                mimeType: file.mimeType,
                sortOrder: index,
                updatedAt: new Date(),
              })
              .where(eq(competitionProductFilesTable.id, file.id))
          } else {
            await tx.insert(competitionProductFilesTable).values({
              id: createCompetitionProductFileId(),
              productId: product.id,
              title: file.title,
              r2Key: file.r2Key,
              originalFilename: file.originalFilename,
              fileSize: file.fileSize,
              mimeType: file.mimeType,
              sortOrder: index,
            })
          }
        }
        if (newFileKeys.length > 0) {
          await tx
            .delete(competitionProductFileClaimsTable)
            .where(
              inArray(competitionProductFileClaimsTable.r2Key, newFileKeys),
            )
        }
      }
    })

    const removedKeys = [...new Set(removedFiles.map((file) => file.r2Key))]
    if (removedKeys.length > 0) {
      try {
        const remainingReferences =
          await db.query.competitionProductFilesTable.findMany({
            where: inArray(competitionProductFilesTable.r2Key, removedKeys),
            columns: { r2Key: true },
          })
        const referencedKeys = new Set(
          remainingReferences.map((file) => file.r2Key),
        )
        const detachedKeys = removedKeys.filter(
          (key) => !referencedKeys.has(key),
        )
        if (detachedKeys.length > 0) {
          const { env } = await import("cloudflare:workers")
          await env.R2_DOWNLOADS_BUCKET.delete(detachedKeys)
        }
      } catch (error) {
        logWarning({
          message: "[Addons] Failed to delete detached download objects",
          attributes: {
            productId: product.id,
            fileCount: removedKeys.length,
            error: error instanceof Error ? error.message : String(error),
          },
        })
      }
    }

    logInfo({
      message: "[Addons] Add-on updated",
      attributes: { productId: product.id, teamId: input.teamId },
    })

    return { success: true }
  })

/**
 * Archive an add-on (soft delete). Archived products never show to athletes
 * but their sales history stays intact for reporting.
 */
export const archiveCompetitionAddonFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        productId: z.string().min(1),
        teamId: z.string().min(1),
      })
      .parse(data),
  )
  .handler(async ({ data: input }) => {
    const session = await requireVerifiedEmail()
    assertTeamManageAccess(session, input.teamId)
    await requireAddonEntitlement(input.teamId)
    const product = await getOwnedAddon(input.productId, input.teamId)

    const db = getDb()
    await db.transaction(async (tx) => {
      await tx
        .select({ id: competitionProductsTable.id })
        .from(competitionProductsTable)
        .where(eq(competitionProductsTable.id, product.id))
        .for("update")

      const lockedProduct = await tx.query.competitionProductsTable.findFirst({
        where: eq(competitionProductsTable.id, product.id),
      })
      if (!lockedProduct) throw new Error("Add-on not found")

      if (
        lockedProduct.access ===
          COMPETITION_PRODUCT_ACCESS.INCLUDED_WITH_REGISTRATION &&
        lockedProduct.status === COMPETITION_PRODUCT_STATUS.ACTIVE
      ) {
        const [activeRegistration] = await tx
          .select({ id: competitionRegistrationsTable.id })
          .from(competitionRegistrationsTable)
          .where(
            and(
              eq(
                competitionRegistrationsTable.eventId,
                lockedProduct.competitionId,
              ),
              eq(
                competitionRegistrationsTable.status,
                REGISTRATION_STATUS.ACTIVE,
              ),
            ),
          )
          .limit(1)
          .for("update")
        if (activeRegistration) {
          throw new Error(ACTIVE_REGISTRATION_ENTITLEMENT_ERROR)
        }
      }

      await tx
        .update(competitionProductsTable)
        .set({
          status: COMPETITION_PRODUCT_STATUS.ARCHIVED,
          updatedAt: new Date(),
        })
        .where(eq(competitionProductsTable.id, product.id))
    })

    logInfo({
      message: "[Addons] Add-on archived",
      attributes: { productId: product.id, teamId: input.teamId },
    })

    return { success: true }
  })

// ============================================================================
// Athlete-facing catalog
// ============================================================================

export interface PublicAddonVariant {
  id: string
  label: string
  soldOut: boolean
  /** Remaining sellable units; null = untracked */
  remaining: number | null
}

export interface PublicAddon {
  id: string
  name: string
  description: string | null
  imageUrl: string | null
  /** Raw product price per unit */
  priceCents: number
  delivery: CompetitionProductDelivery
  access: CompetitionProductAccess
  downloadFiles: Array<{ title: string }>
  /** Session fee settings used by the registration order preview. */
  feeConfig: FeeConfiguration
  maxPerAthlete: number | null
  availableUntil: string | null
  variants: PublicAddonVariant[]
}

/**
 * Purchasable add-ons for the registration form.
 *
 * Returns an empty list when the organizing team lacks the
 * REGISTRATION_ADDONS entitlement. Included downloads remain visible without
 * Stripe; optional paid add-ons require a verified connected account.
 */
export const getPublicCompetitionAddonsFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => publicAddonsInputSchema.parse(data))
  .handler(async ({ data: input }): Promise<{ addons: PublicAddon[] }> => {
    const db = getDb()

    const competition = await db.query.competitionsTable.findFirst({
      where: eq(competitionsTable.id, input.competitionId),
    })
    if (!competition) return { addons: [] }

    const entitled = await hasFeature(
      competition.organizingTeamId,
      FEATURES.REGISTRATION_ADDONS,
    )
    if (!entitled) return { addons: [] }

    const organizingTeam = await db.query.teamTable.findFirst({
      where: eq(teamTable.id, competition.organizingTeamId),
      columns: {
        stripeAccountStatus: true,
        organizerFeePercentage: true,
        organizerFeeFixed: true,
      },
    })
    const timezone = competition.timezone || DEFAULT_TIMEZONE
    const teamFeeOverrides: TeamFeeOverrides = {
      organizerFeePercentage: organizingTeam?.organizerFeePercentage ?? null,
      organizerFeeFixed: organizingTeam?.organizerFeeFixed ?? null,
    }
    const feeConfig = buildFeeConfig(competition, teamFeeOverrides)

    const products = await loadProductsWithVariants(input.competitionId)

    const addons: PublicAddon[] = products
      .filter((product) => {
        if (product.status !== COMPETITION_PRODUCT_STATUS.ACTIVE) return false
        if (
          product.access ===
          COMPETITION_PRODUCT_ACCESS.INCLUDED_WITH_REGISTRATION
        ) {
          return product.delivery === COMPETITION_PRODUCT_DELIVERY.DOWNLOAD
        }
        return (
          organizingTeam?.stripeAccountStatus === "VERIFIED" &&
          isAddonPurchasable(product, timezone)
        )
      })
      .map((product) => ({
        id: product.id,
        name: product.name,
        description: product.description,
        imageUrl: product.imageUrl,
        priceCents: product.priceCents,
        delivery: product.delivery,
        access: product.access,
        downloadFiles: product.files.map((file) => ({ title: file.title })),
        feeConfig,
        maxPerAthlete: product.maxPerAthlete,
        availableUntil: product.availableUntil,
        variants: product.variants.map((variant) => ({
          id: variant.id,
          label: variant.label,
          soldOut: isVariantSoldOut(variant),
          remaining: getVariantRemaining(variant),
        })),
      }))
      // Hide products where every variant is sold out
      .filter(
        (addon) =>
          addon.variants.length === 0 || addon.variants.some((v) => !v.soldOut),
      )

    return { addons }
  })

// ============================================================================
// Fulfillment reporting
// ============================================================================

export interface AddonVariantCount {
  productId: string
  productName: string
  variantLabel: string | null
  units: number
  revenueCents: number
}

export interface AddonPickupRow {
  purchaseId: string
  purchaserName: string
  purchaserEmail: string | null
  productName: string
  variantLabel: string | null
  quantity: number
  completedAt: Date | null
}

/**
 * Fulfillment report: counts by variant (for the print shop) and the
 * per-athlete pickup list (for the check-in table).
 */
export const getAddonSalesReportFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => listAddonsInputSchema.parse(data))
  .handler(async ({ data: input }) => {
    const session = await requireVerifiedEmail()
    assertTeamManageAccess(session, input.teamId)
    await getOwnedCompetition(input.competitionId, input.teamId)

    const db = getDb()

    const purchases = await db
      .select({
        purchaseId: commercePurchaseTable.id,
        quantity: commercePurchaseTable.quantity,
        totalCents: commercePurchaseTable.totalCents,
        completedAt: commercePurchaseTable.completedAt,
        variantId: commercePurchaseTable.variantId,
        metadata: commercePurchaseTable.metadata,
        addonProductId: commerceProductTable.resourceId,
        firstName: userTable.firstName,
        lastName: userTable.lastName,
        email: userTable.email,
      })
      .from(commercePurchaseTable)
      .innerJoin(
        commerceProductTable,
        eq(commercePurchaseTable.productId, commerceProductTable.id),
      )
      .innerJoin(userTable, eq(commercePurchaseTable.userId, userTable.id))
      .where(
        and(
          eq(commercePurchaseTable.competitionId, input.competitionId),
          eq(commercePurchaseTable.status, COMMERCE_PURCHASE_STATUS.COMPLETED),
          eq(commerceProductTable.type, COMMERCE_PRODUCT_TYPE.ADDON),
        ),
      )

    const products = await loadProductsWithVariants(input.competitionId)
    const productById = new Map(products.map((p) => [p.id, p]))
    const variantLabelById = new Map(
      products.flatMap((p) => p.variants.map((v) => [v.id, v.label] as const)),
    )

    const resolveVariantLabel = (row: {
      variantId: string | null
      metadata: string | null
    }): string | null => {
      if (row.variantId) {
        const label = variantLabelById.get(row.variantId)
        if (label) return label
      }
      // Variant may have been renamed/removed — fall back to the label
      // snapshotted into purchase metadata at checkout time.
      if (row.metadata) {
        try {
          const meta = JSON.parse(row.metadata) as {
            variantLabel?: string
          }
          if (meta.variantLabel) return meta.variantLabel
        } catch {
          // ignore malformed metadata
        }
      }
      return null
    }

    const countKey = (productId: string, variantLabel: string | null) =>
      `${productId}::${variantLabel ?? ""}`
    const counts = new Map<string, AddonVariantCount>()
    const pickupList: AddonPickupRow[] = []

    for (const row of purchases) {
      const product = productById.get(row.addonProductId)
      if (product?.delivery === COMPETITION_PRODUCT_DELIVERY.DOWNLOAD) continue
      const productName = product?.name ?? "Unknown add-on"
      const variantLabel = resolveVariantLabel(row)

      const key = countKey(row.addonProductId, variantLabel)
      const existing = counts.get(key)
      if (existing) {
        existing.units += row.quantity
        existing.revenueCents += row.totalCents
      } else {
        counts.set(key, {
          productId: row.addonProductId,
          productName,
          variantLabel,
          units: row.quantity,
          revenueCents: row.totalCents,
        })
      }

      pickupList.push({
        purchaseId: row.purchaseId,
        purchaserName:
          [row.firstName, row.lastName].filter(Boolean).join(" ") ||
          "Unknown athlete",
        purchaserEmail: row.email,
        productName,
        variantLabel,
        quantity: row.quantity,
        completedAt: row.completedAt,
      })
    }

    pickupList.sort((a, b) => a.purchaserName.localeCompare(b.purchaserName))

    return {
      variantCounts: [...counts.values()].sort(
        (a, b) =>
          a.productName.localeCompare(b.productName) ||
          (a.variantLabel ?? "").localeCompare(b.variantLabel ?? ""),
      ),
      pickupList,
    }
  })
