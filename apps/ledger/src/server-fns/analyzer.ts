import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import {
	createInvoiceAnalyzer,
	invoiceAnalysisSchema,
} from "@/agents/invoice-analyzer"
import { getOpenAIKey } from "@/lib/env"
import { requireAuth } from "./auth"

export const analyzeDocumentFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) =>
		z.object({
			fileBase64: z.string(),
			fileName: z.string(),
			contentType: z.string(),
		}).parse(data),
	)
	.handler(async ({ data }) => {
		await requireAuth()
		const apiKey = getOpenAIKey()

		const agent = createInvoiceAnalyzer(apiKey)

		const isImage =
			data.contentType.startsWith("image/") ||
			data.contentType === "application/pdf"

		let prompt: string
		const messages: Array<{
			role: "user"
			content:
				| string
				| Array<
						| { type: "text"; text: string }
						| { type: "image"; image: string; mimeType?: string }
				  >
		}> = []

		if (isImage) {
			prompt = `Analyze this invoice document (${data.fileName}) and extract the structured data.`
			messages.push({
				role: "user",
				content: [
					{ type: "text", text: prompt },
					{
						type: "image",
						image: data.fileBase64,
						mimeType: data.contentType,
					},
				],
			})
		} else {
			// For non-image files, just describe what we know from the filename
			prompt = `Based on the filename "${data.fileName}", extract whatever invoice information you can infer.
If it appears to be from a known vendor (based on filename), fill in the vendor name and likely category.
For any fields you cannot determine, omit them.`
			messages.push({
				role: "user",
				content: prompt,
			})
		}

		const result = await agent.generate(messages, {
			structuredOutput: {
				schema: invoiceAnalysisSchema,
			},
		})

		return result.object
	})
