import { createServerFn } from "@tanstack/react-start"
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import {
  documentEntriesTable,
  documentsTable,
  entriesTable,
  entryFieldsTable,
  entryRelationsTable,
  fieldsTable,
  objectsTable,
} from "@/db/schema"
import { getR2Bucket } from "@/lib/env"
import { requireAuth } from "@/server-fns/auth"

type FieldValueMap = Record<string, string | null>

const SQLITE_IN_CHUNK_SIZE = 50
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024
const MAX_DOCUMENT_BASE64_LENGTH = Math.ceil(MAX_DOCUMENT_BYTES / 3) * 4

export interface CrmGym {
  id: string
  name: string
  status: string | null
  priority: string | null
  relationship: string | null
  location: string | null
  website: string | null
  crossfitPage: string | null
  crossfitAffiliateNumber: string | null
  email: string | null
  phone: string | null
  instagram: string | null
  ownerManager: string | null
  lastContacted: string | null
  notes: string | null
  updatedAt: string | null
}

export type CrmContact = {
  id: string
  fullName: string
  email: string | null
  phone: string | null
  status: string | null
  companyId: string | null
  companyName: string | null
  notes: string | null
  updatedAt: string | null
}

export type CrmInteraction = {
  id: string
  source: "Meeting" | "Outreach"
  title: string
  date: string | null
  channel: string | null
  status: string | null
  companyId: string | null
  companyName: string | null
  contactId: string | null
  contactName: string | null
  notes: string | null
  content: string | null
  updatedAt: string | null
}

export type CrmDocument = {
  id: string
  title: string
  filePath: string
  createdAt: string | null
  updatedAt: string | null
}

const gymInputSchema = z.object({
  name: z.string().min(1, "Gym name is required").max(255),
  location: z.string().max(255).optional(),
  website: z.string().max(500).optional(),
  crossfitPage: z.string().max(500).optional(),
  email: z.string().max(255).optional(),
  phone: z.string().max(100).optional(),
  instagram: z.string().max(255).optional(),
  ownerManager: z.string().max(500).optional(),
  status: z.string().max(100).optional(),
  priority: z.string().max(50).optional(),
  relationship: z.string().max(255).optional(),
  notes: z.string().max(4000).optional(),
})

const gymUpdateSchema = gymInputSchema.extend({
  id: z.string().min(1, "Gym ID is required"),
})

const contactInputSchema = z.object({
  fullName: z.string().min(1, "Name is required").max(255),
  email: z.string().max(255).optional(),
  phone: z.string().max(100).optional(),
  status: z.string().max(100).optional(),
  companyId: z.string().optional(),
  notes: z.string().max(4000).optional(),
})

const contactUpdateSchema = contactInputSchema.extend({
  id: z.string().min(1, "Contact ID is required"),
})

const interactionInputSchema = z.object({
  title: z.string().min(1, "Subject is required").max(255),
  date: z.string().max(20).optional(),
  channel: z.string().max(100).optional(),
  status: z.string().max(100).optional(),
  companyId: z.string().optional(),
  contactId: z.string().optional(),
  notes: z.string().max(4000).optional(),
  content: z.string().max(10000).optional(),
})

const interactionUpdateSchema = interactionInputSchema.extend({
  id: z.string().min(1, "Interaction ID is required"),
  source: z.enum(["Meeting", "Outreach"]),
})

export const documentUploadSchema = z.object({
  entryId: z.string().min(1, "Entry ID is required"),
  fileName: z.string().min(1, "File name is required"),
  fileBase64: z.string().max(MAX_DOCUMENT_BASE64_LENGTH),
  contentType: z.string().min(1, "Content type is required"),
  fileSize: z.number().int().nonnegative().max(MAX_DOCUMENT_BYTES),
  title: z.string().max(255).optional(),
})

const entryDocumentListSchema = z.object({
  entryId: z.string().min(1, "Entry ID is required"),
})

const documentIdSchema = z.object({
  documentId: z.string().min(1, "Document ID is required"),
})

function crmId() {
  return crypto.randomUUID()
}

function clean(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export function extractCrossFitAffiliateNumber(
  page: string | null | undefined,
) {
  const normalized = clean(page)
  if (!normalized) return null

  // `@lat`: [[crm-crossfit-metadata]]
  const urlInput = /^[a-z][a-z\d+\-.]*:\/\//i.test(normalized)
    ? normalized
    : `https://${normalized}`

  let url: URL
  try {
    // `@lat`: [[crm-crossfit-metadata]]
    url = new URL(urlInput)
  } catch {
    return null
  }

  const hostname = url.hostname.toLowerCase()
  const pathname = url.pathname.toLowerCase()
  const allowedHosts = new Set(["www.crossfit.com", "crossfit.com"])
  // `@lat`: [[crm-crossfit-metadata]]
  const isCrossFitHost = allowedHosts.has(hostname)
  const isGamesHost = hostname === "games.crossfit.com"
  if (!isCrossFitHost && !isGamesHost) return null

  // `@lat`: [[crm-crossfit-metadata]]
  const match = pathname.match(
    isGamesHost
      ? /^\/affiliate\/(\d+)(?:\/|$)/
      : /^\/(?:gym|affiliate)\/(\d+)(?:\/|$)/,
  )

  return match?.[1] ?? null
}

async function assertEntryExists(entryId: string) {
  const db = getDb()
  const [entry] = await db
    .select({ id: entriesTable.id })
    .from(entriesTable)
    .where(eq(entriesTable.id, entryId))
    .limit(1)

  if (!entry) {
    throw new Error(`CRM entry not found: ${entryId}`)
  }

  return entry
}

function sanitizeFileName(fileName: string) {
  return (
    fileName
      .trim()
      .replaceAll(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 120) || "document"
  )
}

function decodeBase64(fileBase64: string) {
  const binaryString = atob(fileBase64)
  const bytes = new Uint8Array(binaryString.length)
  for (let index = 0; index < binaryString.length; index += 1) {
    bytes[index] = binaryString.charCodeAt(index)
  }
  return bytes
}

function chunks<T>(values: T[], size: number) {
  const result: T[][] = []
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size))
  }
  return result
}

async function getObject(name: string) {
  const db = getDb()
  const [object] = await db
    .select()
    .from(objectsTable)
    .where(sql`lower(${objectsTable.name}) = ${name.toLowerCase()}`)
    .limit(1)

  if (!object) {
    throw new Error(`CRM object not found: ${name}`)
  }

  return object
}

async function getFieldsByName(objectId: string) {
  const db = getDb()
  const fields = await db
    .select()
    .from(fieldsTable)
    .where(eq(fieldsTable.objectId, objectId))
    .orderBy(asc(fieldsTable.sortOrder), asc(fieldsTable.name))

  return new Map(fields.map((field) => [field.name, field]))
}

async function ensureField({
  objectId,
  name,
  type,
  sortOrder,
}: {
  objectId: string
  name: string
  type: string
  sortOrder: number
}) {
  const db = getDb()
  await db
    .insert(fieldsTable)
    .values({
      id: crmId(),
      objectId,
      name,
      type,
      sortOrder,
      updatedAt: sql`CURRENT_TIMESTAMP`,
    })
    .onConflictDoNothing({
      target: [fieldsTable.objectId, fieldsTable.name],
    })
}

async function getFieldValues(entryIds: string[]) {
  if (entryIds.length === 0) return new Map<string, FieldValueMap>()

  const db = getDb()
  const rows = (
    await Promise.all(
      chunks(entryIds, SQLITE_IN_CHUNK_SIZE).map((entryIdChunk) =>
        db
          .select({
            entryId: entryFieldsTable.entryId,
            value: entryFieldsTable.value,
            fieldName: fieldsTable.name,
          })
          .from(entryFieldsTable)
          .innerJoin(fieldsTable, eq(entryFieldsTable.fieldId, fieldsTable.id))
          .where(inArray(entryFieldsTable.entryId, entryIdChunk)),
      ),
    )
  ).flat()

  const values = new Map<string, FieldValueMap>()
  for (const row of rows) {
    const entryValues = values.get(row.entryId) ?? {}
    entryValues[row.fieldName] = row.value
    values.set(row.entryId, entryValues)
  }

  return values
}

async function getRelationTargets(entryIds: string[]) {
  if (entryIds.length === 0) return new Map<string, Record<string, string[]>>()

  const db = getDb()
  const rows = (
    await Promise.all(
      chunks(entryIds, SQLITE_IN_CHUNK_SIZE).map((entryIdChunk) =>
        db
          .select({
            sourceEntryId: entryRelationsTable.sourceEntryId,
            targetEntryId: entryRelationsTable.targetEntryId,
            fieldName: fieldsTable.name,
          })
          .from(entryRelationsTable)
          .innerJoin(
            fieldsTable,
            eq(entryRelationsTable.fieldId, fieldsTable.id),
          )
          .where(inArray(entryRelationsTable.sourceEntryId, entryIdChunk))
          .orderBy(asc(entryRelationsTable.sortOrder)),
      ),
    )
  ).flat()

  const relations = new Map<string, Record<string, string[]>>()
  for (const row of rows) {
    const entryRelations = relations.get(row.sourceEntryId) ?? {}
    const targets = entryRelations[row.fieldName] ?? []
    targets.push(row.targetEntryId)
    entryRelations[row.fieldName] = targets
    relations.set(row.sourceEntryId, entryRelations)
  }

  return relations
}

async function getEntryDisplayNames(entryIds: string[]) {
  const uniqueIds = Array.from(new Set(entryIds.filter(Boolean)))
  if (uniqueIds.length === 0) return new Map<string, string>()

  const db = getDb()
  const rows = (
    await Promise.all(
      chunks(uniqueIds, SQLITE_IN_CHUNK_SIZE).map((entryIdChunk) =>
        db
          .select({
            entryId: entryFieldsTable.entryId,
            value: entryFieldsTable.value,
            fieldName: fieldsTable.name,
          })
          .from(entryFieldsTable)
          .innerJoin(fieldsTable, eq(entryFieldsTable.fieldId, fieldsTable.id))
          .where(inArray(entryFieldsTable.entryId, entryIdChunk)),
      ),
    )
  ).flat()

  const priority = ["Company Name", "Full Name", "Title", "Subject"]
  const names = new Map<string, string>()
  for (const fieldName of priority) {
    for (const row of rows) {
      if (row.fieldName === fieldName && row.value && !names.has(row.entryId)) {
        names.set(row.entryId, row.value)
      }
    }
  }

  return names
}

async function listDocumentsForEntry(entryId: string) {
  const db = getDb()
  return db
    .select({
      id: documentsTable.id,
      title: documentsTable.title,
      filePath: documentsTable.filePath,
      createdAt: documentsTable.createdAt,
      updatedAt: documentsTable.updatedAt,
    })
    .from(documentEntriesTable)
    .innerJoin(
      documentsTable,
      eq(documentEntriesTable.documentId, documentsTable.id),
    )
    .where(eq(documentEntriesTable.entryId, entryId))
    .orderBy(desc(documentEntriesTable.createdAt))
}

export async function uploadDocumentForEntry(
  data: z.infer<typeof documentUploadSchema>,
) {
  await assertEntryExists(data.entryId)

  const bytes = decodeBase64(data.fileBase64)
  if (bytes.byteLength > MAX_DOCUMENT_BYTES) {
    throw new Error("File too large (max 10 MB)")
  }
  if (bytes.byteLength !== data.fileSize) {
    throw new Error("File size does not match payload")
  }

  const fileName = sanitizeFileName(data.fileName)
  const datePrefix = new Date().toISOString().slice(0, 7)
  const r2Key = `crm-documents/${datePrefix}/${crmId()}-${fileName}`

  await getR2Bucket().put(r2Key, bytes.buffer, {
    httpMetadata: {
      contentType: data.contentType,
    },
  })

  const db = getDb()
  const [document] = await db
    .insert(documentsTable)
    .values({
      id: crmId(),
      title: data.title || fileName,
      filePath: r2Key,
      updatedAt: sql`CURRENT_TIMESTAMP`,
    })
    .returning()

  if (!document) {
    throw new Error("Unable to create document")
  }

  await db.insert(documentEntriesTable).values({
    id: crmId(),
    documentId: document.id,
    entryId: data.entryId,
    updatedAt: sql`CURRENT_TIMESTAMP`,
  })

  return document
}

async function listEntries(objectName: string, limit = 250) {
  const db = getDb()
  const object = await getObject(objectName)
  const entries = await db
    .select()
    .from(entriesTable)
    .where(eq(entriesTable.objectId, object.id))
    .orderBy(desc(entriesTable.updatedAt), desc(entriesTable.createdAt))
    .limit(limit)

  const entryIds = entries.map((entry) => entry.id)
  const [values, relations] = await Promise.all([
    getFieldValues(entryIds),
    getRelationTargets(entryIds),
  ])

  return { entries, values, relations }
}

async function upsertFieldValue(
  entryId: string,
  fieldId: string,
  value: string | null,
) {
  const db = getDb()
  await db
    .insert(entryFieldsTable)
    .values({
      id: crmId(),
      entryId,
      fieldId,
      value,
      updatedAt: sql`CURRENT_TIMESTAMP`,
    })
    .onConflictDoUpdate({
      target: [entryFieldsTable.entryId, entryFieldsTable.fieldId],
      set: {
        value,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      },
    })
}

async function setRelation(
  entryId: string,
  fieldId: string,
  targetEntryId: string | null,
) {
  const db = getDb()
  await db
    .delete(entryRelationsTable)
    .where(
      and(
        eq(entryRelationsTable.sourceEntryId, entryId),
        eq(entryRelationsTable.fieldId, fieldId),
      ),
    )

  await upsertFieldValue(entryId, fieldId, targetEntryId)

  if (!targetEntryId) return

  await db.insert(entryRelationsTable).values({
    id: crmId(),
    sourceEntryId: entryId,
    fieldId,
    targetEntryId,
    updatedAt: sql`CURRENT_TIMESTAMP`,
  })
}

async function touchEntry(entryId: string) {
  const db = getDb()
  await db
    .update(entriesTable)
    .set({ updatedAt: sql`CURRENT_TIMESTAMP` })
    .where(eq(entriesTable.id, entryId))
}

async function createEntry(objectName: string) {
  const db = getDb()
  const object = await getObject(objectName)
  const entryId = crmId()
  await db.insert(entriesTable).values({
    id: entryId,
    objectId: object.id,
    updatedAt: sql`CURRENT_TIMESTAMP`,
  })
  return { entryId, object }
}

function requireField(
  fields: Map<string, { id: string }>,
  name: string,
  objectName: string,
) {
  const field = fields.get(name)
  if (!field) {
    throw new Error(`CRM field not found on ${objectName}: ${name}`)
  }
  return field
}

export async function getCrmData() {
  await requireAuth()

  const [gymsData, contactsData, outreachData, meetingsData] =
    await Promise.all([
      listEntries("Company"),
      listEntries("People"),
      listEntries("Outreach"),
      listEntries("Meeting"),
    ])

  const relationIds = [
    ...contactsData.entries.flatMap(
      (entry) => contactsData.relations.get(entry.id)?.Company ?? [],
    ),
    ...outreachData.entries.flatMap((entry) => [
      ...(outreachData.relations.get(entry.id)?.Company ?? []),
      ...(outreachData.relations.get(entry.id)?.Person ?? []),
    ]),
    ...meetingsData.entries.flatMap((entry) => [
      ...(meetingsData.relations.get(entry.id)?.Company ?? []),
      ...(meetingsData.relations.get(entry.id)?.Contact ?? []),
    ]),
  ]
  const displayNames = await getEntryDisplayNames(relationIds)

  const gyms: CrmGym[] = gymsData.entries.map((entry) => {
    const values = gymsData.values.get(entry.id) ?? {}
    return {
      id: entry.id,
      name: values["Company Name"] ?? "Untitled gym",
      status: values["Wodsmith Status"] ?? values.Type ?? null,
      priority: values.Priority ?? null,
      relationship: values.Relationship ?? null,
      location: values.Location ?? null,
      website: values.Website ?? null,
      crossfitPage: values["CrossFit Page"] ?? null,
      crossfitAffiliateNumber: extractCrossFitAffiliateNumber(
        values["CrossFit Page"],
      ),
      email: values["Email Address"] ?? null,
      phone: values["Phone Number"] ?? null,
      instagram: values.Instagram ?? null,
      ownerManager: values["Owner/Manager"] ?? null,
      lastContacted: values["Last Contacted"] ?? null,
      notes: values.Notes ?? null,
      updatedAt: entry.updatedAt,
    }
  })

  const contacts: CrmContact[] = contactsData.entries.map((entry) => {
    const values = contactsData.values.get(entry.id) ?? {}
    const companyId =
      contactsData.relations.get(entry.id)?.Company?.[0] ??
      values.Company ??
      null
    return {
      id: entry.id,
      fullName: values["Full Name"] ?? "Unnamed contact",
      email: values["Email Address"] ?? null,
      phone: values["Phone Number"] ?? null,
      status: values.Status ?? null,
      companyId,
      companyName: companyId ? (displayNames.get(companyId) ?? null) : null,
      notes: values.Notes ?? null,
      updatedAt: entry.updatedAt,
    }
  })

  const outreachInteractions: CrmInteraction[] = outreachData.entries.map(
    (entry) => {
      const values = outreachData.values.get(entry.id) ?? {}
      const relations = outreachData.relations.get(entry.id) ?? {}
      const companyId = relations.Company?.[0] ?? values.Company ?? null
      const contactId = relations.Person?.[0] ?? values.Person ?? null
      return {
        id: entry.id,
        source: "Outreach",
        title: values.Subject ?? "Untitled outreach",
        date: values["Date Sent"] ?? null,
        channel: values.Channel ?? null,
        status: values.Status ?? null,
        companyId,
        companyName: companyId ? (displayNames.get(companyId) ?? null) : null,
        contactId,
        contactName: contactId ? (displayNames.get(contactId) ?? null) : null,
        notes: values.Notes ?? null,
        content: values.Content ?? null,
        updatedAt: entry.updatedAt,
      }
    },
  )

  const meetingInteractions: CrmInteraction[] = meetingsData.entries.map(
    (entry) => {
      const values = meetingsData.values.get(entry.id) ?? {}
      const relations = meetingsData.relations.get(entry.id) ?? {}
      const companyId = relations.Company?.[0] ?? values.Company ?? null
      const contactId = relations.Contact?.[0] ?? values.Contact ?? null
      return {
        id: entry.id,
        source: "Meeting",
        title: values.Title ?? "Untitled meeting",
        date: values.Date ?? null,
        channel: values.Type ?? null,
        status: values.Status ?? null,
        companyId,
        companyName: companyId ? (displayNames.get(companyId) ?? null) : null,
        contactId,
        contactName: contactId ? (displayNames.get(contactId) ?? null) : null,
        notes: values.Notes ?? values.Outcome ?? null,
        content: values.Outcome ?? null,
        updatedAt: entry.updatedAt,
      }
    },
  )

  const interactions = [...outreachInteractions, ...meetingInteractions].sort(
    (a, b) =>
      new Date(b.date ?? b.updatedAt ?? 0).getTime() -
      new Date(a.date ?? a.updatedAt ?? 0).getTime(),
  )

  return { gyms, contacts, interactions }
}

export const getCrmDataFn = createServerFn({ method: "GET" }).handler(
  getCrmData,
)

export const createGymFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => gymInputSchema.parse(data))
  .handler(async ({ data }) => {
    await requireAuth()
    const { entryId, object } = await createEntry("Company")
    await ensureField({
      objectId: object.id,
      name: "CrossFit Page",
      type: "url",
      sortOrder: 70,
    })
    const fields = await getFieldsByName(object.id)

    const updates: Array<[string, string | null]> = [
      ["Company Name", data.name],
      ["Industry", "Fitness"],
      ["Type", "Prospect"],
      ["Location", clean(data.location)],
      ["Website", clean(data.website)],
      ["CrossFit Page", clean(data.crossfitPage)],
      ["Email Address", clean(data.email)],
      ["Phone Number", clean(data.phone)],
      ["Instagram", clean(data.instagram)],
      ["Owner/Manager", clean(data.ownerManager)],
      ["Wodsmith Status", clean(data.status) ?? "Prospect"],
      ["Priority", clean(data.priority)],
      ["Relationship", clean(data.relationship)],
      ["Notes", clean(data.notes)],
    ]

    for (const [fieldName, value] of updates) {
      const field = fields.get(fieldName)
      if (field) await upsertFieldValue(entryId, field.id, value)
    }

    return { id: entryId }
  })

export const updateGymFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => gymUpdateSchema.parse(data))
  .handler(async ({ data }) => {
    await requireAuth()
    await assertEntryExists(data.id)
    const object = await getObject("Company")
    await ensureField({
      objectId: object.id,
      name: "CrossFit Page",
      type: "url",
      sortOrder: 70,
    })
    const fields = await getFieldsByName(object.id)

    const updates: Array<[string, string | null]> = [
      ["Company Name", data.name],
      ["Location", clean(data.location)],
      ["Website", clean(data.website)],
      ["CrossFit Page", clean(data.crossfitPage)],
      ["Email Address", clean(data.email)],
      ["Phone Number", clean(data.phone)],
      ["Instagram", clean(data.instagram)],
      ["Owner/Manager", clean(data.ownerManager)],
      ["Wodsmith Status", clean(data.status)],
      ["Priority", clean(data.priority)],
      ["Relationship", clean(data.relationship)],
      ["Notes", clean(data.notes)],
    ]

    for (const [fieldName, value] of updates) {
      const field = fields.get(fieldName)
      if (field) await upsertFieldValue(data.id, field.id, value)
    }

    await touchEntry(data.id)
    return { id: data.id }
  })

export const createContactFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => contactInputSchema.parse(data))
  .handler(async ({ data }) => {
    await requireAuth()
    const { entryId, object } = await createEntry("People")
    const fields = await getFieldsByName(object.id)

    const updates: Array<[string, string | null]> = [
      ["Full Name", data.fullName],
      ["Email Address", clean(data.email)],
      ["Phone Number", clean(data.phone)],
      ["Status", clean(data.status) ?? "Lead"],
      ["Notes", clean(data.notes)],
    ]

    for (const [fieldName, value] of updates) {
      const field = fields.get(fieldName)
      if (field) await upsertFieldValue(entryId, field.id, value)
    }

    const companyField = fields.get("Company")
    if (companyField) {
      await setRelation(entryId, companyField.id, clean(data.companyId))
    }

    return { id: entryId }
  })

export const updateContactFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => contactUpdateSchema.parse(data))
  .handler(async ({ data }) => {
    await requireAuth()
    await assertEntryExists(data.id)
    const object = await getObject("People")
    const fields = await getFieldsByName(object.id)

    const updates: Array<[string, string | null]> = [
      ["Full Name", data.fullName],
      ["Email Address", clean(data.email)],
      ["Phone Number", clean(data.phone)],
      ["Status", clean(data.status)],
      ["Notes", clean(data.notes)],
    ]

    for (const [fieldName, value] of updates) {
      const field = fields.get(fieldName)
      if (field) await upsertFieldValue(data.id, field.id, value)
    }

    const companyField = fields.get("Company")
    if (companyField) {
      await setRelation(data.id, companyField.id, clean(data.companyId))
    }

    await touchEntry(data.id)
    return { id: data.id }
  })

export const createInteractionFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => interactionInputSchema.parse(data))
  .handler(async ({ data }) => {
    await requireAuth()
    const { entryId, object } = await createEntry("Outreach")
    const fields = await getFieldsByName(object.id)

    const updates: Array<[string, string | null]> = [
      ["Subject", data.title],
      ["Date Sent", clean(data.date) ?? new Date().toISOString().slice(0, 10)],
      ["Channel", clean(data.channel) ?? "Email"],
      ["Status", clean(data.status) ?? "Sent"],
      ["Notes", clean(data.notes)],
      ["Content", clean(data.content)],
    ]

    for (const [fieldName, value] of updates) {
      const field = fields.get(fieldName)
      if (field) await upsertFieldValue(entryId, field.id, value)
    }

    const companyField = fields.get("Company")
    if (companyField) {
      await setRelation(entryId, companyField.id, clean(data.companyId))
    }

    const personField = requireField(fields, "Person", "Outreach")
    await setRelation(entryId, personField.id, clean(data.contactId))

    return { id: entryId }
  })

export const updateInteractionFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => interactionUpdateSchema.parse(data))
  .handler(async ({ data }) => {
    await requireAuth()
    await assertEntryExists(data.id)
    const objectName = data.source === "Meeting" ? "Meeting" : "Outreach"
    const object = await getObject(objectName)
    const fields = await getFieldsByName(object.id)

    const updates: Array<[string, string | null]> =
      data.source === "Meeting"
        ? [
            ["Title", data.title],
            ["Date", clean(data.date)],
            ["Type", clean(data.channel)],
            ["Status", clean(data.status)],
            ["Notes", clean(data.notes)],
            ["Outcome", clean(data.content)],
          ]
        : [
            ["Subject", data.title],
            ["Date Sent", clean(data.date)],
            ["Channel", clean(data.channel)],
            ["Status", clean(data.status)],
            ["Notes", clean(data.notes)],
            ["Content", clean(data.content)],
          ]

    for (const [fieldName, value] of updates) {
      const field = fields.get(fieldName)
      if (field) await upsertFieldValue(data.id, field.id, value)
    }

    const companyField = fields.get("Company")
    if (companyField) {
      await setRelation(data.id, companyField.id, clean(data.companyId))
    }

    const contactField = fields.get(
      data.source === "Meeting" ? "Contact" : "Person",
    )
    if (contactField) {
      await setRelation(data.id, contactField.id, clean(data.contactId))
    }

    await touchEntry(data.id)
    return { id: data.id }
  })

export const listDocumentsForEntryFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => entryDocumentListSchema.parse(data))
  .handler(async ({ data }) => {
    await requireAuth()
    return listDocumentsForEntry(data.entryId)
  })

export const uploadDocumentForEntryFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => documentUploadSchema.parse(data))
  .handler(async ({ data }) => {
    await requireAuth()
    return uploadDocumentForEntry(data)
  })

export const deleteDocumentForEntryFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    return documentIdSchema
      .extend({ entryId: z.string().min(1, "Entry ID is required") })
      .parse(data)
  })
  .handler(async ({ data }) => {
    await requireAuth()
    const db = getDb()

    const [documentRelation] = await db
      .select({
        filePath: documentsTable.filePath,
      })
      .from(documentEntriesTable)
      .innerJoin(
        documentsTable,
        eq(documentEntriesTable.documentId, documentsTable.id),
      )
      .where(
        and(
          eq(documentEntriesTable.documentId, data.documentId),
          eq(documentEntriesTable.entryId, data.entryId),
        ),
      )
      .limit(1)

    if (!documentRelation) {
      throw new Error("Document link not found")
    }

    await db
      .delete(documentEntriesTable)
      .where(eq(documentEntriesTable.documentId, data.documentId))

    await getR2Bucket().delete(documentRelation.filePath)
    await db
      .delete(documentsTable)
      .where(eq(documentsTable.id, data.documentId))

    return { success: true }
  })

export const getDocumentDownloadUrlForEntryFn = createServerFn({
  method: "GET",
})
  .inputValidator((data: unknown) => documentIdSchema.parse(data))
  .handler(async ({ data }) => {
    await requireAuth()
    const db = getDb()

    const [document] = await db
      .select({
        fileName: documentsTable.title,
        filePath: documentsTable.filePath,
      })
      .from(documentsTable)
      .where(eq(documentsTable.id, data.documentId))
      .limit(1)

    if (!document) {
      throw new Error("Document not found")
    }

    const object = await getR2Bucket().get(document.filePath)
    if (!object) {
      throw new Error("File not found in storage")
    }

    const arrayBuffer = await object.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)
    const chunks: string[] = []
    const chunkSize = 0x8000
    for (let index = 0; index < bytes.length; index += chunkSize) {
      chunks.push(
        String.fromCharCode(...bytes.subarray(index, index + chunkSize)),
      )
    }

    return {
      base64: btoa(chunks.join("")),
      fileName: document.fileName,
      contentType:
        object.httpMetadata?.contentType || "application/octet-stream",
    }
  })
