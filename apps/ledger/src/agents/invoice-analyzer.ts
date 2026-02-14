import { Agent } from "@mastra/core/agent"
import { createOpenAI } from "@ai-sdk/openai"
import { z } from "zod"
import {
	DOCUMENT_CATEGORIES,
	PAYMENT_STATUSES,
	SUBSCRIPTION_TERMS,
} from "@/db/schema"

export const invoiceAnalysisSchema = z.object({
	vendor: z
		.string()
		.describe("The vendor or company name that issued the invoice"),
	description: z
		.string()
		.optional()
		.describe("Brief description of what the invoice is for"),
	amountCents: z
		.number()
		.int()
		.optional()
		.describe("Total amount in cents (e.g., 9999 for $99.99)"),
	currency: z
		.string()
		.default("USD")
		.describe("ISO 4217 currency code"),
	subscriptionTerm: z
		.enum(SUBSCRIPTION_TERMS)
		.optional()
		.describe("Billing frequency if this is a recurring charge"),
	category: z
		.enum(DOCUMENT_CATEGORIES)
		.optional()
		.describe("Category of the expense"),
	invoiceDate: z
		.string()
		.optional()
		.describe("Invoice date in YYYY-MM-DD format"),
	dueDate: z
		.string()
		.optional()
		.describe("Payment due date in YYYY-MM-DD format"),
	status: z
		.enum(PAYMENT_STATUSES)
		.default("unpaid")
		.describe("Payment status"),
})

export type InvoiceAnalysis = z.infer<typeof invoiceAnalysisSchema>

export function createInvoiceAnalyzer(apiKey: string) {
	const openai = createOpenAI({ apiKey })

	return new Agent({
		id: "invoice-analyzer",
		name: "Invoice Analyzer",
		instructions: `You are an invoice data extraction specialist for a software/SaaS business.
Extract all relevant invoice information from the provided document image or text.

Guidelines:
- Be precise with monetary amounts. Convert to cents (e.g., $99.99 = 9999).
- Use ISO 4217 currency codes (USD, EUR, GBP, etc.).
- Dates should be in YYYY-MM-DD format.
- Categorize expenses:
  - "infrastructure" for hosting, domains, CDN, cloud services (AWS, Cloudflare, Vercel, etc.)
  - "saas" for software subscriptions (GitHub, Linear, Figma, Slack, etc.)
  - "services" for consulting, freelance, professional services
  - "legal" for legal fees, contracts, compliance
  - "insurance" for business insurance
  - "other" for anything that doesn't fit above
- Determine subscription term from billing frequency mentioned in the invoice.
- If the invoice says "paid" or shows a payment confirmation, mark status as "paid".
- If you cannot determine a field with confidence, omit it.`,
		model: openai("gpt-4o-mini"),
	})
}
