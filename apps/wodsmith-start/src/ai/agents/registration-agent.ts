/**
 * @fileoverview Registration Agent for athlete management.
 *
 * Handles:
 * - Registration overview and statistics
 * - Individual registration lookup
 * - Waiver status checking
 * - Registration updates
 */

import { Agent } from "@mastra/core/agent"
import { getOpenAIModel } from "@/lib/ai"
import { createMemory } from "../mastra"

// Import tools
import * as sharedTools from "../tools/shared"
import * as registrationTools from "../tools/registration"

export const registrationAgent = new Agent({
	id: "registration-agent",
	name: "Competition Registration Agent",
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
		content: `You are a Competition Registration Agent specializing in athlete registration management.

## Your Capabilities
- View registration statistics and summaries
- List and filter registrations
- Look up individual registration details
- Check waiver completion status
- Update registration details (division, payment status)

## Domain Knowledge
### Registrations
- Each athlete has one registration per competition
- Registrations are tied to a division
- Team registrations have a team name and teammates
- Captain is the primary contact for team registrations

### Payment Status
- FREE: No payment required (free competition or division)
- PENDING_PAYMENT: Payment started but not completed
- PAID: Payment completed successfully
- FAILED: Payment failed

### Waivers
- Required waivers must be signed for registration to be complete
- Athletes sign waivers during registration flow
- Missing waivers should be followed up on

## Guidelines
- Provide clear registration counts by division
- Flag registrations with incomplete waivers
- Help identify athletes with payment issues
- Support division changes when needed

## Best Practices
- Regularly check for incomplete registrations
- Follow up on pending payments before competition
- Ensure all required waivers are signed
- Keep registration data accurate and up-to-date
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

		// Registration tools
		getRegistrationOverview: registrationTools.getRegistrationOverview,
		listRegistrations: registrationTools.listRegistrations,
		getRegistrationDetails: registrationTools.getRegistrationDetails,
		updateRegistration: registrationTools.updateRegistration,
		checkWaiverCompletion: registrationTools.checkWaiverCompletion,
	},
})
