import { createServerFn } from "@tanstack/react-start"
import { env } from "cloudflare:workers"
import { desc, eq } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import {
	DOCUMENT_CATEGORIES,
	PAYMENT_STATUSES,
	SUBSCRIPTION_TERMS,
	documentsTable,
} from "@/db/schema"

export const listDocumentsFn = createServerFn().handler(async () => {
	const db = getDb()
	const documents = await db
		.select()
		.from(documentsTable)
		.orderBy(desc(documentsTable.createdAt))
	return documents
})

export const uploadDocumentFn = createServerFn()
	.validator(
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
			fileBase64: z.string(),
		}),
	)
	.handler(async ({ data }) => {
		const db = getDb()
		const { fileBase64, ...metadata } = data

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
		await env.R2_BUCKET.put(r2Key, bytes.buffer, {
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

export const deleteDocumentFn = createServerFn()
	.validator(z.object({ id: z.string() }))
	.handler(async ({ data }) => {
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
		await env.R2_BUCKET.delete(document.r2Key)

		// Delete from D1
		await db.delete(documentsTable).where(eq(documentsTable.id, data.id))

		return { success: true }
	})

export const getDocumentDownloadUrlFn = createServerFn()
	.validator(z.object({ id: z.string() }))
	.handler(async ({ data }) => {
		const db = getDb()

		const [document] = await db
			.select()
			.from(documentsTable)
			.where(eq(documentsTable.id, data.id))

		if (!document) {
			throw new Error("Document not found")
		}

		// Get the object from R2
		const object = await env.R2_BUCKET.get(document.r2Key)
		if (!object) {
			throw new Error("File not found in storage")
		}

		// Convert to base64 for transfer
		const arrayBuffer = await object.arrayBuffer()
		const bytes = new Uint8Array(arrayBuffer)
		let binary = ""
		for (let i = 0; i < bytes.length; i++) {
			binary += String.fromCharCode(bytes[i])
		}
		const base64 = btoa(binary)

		return {
			base64,
			contentType: document.contentType || "application/octet-stream",
			fileName: document.fileName,
		}
	})
