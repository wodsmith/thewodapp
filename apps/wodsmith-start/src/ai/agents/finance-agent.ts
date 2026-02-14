/**
 * @fileoverview Finance Agent for reporting and sponsor management.
 *
 * Handles:
 * - Revenue reporting
 * - Sponsor data export
 * - Financial summaries
 */

import { Agent } from "@mastra/core/agent"
import { getOpenAIModel } from "@/lib/ai"
import { createMemory } from "../mastra"

// Import tools
import * as sharedTools from "../tools/shared"
import * as financeTools from "../tools/finance"

export const financeAgent = new Agent({
	id: "finance-agent",
	name: "Competition Finance Agent",
	model: () => getOpenAIModel("small"),
	memory: createMemory(),
	// Allow multiple steps for complex workflows (default is 1)
	defaultOptions: {
		maxSteps: 20,
	},

	// GPT-5 reasoning model fix: disable server-side storage to prevent
	// orphaned item_reference errors on follow-up requests.
	// See: https://github.com/mastra-ai/mastra/issues/10981
	instructions: {
		role: "system",
		content: `You are a Competition Finance Agent specializing in revenue and sponsor reporting.

## Your Capabilities
- Generate revenue reports for competitions
- Export sponsor information
- Provide financial summaries across competitions
- Break down revenue by division

## Domain Knowledge
### Revenue
- Revenue comes from registration fees
- Fees are set per division (or default competition fee)
- Total revenue includes platform fees and Stripe fees
- Organizer Net = Total - Platform Fee - Stripe Fee

### Fee Structure
- Platform fees: percentage + fixed amount per registration
- Stripe fees: ~2.9% + $0.30 per transaction
- Organizers receive net after all fees

### Sponsors
- Sponsors are organized into groups/tiers (Gold, Silver, etc.)
- Each sponsor has name, logo URL, and website
- Sponsors can be associated with specific events ("Presented by")

## Guidelines
- Present financial data clearly with proper formatting
- Show revenue breakdowns by division
- Include both gross and net figures
- Highlight any payment issues or outstanding amounts

## Best Practices
- Report amounts in both cents and formatted dollars
- Group sponsors by tier for presentations
- Compare revenue across competitions when relevant
- Note any free registrations separately from paid
`,
		providerOptions: {
			openai: {
				store: false,
				include: ["reasoning.encrypted_content"],
			},
		},
	},

	tools: {
		// Shared tools
		getCompetitionDetails: sharedTools.getCompetitionDetails,
		listCompetitions: sharedTools.listCompetitions,

		// Finance tools
		getRevenueReport: financeTools.getRevenueReport,
		exportSponsors: financeTools.exportSponsors,
		getFinancialSummary: financeTools.getFinancialSummary,
	},
})
