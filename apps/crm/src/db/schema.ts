import { sql } from "drizzle-orm"
import {
  type AnySQLiteColumn,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core"

const nanoidAlphabet =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_-"

function nanoid32() {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => nanoidAlphabet[byte & 63]).join("")
}

const id = () => text("id").primaryKey().$defaultFn(nanoid32)

const timestamps = {
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
}

export const objectsTable = sqliteTable(
  "objects",
  {
    id: id(),
    name: text("name").notNull(),
    description: text("description"),
    icon: text("icon"),
    defaultView: text("default_view").default("table"),
    parentDocumentId: text("parent_document_id"),
    sortOrder: integer("sort_order").default(0),
    sourceApp: text("source_app"),
    immutable: integer("immutable", { mode: "boolean" }).default(false),
    displayField: text("display_field"),
    ...timestamps,
  },
  (table) => [uniqueIndex("objects_name_unique").on(table.name)],
)

export const fieldsTable = sqliteTable(
  "fields",
  {
    id: id(),
    objectId: text("object_id")
      .notNull()
      .references(() => objectsTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    type: text("type").notNull(),
    required: integer("required", { mode: "boolean" }).default(false),
    defaultValue: text("default_value"),
    relatedObjectId: text("related_object_id").references(
      () => objectsTable.id,
      {
        onDelete: "set null",
      },
    ),
    relationshipType: text("relationship_type"),
    enumValues: text("enum_values", { mode: "json" }),
    enumColors: text("enum_colors", { mode: "json" }),
    enumMultiple: integer("enum_multiple", { mode: "boolean" }).default(false),
    sortOrder: integer("sort_order").default(0),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("fields_object_name_unique").on(table.objectId, table.name),
  ],
)

export const entriesTable = sqliteTable("entries", {
  id: id(),
  objectId: text("object_id")
    .notNull()
    .references(() => objectsTable.id, { onDelete: "cascade" }),
  sortOrder: integer("sort_order").default(0),
  ...timestamps,
})

export const entryFieldsTable = sqliteTable(
  "entry_fields",
  {
    id: id(),
    entryId: text("entry_id")
      .notNull()
      .references(() => entriesTable.id, { onDelete: "cascade" }),
    fieldId: text("field_id")
      .notNull()
      .references(() => fieldsTable.id, { onDelete: "cascade" }),
    value: text("value"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("entry_fields_entry_field_unique").on(
      table.entryId,
      table.fieldId,
    ),
  ],
)

export const entryRelationsTable = sqliteTable(
  "entry_relations",
  {
    id: id(),
    sourceEntryId: text("source_entry_id")
      .notNull()
      .references(() => entriesTable.id, { onDelete: "cascade" }),
    fieldId: text("field_id")
      .notNull()
      .references(() => fieldsTable.id, { onDelete: "cascade" }),
    targetEntryId: text("target_entry_id")
      .notNull()
      .references(() => entriesTable.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").default(0),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("entry_relations_source_field_target_unique").on(
      table.sourceEntryId,
      table.fieldId,
      table.targetEntryId,
    ),
  ],
)

export const statusesTable = sqliteTable(
  "statuses",
  {
    id: id(),
    objectId: text("object_id")
      .notNull()
      .references(() => objectsTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").default("#94a3b8"),
    sortOrder: integer("sort_order").default(0),
    isDefault: integer("is_default", { mode: "boolean" }).default(false),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("statuses_object_name_unique").on(table.objectId, table.name),
  ],
)

export const documentsTable = sqliteTable(
  "documents",
  {
    id: id(),
    title: text("title").default("Untitled"),
    icon: text("icon"),
    coverImage: text("cover_image"),
    filePath: text("file_path").notNull(),
    parentId: text("parent_id").references(
      (): AnySQLiteColumn => documentsTable.id,
      {
        onDelete: "cascade",
      },
    ),
    parentObjectId: text("parent_object_id").references(() => objectsTable.id, {
      onDelete: "cascade",
    }),
    sortOrder: integer("sort_order").default(0),
    isPublished: integer("is_published", { mode: "boolean" }).default(false),
    ...timestamps,
  },
  (table) => [uniqueIndex("documents_file_path_unique").on(table.filePath)],
)

export type CrmObject = typeof objectsTable.$inferSelect
export type NewCrmObject = typeof objectsTable.$inferInsert
export type CrmField = typeof fieldsTable.$inferSelect
export type NewCrmField = typeof fieldsTable.$inferInsert
export type CrmEntry = typeof entriesTable.$inferSelect
export type NewCrmEntry = typeof entriesTable.$inferInsert
export type CrmEntryField = typeof entryFieldsTable.$inferSelect
export type NewCrmEntryField = typeof entryFieldsTable.$inferInsert
export type CrmEntryRelation = typeof entryRelationsTable.$inferSelect
export type NewCrmEntryRelation = typeof entryRelationsTable.$inferInsert
export type CrmStatus = typeof statusesTable.$inferSelect
export type NewCrmStatus = typeof statusesTable.$inferInsert
export type CrmDocument = typeof documentsTable.$inferSelect
export type NewCrmDocument = typeof documentsTable.$inferInsert
