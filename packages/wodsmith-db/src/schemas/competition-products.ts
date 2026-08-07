import type { InferSelectModel } from "drizzle-orm"
import { relations } from "drizzle-orm"
import { index, int, mysqlTable, text, varchar } from "drizzle-orm/mysql-core"
import {
  commonColumns,
  createCompetitionProductId,
  createCompetitionProductVariantId,
} from "./common"
import { competitionsTable } from "./competitions"

export const COMPETITION_PRODUCT_STATUS = {
  ACTIVE: "ACTIVE",
  HIDDEN: "HIDDEN",
  ARCHIVED: "ARCHIVED",
} as const

export type CompetitionProductStatus =
  (typeof COMPETITION_PRODUCT_STATUS)[keyof typeof COMPETITION_PRODUCT_STATUS]

/** Organizer-defined products sold during competition registration. */
export const competitionProductsTable = mysqlTable(
  "competition_products",
  {
    ...commonColumns,
    id: varchar({ length: 255 })
      .primaryKey()
      .$defaultFn(() => createCompetitionProductId())
      .notNull(),
    competitionId: varchar({ length: 255 }).notNull(),
    name: varchar({ length: 255 }).notNull(),
    description: text(),
    imageUrl: varchar({ length: 1024 }),
    priceCents: int().notNull(),
    maxPerAthlete: int(),
    availableUntil: varchar({ length: 10 }),
    status: varchar({ length: 20 })
      .$type<CompetitionProductStatus>()
      .notNull()
      .default(COMPETITION_PRODUCT_STATUS.ACTIVE),
    sortOrder: int().notNull().default(0),
  },
  (table) => [
    index("competition_products_competition_idx").on(table.competitionId),
  ],
)

/** Optional catalog variants with inventory claimed at payment completion. */
export const competitionProductVariantsTable = mysqlTable(
  "competition_product_variants",
  {
    ...commonColumns,
    id: varchar({ length: 255 })
      .primaryKey()
      .$defaultFn(() => createCompetitionProductVariantId())
      .notNull(),
    productId: varchar({ length: 255 }).notNull(),
    label: varchar({ length: 100 }).notNull(),
    stockQty: int(),
    soldQty: int().notNull().default(0),
    sortOrder: int().notNull().default(0),
  },
  (table) => [
    index("competition_product_variants_product_idx").on(table.productId),
  ],
)

export type CompetitionProduct = InferSelectModel<
  typeof competitionProductsTable
>
export type CompetitionProductVariant = InferSelectModel<
  typeof competitionProductVariantsTable
>

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
