import type { InferSelectModel } from "drizzle-orm"
import { relations } from "drizzle-orm"
import { index, int, mysqlTable, text, varchar } from "drizzle-orm/mysql-core"
import {
  commonColumns,
  createCompetitionProductFileId,
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

export const COMPETITION_PRODUCT_DELIVERY = {
  PICKUP: "PICKUP",
  DOWNLOAD: "DOWNLOAD",
} as const

export type CompetitionProductDelivery =
  (typeof COMPETITION_PRODUCT_DELIVERY)[keyof typeof COMPETITION_PRODUCT_DELIVERY]

export const COMPETITION_PRODUCT_ACCESS = {
  OPTIONAL_PURCHASE: "OPTIONAL_PURCHASE",
  INCLUDED_WITH_REGISTRATION: "INCLUDED_WITH_REGISTRATION",
} as const

export type CompetitionProductAccess =
  (typeof COMPETITION_PRODUCT_ACCESS)[keyof typeof COMPETITION_PRODUCT_ACCESS]

export const COMPETITION_PRODUCT_FILE_CLAIM_STATUS = {
  UPLOADED: "UPLOADED",
  CLEANING: "CLEANING",
} as const

export type CompetitionProductFileClaimStatus =
  (typeof COMPETITION_PRODUCT_FILE_CLAIM_STATUS)[keyof typeof COMPETITION_PRODUCT_FILE_CLAIM_STATUS]

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
    delivery: varchar({ length: 20 })
      .$type<CompetitionProductDelivery>()
      .notNull()
      .default(COMPETITION_PRODUCT_DELIVERY.PICKUP),
    access: varchar({ length: 40 })
      .$type<CompetitionProductAccess>()
      .notNull()
      .default(COMPETITION_PRODUCT_ACCESS.OPTIONAL_PURCHASE),
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

/** Files delivered after a downloadable product entitlement is granted. */
export const competitionProductFilesTable = mysqlTable(
  "competition_product_files",
  {
    ...commonColumns,
    id: varchar({ length: 255 })
      .primaryKey()
      .$defaultFn(() => createCompetitionProductFileId())
      .notNull(),
    productId: varchar({ length: 255 }).notNull(),
    title: varchar({ length: 255 }).notNull(),
    r2Key: varchar({ length: 600 }).notNull(),
    originalFilename: varchar({ length: 255 }).notNull(),
    fileSize: int().notNull(),
    mimeType: varchar({ length: 100 }).notNull(),
    sortOrder: int().notNull().default(0),
  },
  (table) => [
    index("competition_product_files_product_idx").on(table.productId),
  ],
)

/** Pending private uploads that may be attached to a competition product. */
export const competitionProductFileClaimsTable = mysqlTable(
  "competition_product_file_claims",
  {
    ...commonColumns,
    r2Key: varchar({ length: 600 }).primaryKey().notNull(),
    competitionId: varchar({ length: 255 }).notNull(),
    uploadedByUserId: varchar({ length: 255 }).notNull(),
    status: varchar({ length: 20 })
      .$type<CompetitionProductFileClaimStatus>()
      .notNull()
      .default(COMPETITION_PRODUCT_FILE_CLAIM_STATUS.UPLOADED),
  },
  (table) => [
    index("competition_product_file_claims_competition_idx").on(
      table.competitionId,
    ),
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
export type CompetitionProductFile = InferSelectModel<
  typeof competitionProductFilesTable
>
export type CompetitionProductFileClaim = InferSelectModel<
  typeof competitionProductFileClaimsTable
>

export const competitionProductsRelations = relations(
  competitionProductsTable,
  ({ one, many }) => ({
    competition: one(competitionsTable, {
      fields: [competitionProductsTable.competitionId],
      references: [competitionsTable.id],
    }),
    variants: many(competitionProductVariantsTable),
    files: many(competitionProductFilesTable),
  }),
)

export const competitionProductFilesRelations = relations(
  competitionProductFilesTable,
  ({ one }) => ({
    product: one(competitionProductsTable, {
      fields: [competitionProductFilesTable.productId],
      references: [competitionProductsTable.id],
    }),
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
