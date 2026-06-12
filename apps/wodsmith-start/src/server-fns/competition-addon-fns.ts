/**
 * Competition Add-on (Merch) Server Functions
 *
 * Organizer CRUD for the registration add-on catalog, the athlete-facing
 * catalog, and fulfillment reporting. Selling add-ons is gated behind the
 * `registration_addons` team feature entitlement, granted per organizing
 * team by platform admins via /admin/entitlements.
 */

import { createServerFn } from "@tanstack/react-start"
import { and, asc, eq, inArray, sql } from "drizzle-orm"
import { z } from "zod"
import { FEATURES } from "@/config/features"
import { getDb } from "@/db"
import {
  COMMERCE_PRODUCT_TYPE,
  COMMERCE_PURCHASE_STATUS,
  COMPETITION_PRODUCT_STATUS,
  commerceProductTable,
  commercePurchaseTable,
  competitionProductsTable,
  competitionProductVariantsTable,
  competitionsTable,
  teamTable,
  userTable,
} from "@/db/schema"
import { getEvlog } from "@/lib/evlog"
import { logInfo } from "@/lib/logging"
import { getAddonUnitBreakdown } from "@/server/commerce/addons"
import { buildFeeConfig, type TeamFeeOverrides } from "@/server/commerce/utils"
import { hasFeature } from "@/server/entitlements"
import {
  getVariantRemaining,
  isAddonPurchasable,
  isVariantSoldOut,
} from "@/utils/addon-availability"
import { requireVerifiedEmail } from "@/utils/auth"
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

const addonFieldsSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(255),
  description: z.string().max(2000).optional(),
  imageUrl: z.string().trim().url().max(1024).optional().or(z.literal("")),
  priceCents: z.number().int().positive("Price must be greater than 0"),
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

async function loadProductsWithVariants(competitionId: string) {
  const db = getDb()
  const products = await db.query.competitionProductsTable.findMany({
    where: eq(competitionProductsTable.competitionId, competitionId),
    orderBy: [
      asc(competitionProductsTable.sortOrder),
      asc(competitionProductsTable.createdAt),
    ],
  })
  if (products.length === 0)
    return [] as Array<
      (typeof products)[number] & {
        variants: Array<{
          id: string
          label: string
          stockQty: number | null
          soldQty: number
          sortOrder: number
        }>
      }
    >

  const variants = await db.query.competitionProductVariantsTable.findMany({
    where: inArray(
      competitionProductVariantsTable.productId,
      products.map((p) => p.id),
    ),
    orderBy: [
      asc(competitionProductVariantsTable.sortOrder),
      asc(competitionProductVariantsTable.createdAt),
    ],
  })

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
  maxPerAthlete: number | null
  availableUntil: string | null
  status: string
  sortOrder: number
  variants: OrganizerAddonVariant[]
  unitsSold: number
  revenueCents: number
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

    const [entitled, products, sales] = await Promise.all([
      hasFeature(input.teamId, FEATURES.REGISTRATION_ADDONS),
      loadProductsWithVariants(input.competitionId),
      getAddonSalesAggregates(input.competitionId),
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
        maxPerAthlete: product.maxPerAthlete,
        availableUntil: product.availableUntil,
        status: product.status,
        sortOrder: product.sortOrder,
        variants: product.variants.map((v) => ({
          ...v,
          unitsSold:
            productSales.find((s) => s.variantId === v.id)?.units ?? v.soldQty,
        })),
        unitsSold: productSales.reduce((sum, s) => sum + s.units, 0),
        revenueCents: productSales.reduce((sum, s) => sum + s.revenueCents, 0),
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
    const { createCompetitionProductId, createCompetitionProductVariantId } =
      await import("@/db/schemas/common")

    const productId = createCompetitionProductId()
    await db.insert(competitionProductsTable).values({
      id: productId,
      competitionId: input.competitionId,
      name: input.name,
      description: input.description || null,
      imageUrl: input.imageUrl || null,
      priceCents: input.priceCents,
      maxPerAthlete: input.maxPerAthlete ?? null,
      availableUntil: input.availableUntil ?? null,
      status: input.status ?? COMPETITION_PRODUCT_STATUS.ACTIVE,
    })

    if (input.variants && input.variants.length > 0) {
      await db.insert(competitionProductVariantsTable).values(
        input.variants.map((variant, index) => ({
          id: createCompetitionProductVariantId(),
          productId,
          label: variant.label,
          stockQty: variant.stockQty ?? null,
          sortOrder: index,
        })),
      )
    }

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

    // Product fields and variant reconciliation commit together — a variant
    // validation error (e.g. removing a variant with sales) must not leave
    // half-applied product changes behind.
    await db.transaction(async (tx) => {
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
          ...(input.maxPerAthlete !== undefined
            ? { maxPerAthlete: input.maxPerAthlete }
            : {}),
          ...(input.availableUntil !== undefined
            ? { availableUntil: input.availableUntil }
            : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          updatedAt: new Date(),
        })
        .where(eq(competitionProductsTable.id, product.id))

      if (input.variants !== undefined) {
        const { createCompetitionProductVariantId } = await import(
          "@/db/schemas/common"
        )
        const existing =
          await tx.query.competitionProductVariantsTable.findMany({
            where: eq(competitionProductVariantsTable.productId, product.id),
          })
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
    })

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
    const product = await getOwnedAddon(input.productId, input.teamId)

    const db = getDb()
    await db
      .update(competitionProductsTable)
      .set({
        status: COMPETITION_PRODUCT_STATUS.ARCHIVED,
        updatedAt: new Date(),
      })
      .where(eq(competitionProductsTable.id, product.id))

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
  /** All-in per-unit charge (price + fees passed to the customer) */
  unitChargeCents: number
  maxPerAthlete: number | null
  availableUntil: string | null
  variants: PublicAddonVariant[]
}

/**
 * Purchasable add-ons for the registration form.
 *
 * Returns an empty list when the organizing team lacks the
 * REGISTRATION_ADDONS entitlement (the gate also applies to catalogs created
 * before a revoke) or has no verified Stripe account to receive the funds.
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
    // Add-ons are always paid; without a verified Stripe account the
    // checkout would dead-end, so don't offer them.
    if (organizingTeam?.stripeAccountStatus !== "VERIFIED") {
      return { addons: [] }
    }

    const timezone = competition.timezone || DEFAULT_TIMEZONE
    const teamFeeOverrides: TeamFeeOverrides = {
      organizerFeePercentage: organizingTeam.organizerFeePercentage,
      organizerFeeFixed: organizingTeam.organizerFeeFixed,
    }
    const feeConfig = buildFeeConfig(competition, teamFeeOverrides)

    const products = await loadProductsWithVariants(input.competitionId)

    const addons: PublicAddon[] = products
      .filter((product) => isAddonPurchasable(product, timezone))
      .map((product) => ({
        id: product.id,
        name: product.name,
        description: product.description,
        imageUrl: product.imageUrl,
        priceCents: product.priceCents,
        unitChargeCents: getAddonUnitBreakdown(product.priceCents, feeConfig)
          .totalChargeCents,
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
