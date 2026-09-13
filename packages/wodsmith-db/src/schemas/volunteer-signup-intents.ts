import {
  boolean,
  datetime,
  index,
  mysqlTable,
  text,
  varchar,
} from "drizzle-orm/mysql-core"

// Separate from invitations: deleting an application must never revive its proof.
export const volunteerSignupIntentsTable = mysqlTable(
  "volunteer_signup_intents",
  {
    id: varchar({ length: 255 }).primaryKey(),
    codeHash: varchar({ length: 64 }).notNull().unique(),
    purpose: varchar({ length: 32 }).notNull(),
    email: varchar({ length: 255 }).notNull(),
    userId: varchar({ length: 255 }).notNull(),
    existingAccount: boolean().notNull(),
    application: text().notNull(),
    returnPath: varchar({ length: 600 }).notNull(),
    expiresAt: datetime({ mode: "date", fsp: 3 }).notNull(),
    consumedAt: datetime({ mode: "date", fsp: 3 }),
  },
  (table) => [index("volunteer_signup_intents_expiry_idx").on(table.expiresAt)],
)
