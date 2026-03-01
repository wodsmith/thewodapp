import { createServerFn } from "@tanstack/react-start"
import { desc, eq } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import {
	DOCUMENT_CATEGORIES,
	PAYMENT_STATUSES,
	SUBSCRIPTION_TERMS,
	documentsTable,
} from "@/db/schema"
import { getR2Bucket } from "@/lib/env"
import { requireAuth } from "./auth"

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024 // 10 MB
const MAX_BASE64_LENGTH = Math.ceil(MAX_UPLOAD_BYTES / 3) * 4

export const listDocumentsFn = createServerFn({ method: "GET" }).handler(async () => {
	await requireAuth()
	const db = getDb()
	const documents = await db
		.select()
		.from(documentsTable)
		.orderBy(desc(documentsTable.createdAt))
	return documents
})

export const uploadDocumentFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) =>
		z.object({
			fileName: z.string(),
			vendor: z.string().min(1),
			description: z.string().optional(),
			amountCents: z.number().int().optional(),
			currency: z.string().default("USD"),
			subscriptionTerm: z.enum(SUBSCRIPTION_TERMS).optional(),
			category: z.enum(DOCUMENT_CATEGORIES).optional(),
			invoiceDate: z.string().optional(),
			dueDate: z.string().optional(),
			status: z.enum(PAYMENT_STATUSES).default("unpaid"),
			contentType: z.string().optional(),
			fileSize: z.number().int().optional(),
			fileBase64: z.string().max(MAX_BASE64_LENGTH, "File too large (max 10 MB)"),
		}).parse(data),
	)
	.handler(async ({ data }) => {
		await requireAuth()
		const db = getDb()
		const { fileBase64, ...metadata } = data

		// Runtime guard on declared file size
		if (metadata.fileSize && metadata.fileSize > MAX_UPLOAD_BYTES) {
			throw new Error("File too large (max 10 MB)")
		}

		// Decode base64 file content
		const binaryString = atob(fileBase64)
		const bytes = new Uint8Array(binaryString.length)
		for (let i = 0; i < binaryString.length; i++) {
			bytes[i] = binaryString.charCodeAt(i)
		}

		// Generate R2 key with date prefix for organization
		const datePrefix = new Date().toISOString().slice(0, 7) // YYYY-MM
		const r2Key = `invoices/${datePrefix}/${crypto.randomUUID()}-${metadata.fileName}`

		// Upload to R2
		await getR2Bucket().put(r2Key, bytes.buffer, {
			httpMetadata: {
				contentType: metadata.contentType || "application/octet-stream",
			},
		})

		// Save metadata to D1
		const [document] = await db
			.insert(documentsTable)
			.values({
				...metadata,
				r2Key,
				updatedAt: new Date(),
			})
			.returning()

		return document
	})

export const deleteDocumentFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => z.object({ id: z.string() }).parse(data))
	.handler(async ({ data }) => {
		await requireAuth()
		const db = getDb()

		// Get the document to find the R2 key
		const [document] = await db
			.select()
			.from(documentsTable)
			.where(eq(documentsTable.id, data.id))

		if (!document) {
			throw new Error("Document not found")
		}

		// Delete from R2
		await getR2Bucket().delete(document.r2Key)

		// Delete from D1
		await db.delete(documentsTable).where(eq(documentsTable.id, data.id))

		return { success: true }
	})

export const getDocumentDownloadUrlFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) => z.object({ id: z.string() }).parse(data))
	.handler(async ({ data }) => {
		await requireAuth()
		const db = getDb()

		const [document] = await db
			.select()
			.from(documentsTable)
			.where(eq(documentsTable.id, data.id))

		if (!document) {
			throw new Error("Document not found")
		}

		// Get the object from R2
		const object = await getR2Bucket().get(document.r2Key)
		if (!object) {
			throw new Error("File not found in storage")
		}

		// Convert to base64 for transfer using chunked approach (avoids O(n²) concatenation)
		const arrayBuffer = await object.arrayBuffer()
		const bytes = new Uint8Array(arrayBuffer)
		const CHUNK_SIZE = 0x8000 // 32KB chunks
		const chunks: string[] = []
		for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
			chunks.push(
				String.fromCharCode(...bytes.subarray(i, i + CHUNK_SIZE)),
			)
		}
		const base64 = btoa(chunks.join(""))

		return {
			base64,
			contentType: document.contentType || "application/octet-stream",
			fileName: document.fileName,
		}
	})
