import type { InferSelectModel } from "drizzle-orm"
import { relations } from "drizzle-orm"
import { index, int, mysqlTable, text, varchar } from "drizzle-orm/mysql-core"
import {
  commonColumns,
  createCompetitionProductId,
  createCompetitionProductVariantId,
} from "./common"
import { competitionsTable } from "./competitions"

// Competition product status
export const COMPETITION_PRODUCT_STATUS = {
  ACTIVE: "ACTIVE",
  HIDDEN: "HIDDEN",
  ARCHIVED: "ARCHIVED",
} as const

export type CompetitionProductStatus =
  (typeof COMPETITION_PRODUCT_STATUS)[keyof typeof COMPETITION_PRODUCT_STATUS]

/**
 * Competition Products Table (registration add-ons / merch catalog)
 *
 * Organizer-defined products sold during competition registration
 * (e.g., event t-shirts). Purchases reference these through a lazily
 * created commerce_products row (type=ADDON, resourceId=<this id>).
 * Gated behind the `registration_addons` team feature entitlement.
 */
export const competitionProductsTable = mysqlTable(
  "competition_products",
  {
    ...commonColumns,
    id: varchar({ length: 255 })
      .primaryKey()
      .$defaultFn(() => createCompetitionProductId())
      .notNull(),
    // The competition this product is sold for
    competitionId: varchar({ length: 255 }).notNull(),
    // Display name (e.g., "Event Tee 2026")
    name: varchar({ length: 255 }).notNull(),
    // Optional markdown/plain description shown in the registration form
    description: text(),
    // Optional product image
    imageUrl: varchar({ length: 1024 }),
    // Price per unit in cents (variants share the product price in v1)
    priceCents: int().notNull(),
    // Max quantity a single registrant can order (null = no cap)
    maxPerAthlete: int(),
    // Order-by deadline as YYYY-MM-DD, evaluated end-of-day in the
    // competition's IANA timezone (same semantics as registrationClosesAt).
    // Null = available while registration is open.
    availableUntil: varchar({ length: 10 }),
    // ACTIVE = purchasable, HIDDEN = organizer kill switch, ARCHIVED = soft delete
    status: varchar({ length: 20 })
      .$type<CompetitionProductStatus>()
      .notNull()
      .default(COMPETITION_PRODUCT_STATUS.ACTIVE),
    // Display order in the registration form
    sortOrder: int().notNull().default(0),
  },
  (table) => [
    index("competition_products_competition_idx").on(table.competitionId),
  ],
)

/**
 * Competition Product Variants Table (e.g., t-shirt sizes)
 *
 * Each variant can optionally track stock. soldQty is incremented
 * atomically by the Stripe checkout workflow when a purchase completes;
 * stockQty null = untracked inventory (deadline-only availability).
 * Products with zero variants are sold without a variant selection.
 */
export const competitionProductVariantsTable = mysqlTable(
  "competition_product_variants",
  {
    ...commonColumns,
    id: varchar({ length: 255 })
      .primaryKey()
      .$defaultFn(() => createCompetitionProductVariantId())
      .notNull(),
    productId: varchar({ length: 255 }).notNull(),
    // Variant label shown to athletes (e.g., "S", "M", "L", "XL")
    label: varchar({ length: 100 }).notNull(),
    // Max units sellable (null = untracked)
    stockQty: int(),
    // Units sold via COMPLETED purchases (authoritative counter)
    soldQty: int().notNull().default(0),
    sortOrder: int().notNull().default(0),
  },
  (table) => [
    index("competition_product_variants_product_idx").on(table.productId),
  ],
)

// Type exports
export type CompetitionProduct = InferSelectModel<
  typeof competitionProductsTable
>
export type CompetitionProductVariant = InferSelectModel<
  typeof competitionProductVariantsTable
>

// Relations
export const competitionProductsRelations = relations(
  competitionProductsTable,
  ({ one, many }) => ({
    competition: one(competitionsTable, {
      fields: [competitionProductsTable.competitionId],
      references: [competitionsTable.id],
    }),
    variants: many(competitionProductVariantsTable),
  }),
)

export const competitionProductVariantsRelations = relations(
  competitionProductVariantsTable,
  ({ one }) => ({
    product: one(competitionProductsTable, {
      fields: [competitionProductVariantsTable.productId],
      references: [competitionProductsTable.id],
    }),
  }),
)
