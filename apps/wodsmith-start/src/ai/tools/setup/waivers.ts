/**
 * @fileoverview Waiver management tools for the Setup Agent.
 *
 * Waivers are legal documents that athletes must sign during registration.
 */

import { createTool } from "@mastra/core/tools"
import { z } from "zod"
import { eq, and } from "drizzle-orm"

import { getDb } from "@/db"
import { competitionsTable } from "@/db/schemas/competitions"
import { waiversTable } from "@/db/schemas/waivers"

/**
 * List all waivers for a competition.
 */
export const listWaivers = createTool({
	id: "list-waivers",
	description: "List all waivers for a competition with signature counts.",
	inputSchema: z.object({
		competitionId: z.string().describe("The competition ID"),
	}),
	execute: async (inputData, context) => {
		const { competitionId } = inputData
		const teamId = context?.requestContext?.get("team-id") as string | undefined

		const db = getDb()

		// Verify competition access
		const competition = await db.query.competitionsTable.findFirst({
			where: and(
				eq(competitionsTable.id, competitionId),
				teamId ? eq(competitionsTable.organizingTeamId, teamId) : undefined,
			),
		})

		if (!competition) {
			return { error: "Competition not found or access denied" }
		}

		// Get waivers with signature counts
		const waivers = await db.query.waiversTable.findMany({
			where: eq(waiversTable.competitionId, competitionId),
			orderBy: (w, { asc }) => [asc(w.position)],
			with: {
				signatures: true,
			},
		})

		return {
			waivers: waivers.map((w) => ({
				id: w.id,
				title: w.title,
				required: w.required,
				position: w.position,
				contentPreview:
					w.content.substring(0, 200) + (w.content.length > 200 ? "..." : ""),
				signatureCount: w.signatures?.length ?? 0,
			})),
		}
	},
})

/**
 * Get full waiver details including content.
 */
export const getWaiver = createTool({
	id: "get-waiver",
	description: "Get full details of a waiver including its content.",
	inputSchema: z.object({
		waiverId: z.string().describe("The waiver ID"),
	}),
	execute: async (inputData, context) => {
		const { waiverId } = inputData
		const teamId = context?.requestContext?.get("team-id") as string | undefined

		const db = getDb()

		const waiver = await db.query.waiversTable.findFirst({
			where: eq(waiversTable.id, waiverId),
			with: {
				competition: true,
			},
		})

		if (!waiver) {
			return { error: "Waiver not found" }
		}

		// Verify team access
		if (teamId && waiver.competition?.organizingTeamId !== teamId) {
			return { error: "Access denied" }
		}

		return {
			waiver: {
				id: waiver.id,
				title: waiver.title,
				content: waiver.content,
				required: waiver.required,
				position: waiver.position,
				competitionId: waiver.competitionId,
			},
		}
	},
})

/**
 * Create a new waiver for a competition.
 */
export const createWaiver = createTool({
	id: "create-waiver",
	description: "Create a new waiver document for a competition.",
	inputSchema: z.object({
		competitionId: z.string().describe("The competition ID"),
		title: z
			.string()
			.min(1)
			.max(255)
			.describe("Waiver title (e.g., 'Liability Waiver', 'Photo Release')"),
		content: z
			.string()
			.min(1)
			.max(50000)
			.describe("Waiver content as Lexical JSON or plain text"),
		required: z
			.boolean()
			.default(true)
			.describe("Whether this waiver must be signed to register"),
		position: z
			.number()
			.optional()
			.describe("Display order (0 = first). If not provided, adds at the end."),
	}),
	execute: async (inputData, context) => {
		const { competitionId, title, content, required, position } = inputData
		const teamId = context?.requestContext?.get("team-id") as string | undefined

		const db = getDb()

		// Verify competition access
		const competition = await db.query.competitionsTable.findFirst({
			where: and(
				eq(competitionsTable.id, competitionId),
				teamId ? eq(competitionsTable.organizingTeamId, teamId) : undefined,
			),
		})

		if (!competition) {
			return { error: "Competition not found or access denied" }
		}

		// Get max position if not provided
		let finalPosition = position
		if (finalPosition === undefined) {
			const existing = await db.query.waiversTable.findMany({
				where: eq(waiversTable.competitionId, competitionId),
				orderBy: (w, { desc }) => [desc(w.position)],
				limit: 1,
			})
			finalPosition = existing.length > 0 ? existing[0].position + 1 : 0
		}

		// Create waiver
		const [waiver] = await db
			.insert(waiversTable)
			.values({
				competitionId,
				title,
				content,
				required,
				position: finalPosition,
			})
			.returning()

		return {
			success: true,
			waiver: {
				id: waiver.id,
				title: waiver.title,
				required: waiver.required,
				position: waiver.position,
			},
		}
	},
})

/**
 * Update a waiver's details.
 */
export const updateWaiver = createTool({
	id: "update-waiver",
	description: "Update a waiver's title, content, or settings.",
	inputSchema: z.object({
		waiverId: z.string().describe("The waiver ID"),
		title: z.string().min(1).max(255).optional().describe("Waiver title"),
		content: z.string().min(1).max(50000).optional().describe("Waiver content"),
		required: z
			.boolean()
			.optional()
			.describe("Whether this waiver is required"),
		position: z.number().optional().describe("Display order"),
	}),
	execute: async (inputData, context) => {
		const { waiverId, title, content, required, position } = inputData
		const teamId = context?.requestContext?.get("team-id") as string | undefined

		const db = getDb()

		// Get waiver with competition info
		const waiver = await db.query.waiversTable.findFirst({
			where: eq(waiversTable.id, waiverId),
			with: {
				competition: true,
			},
		})

		if (!waiver) {
			return { error: "Waiver not found" }
		}

		// Verify team access
		if (teamId && waiver.competition?.organizingTeamId !== teamId) {
			return { error: "Access denied" }
		}

		// Update waiver
		await db
			.update(waiversTable)
			.set({
				...(title !== undefined && { title }),
				...(content !== undefined && { content }),
				...(required !== undefined && { required }),
				...(position !== undefined && { position }),
				updatedAt: new Date(),
			})
			.where(eq(waiversTable.id, waiverId))

		return {
			success: true,
			waiverId,
			updated: { title, content, required, position },
		}
	},
})

/**
 * Delete a waiver from a competition.
 */
export const deleteWaiver = createTool({
	id: "delete-waiver",
	description:
		"Delete a waiver from a competition. This also deletes all signature records for this waiver.",
	inputSchema: z.object({
		waiverId: z.string().describe("The waiver ID to delete"),
	}),
	execute: async (inputData, context) => {
		const { waiverId } = inputData
		const teamId = context?.requestContext?.get("team-id") as string | undefined

		const db = getDb()

		// Get waiver with competition info
		const waiver = await db.query.waiversTable.findFirst({
			where: eq(waiversTable.id, waiverId),
			with: {
				competition: true,
				signatures: true,
			},
		})

		if (!waiver) {
			return { error: "Waiver not found" }
		}

		// Verify team access
		if (teamId && waiver.competition?.organizingTeamId !== teamId) {
			return { error: "Access denied" }
		}

		const signatureCount = waiver.signatures?.length ?? 0

		// Delete waiver (cascades to signatures)
		await db.delete(waiversTable).where(eq(waiversTable.id, waiverId))

		return {
			success: true,
			message: "Waiver deleted successfully",
			deletedSignatures: signatureCount,
		}
	},
})

/**
 * Get standard waiver templates.
 */
export const getWaiverTemplates = createTool({
	id: "get-waiver-templates",
	description: "Get standard waiver templates for common use cases.",
	inputSchema: z.object({}),
	execute: async () => {
		return {
			templates: [
				{
					name: "Liability Waiver",
					description: "Standard liability release for physical activities",
					content: `I, the undersigned participant, acknowledge that I have voluntarily chosen to participate in this CrossFit competition. I understand that CrossFit activities involve inherent risks including, but not limited to, physical injury, disability, and even death.

I hereby release, waive, discharge, and covenant not to sue the event organizers, sponsors, venue owners, and their respective officers, employees, and agents from any and all liability, claims, demands, actions, and causes of action whatsoever arising out of or related to any loss, damage, or injury that may be sustained by me while participating in or as a result of participating in this event.

I have read this release of liability and assumption of risk agreement, fully understand its terms, understand that I have given up substantial rights by signing it, and sign it freely and voluntarily.`,
				},
				{
					name: "Photo/Video Release",
					description: "Permission to use participant images for marketing",
					content: `I hereby grant permission to the event organizers and their designees to use my name, likeness, image, voice, and/or appearance as such may be embodied in any photographs, video recordings, or other media taken during the event.

I agree that such recordings and images may be used for any purpose, including advertising and promotional activities, in any media now known or hereafter developed, without further compensation to me.

I release the organizers from any claims arising from the use of my image or likeness as authorized herein.`,
				},
				{
					name: "Medical Release",
					description: "Authorization for emergency medical treatment",
					content: `In the event of an emergency, I authorize the event organizers and medical personnel to provide or obtain medical treatment for me as they deem necessary.

I understand that I am responsible for any medical expenses incurred as a result of participating in this event. I have disclosed any medical conditions or allergies that may affect my participation.

I confirm that I am physically fit to participate in this competition and have consulted with a physician if I have any concerns about my health.`,
				},
				{
					name: "Code of Conduct",
					description: "Participant behavior agreement",
					content: `By participating in this competition, I agree to:

1. Conduct myself in a sportsmanlike manner at all times
2. Respect fellow competitors, judges, volunteers, and spectators
3. Follow all competition rules and standards
4. Accept the decisions of judges as final
5. Refrain from using prohibited substances
6. Report any safety concerns to event staff immediately

I understand that violation of this code may result in disqualification from the event.`,
				},
			],
		}
	},
})
