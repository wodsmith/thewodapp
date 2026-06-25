import "server-only"

import { createId } from "@paralleldrive/cuid2"
import { Agent, callable } from "agents"
import { generateText, stepCountIs, type Tool, tool } from "ai"
import { createAiGateway } from "ai-gateway-provider"
import { createUnified } from "ai-gateway-provider/providers/unified"
import { z } from "zod"
import { logError, logInfo } from "@/lib/logging"
import {
	type ActivityEntry,
	type AgentState,
	askClarificationInputSchema,
	initialAgentState,
	MAX_THINKING_LOG_ENTRIES,
	markCompleteInputSchema,
	markImportAppliedInputSchema,
	proposeVolunteerInputSchema,
	refineInputSchema,
	revokeProposalInputSchema,
	startImportInputSchema,
	type VolunteerProposal,
} from "@/lib/organizer-file-import/schemas"
import {
	classifyVolunteer,
	type ExistingVolunteer,
} from "@/lib/organizer-file-import/validate"
import {
	type FileImportScope,
	requireFileImportAgentAccess,
} from "@/server/organizer-file-import/access"
import {
	type FileImportPageContext,
	loadExistingVolunteers,
	loadPageContext,
	readImportFile,
} from "@/server/organizer-file-import/context"
import type { ParsedTable } from "@/lib/organizer-file-import/parse"

/**
 * Workers AI model id addressed via the AI Gateway's unified adapter — same
 * model the judge-scheduling agent uses.
 */
const MODEL_ID = "workers-ai/@cf/moonshotai/kimi-k2.6"
const MAX_STEPS = 32
const AGENT_NAME_PATTERN =
	/^(aimp_[0-9A-HJKMNP-TV-Z]{26})__([a-z0-9_-]{1,128})$/i

const SYSTEM_PROMPT = `You are an assistant that imports volunteers and judges into a Functional Fitness competition from a file an organizer dropped onto a page. You read the file's already-parsed rows, map columns, and DRAFT proposals.

CRITICAL — you may classify, extract, validate, and PROPOSE only. You NEVER write anything, never send invitations, and must never imply that anyone has been added. A human organizer reviews your draft and confirms once; only then does anything happen.

Workflow:
- Always start by calling get_page_context and get_import_table exactly once each.
- The page tells you the intent: 'volunteers' / 'judges' = import people as volunteers; 'judges' means default roleTypes to ["judge"].
- For EACH person row in the table, call propose_volunteer exactly once. Generate a fresh proposalId per row (e.g. "v1", "v2") and set rowKey to a stable identifier from the row (the email if present, else the row's name).
- Map columns intelligently: Name/Full Name → name; Email/E-mail → email; Phone/Mobile → phone; Role/Position/Job → roleTypes; Credentials/Certifications/Cert → credentials; Shirt/Size → shirtSize; Availability → availability.
- roleTypes MUST come from this set only: judge, head_judge, equipment, medical, check_in, staff, scorekeeper, emcee, floor_manager, media, general, athlete_control, equipment_team. Map free text (e.g. "head judge" → head_judge, "coach" → judge, "EMT" → medical). If unsure, use ["general"], or ["judge"] on the judges page.
- action: use "create" for a new person to invite. If a row has no usable email, use "needs_input" (the system also flags this — an invitation can't be sent without an email).
- availability must be one of: morning, afternoon, all_day, or omit it.
- Set confidence (high/medium/low) by how cleanly the row mapped. Keep rationale under 240 chars, concrete (e.g. "Mapped Name+Email; role from 'Head Judge'").
- Duplicate detection against existing volunteers happens automatically server-side — still propose the row; it will be marked as a match and excluded by default.
- INTENT CHECK: if the file clearly is NOT a roster of people (e.g. it lists workouts/events, scores, or schedule rows), do NOT invent volunteers. Call ask_clarification asking whether they meant a different page, and stop.
- When every person row has been proposed once, call mark_complete with a 1-2 sentence summary. Do not invent extra rows.
- Do not propose the same person (same email) twice.`

interface ImportRunContext {
	scope: FileImportScope
	pageContext: FileImportPageContext
	table: ParsedTable
	truncated: boolean
	existingVolunteers: ExistingVolunteer[]
}

/**
 * Durable-Object-backed agent that drafts volunteer/judge imports from a
 * dropped file. `state.volunteerProposals` is the UI-watched source of truth;
 * every setState is broadcast to connected clients over WebSocket. The agent
 * proposes only — all writes happen later in applyOrganizerImportFn after the
 * organizer confirms. Mirrors JudgeSchedulerAgent.
 */
export class OrganizerFileImportAgent extends Agent<Env, AgentState> {
	initialState: AgentState = initialAgentState

	#abortController: AbortController | null = null

	logActivity(kind: ActivityEntry["kind"], message: string): void {
		const entry: ActivityEntry = {
			id: createId(),
			timestamp: Date.now(),
			kind,
			message,
		}
		const next = [...this.state.thinkingLog, entry]
		const trimmed =
			next.length > MAX_THINKING_LOG_ENTRIES
				? next.slice(next.length - MAX_THINKING_LOG_ENTRIES)
				: next
		this.setState({ ...this.state, thinkingLog: trimmed })
	}

	@callable()
	async start(rawInput: unknown): Promise<{ ok: boolean; error?: string }> {
		const runStartedAt = Date.now()
		try {
			const input = startImportInputSchema.parse(rawInput)
			logInfo({
				message: "[ImportAgent] start invoked",
				attributes: {
					importRunId: input.importRunId,
					competitionId: input.competitionId,
					routeKind: input.routeKind,
				},
			})

			const userId = getUserIdFromAgentName(this.name)
			const scope = await requireFileImportAgentAccess(
				{
					competitionId: input.competitionId,
					routeKind: input.routeKind,
					eventId: input.eventId ?? null,
				},
				userId,
			)

			this.setState({
				...initialAgentState,
				importRunId: input.importRunId,
				competitionId: input.competitionId,
				eventId: input.eventId ?? null,
				routeKind: input.routeKind,
				status: "parsing",
				startedAt: Date.now(),
			})
			this.logActivity("thinking", "Reading the dropped file…")

			const ctx = await this.#loadContext(
				input.importRunId,
				scope,
				input,
				userId,
			)
			if (ctx.table.warnings.length > 0) {
				this.setState({ ...this.state, parseWarnings: ctx.table.warnings })
			}
			this.logActivity(
				"thinking",
				`Parsed ${ctx.table.rows.length} row${
					ctx.table.rows.length === 1 ? "" : "s"
				} with columns: ${ctx.table.headers.join(", ") || "(none detected)"}.`,
			)

			await this.#generate(
				ctx,
				buildKickoffPrompt(ctx),
				runStartedAt,
				input.importRunId,
			)
			return { ok: true }
		} catch (err) {
			return this.#handleRunError(err, runStartedAt)
		} finally {
			this.#abortController = null
		}
	}

	@callable()
	async refine(rawInput: unknown): Promise<{ ok: boolean; error?: string }> {
		const runStartedAt = Date.now()
		try {
			const { instruction } = refineInputSchema.parse(rawInput)
			if (
				!this.state.importRunId ||
				!this.state.competitionId ||
				!this.state.routeKind
			) {
				throw new Error("Nothing to refine yet — run an import first.")
			}

			const userId = getUserIdFromAgentName(this.name)
			const scope = await requireFileImportAgentAccess(
				{
					competitionId: this.state.competitionId,
					routeKind: this.state.routeKind,
					eventId: this.state.eventId ?? undefined,
				},
				userId,
			)

			this.setState({
				...this.state,
				status: "thinking",
				summary: null,
				errorMessage: null,
				clarification: null,
				completedAt: null,
			})
			this.logActivity("thinking", `Refining draft: "${instruction}"`)

			const ctx = await this.#loadContext(
				this.state.importRunId,
				scope,
				{
					competitionId: this.state.competitionId,
					routeKind: this.state.routeKind,
					eventId: this.state.eventId ?? undefined,
				},
				userId,
			)

			await this.#generate(
				ctx,
				buildRefinePrompt(this.state.volunteerProposals, instruction),
				runStartedAt,
				this.state.importRunId,
			)
			return { ok: true }
		} catch (err) {
			return this.#handleRunError(err, runStartedAt)
		} finally {
			this.#abortController = null
		}
	}

	@callable()
	stop(): { ok: boolean; running: boolean } {
		if (!this.#abortController) {
			return { ok: false, running: false }
		}
		this.#abortController.abort()
		this.#abortController = null
		return { ok: true, running: true }
	}

	@callable()
	reset(): { ok: true } {
		this.#abortController?.abort()
		this.#abortController = null
		this.setState(initialAgentState)
		return { ok: true }
	}

	/**
	 * Flip the given proposalIds to accepted and drop them from the review
	 * list. Called by the UI after applyOrganizerImportFn persists them, so a
	 * subsequent refine won't re-surface already-applied rows.
	 */
	@callable()
	markApplied(rawInput: unknown): { ok: true; appliedCount: number } {
		const input = markImportAppliedInputSchema.parse(rawInput)
		const appliedSet = new Set(input.proposalIds)
		const remaining = this.state.volunteerProposals.filter(
			(p) => !appliedSet.has(p.proposalId),
		)
		this.setState({
			...this.state,
			volunteerProposals: remaining,
			status: remaining.length === 0 ? "idle" : this.state.status,
		})
		this.logActivity(
			"done",
			`Organizer applied ${input.proposalIds.length} import${
				input.proposalIds.length === 1 ? "" : "s"
			}.`,
		)
		return { ok: true, appliedCount: input.proposalIds.length }
	}

	async #loadContext(
		importRunId: string,
		scope: FileImportScope,
		page: { competitionId: string; routeKind: string; eventId?: string | null },
		userId: string,
	): Promise<ImportRunContext> {
		const [{ table, truncated }, pageContext, existingVolunteers] =
			await Promise.all([
				readImportFile(importRunId, scope, userId),
				loadPageContext({
					competitionId: page.competitionId,
					routeKind: page.routeKind,
					eventId: page.eventId ?? null,
				}),
				loadExistingVolunteers(scope.competitionTeamId),
			])
		return { scope, pageContext, table, truncated, existingVolunteers }
	}

	async #generate(
		ctx: ImportRunContext,
		prompt: string,
		runStartedAt: number,
		importRunId: string,
	): Promise<void> {
		this.setState({ ...this.state, status: "thinking" })

		const gatewayBinding = this.env.AI.gateway(this.env.CF_AIG_GATEWAY)
		const aiGateway = createAiGateway({
			binding: {
				run: (data) =>
					gatewayBinding.run(data as Parameters<typeof gatewayBinding.run>[0]),
			},
		})
		const unified = createUnified()
		this.#abortController = new AbortController()

		const result = await generateText({
			model: aiGateway(unified(MODEL_ID)),
			system: SYSTEM_PROMPT,
			prompt,
			tools: buildTools(this, ctx),
			stopWhen: stepCountIs(MAX_STEPS),
			abortSignal: this.#abortController.signal,
		})

		logInfo({
			message: "[ImportAgent] generateText finished",
			attributes: {
				importRunId,
				durationMs: Date.now() - runStartedAt,
				proposalCount: this.state.volunteerProposals.length,
				stepCount: result.steps?.length ?? 0,
				finishReason: result.finishReason,
				status: this.state.status,
			},
		})

		if (this.state.status !== "proposals_ready") {
			this.setState({
				...this.state,
				status: "proposals_ready",
				summary: result.text || this.state.summary || "Draft ready for review.",
				completedAt: Date.now(),
			})
			this.logActivity(
				"done",
				result.text || this.state.summary || "Draft ready for review.",
			)
		}
	}

	#handleRunError(
		err: unknown,
		runStartedAt: number,
	): { ok: boolean; error?: string } {
		const message = err instanceof Error ? err.message : String(err)
		const isAbort =
			err instanceof Error &&
			(err.name === "AbortError" || message.toLowerCase().includes("abort"))
		if (isAbort) {
			this.logActivity("thinking", "Run stopped by organizer.")
			this.setState({
				...this.state,
				status:
					this.state.volunteerProposals.length > 0 ? "proposals_ready" : "idle",
				summary: null,
				errorMessage: null,
				completedAt: Date.now(),
			})
			return { ok: true }
		}
		this.logActivity("error", `Run failed: ${message}`)
		logError({
			message: "[ImportAgent] run failed",
			error: err,
			attributes: {
				durationMs: Date.now() - runStartedAt,
				proposalCount: this.state.volunteerProposals.length,
			},
		})
		this.setState({
			...this.state,
			status: "error",
			errorMessage: message,
			completedAt: Date.now(),
		})
		return { ok: false, error: message }
	}
}

function getUserIdFromAgentName(name: string): string {
	const match = AGENT_NAME_PATTERN.exec(name)
	if (!match?.[2]) {
		throw new Error("Invalid agent name")
	}
	return match[2]
}

function buildKickoffPrompt(ctx: ImportRunContext): string {
	const { pageContext, table, truncated, existingVolunteers } = ctx
	const lines = [
		`Import volunteers for "${pageContext.competitionName}" (page: ${pageContext.routeKind}).`,
		`The dropped file parsed to ${table.rows.length} data row${
			table.rows.length === 1 ? "" : "s"
		}${truncated ? " (showing the first 200)" : ""} with columns: ${
			table.headers.join(", ") || "(none detected)"
		}.`,
		`There ${existingVolunteers.length === 1 ? "is" : "are"} ${existingVolunteers.length} existing volunteer${
			existingVolunteers.length === 1 ? "" : "s"
		}; duplicates are detected automatically.`,
		"Call get_page_context and get_import_table first, then propose one volunteer per person row, and finish with mark_complete.",
	]
	return lines.join("\n")
}

function buildRefinePrompt(
	current: VolunteerProposal[],
	instruction: string,
): string {
	const summary = current.map((p) => ({
		proposalId: p.proposalId,
		name: p.name,
		email: p.email,
		roleTypes: p.roleTypes,
		action: p.action,
	}))
	return [
		`You previously drafted ${current.length} volunteer proposal${
			current.length === 1 ? "" : "s"
		}. The organizer wants to refine the draft:`,
		`"${instruction}"`,
		`Current proposals (JSON): ${JSON.stringify(summary)}`,
		"Apply the instruction by editing the draft in place: call revoke_proposal for any to remove, and propose_volunteer (reuse the SAME proposalId to replace one) for changes. Call get_import_table if you need the original rows. Finish with mark_complete.",
	].join("\n")
}

function buildTools(
	agent: OrganizerFileImportAgent,
	ctx: ImportRunContext,
): Record<string, Tool> {
	const { pageContext, table, truncated, existingVolunteers } = ctx

	return {
		get_page_context: tool({
			description:
				"Return the competition name, the page the file was dropped on (routeKind), and any event id. Call once per run.",
			inputSchema: z.object({}),
			execute: async () => {
				agent.logActivity("tool", "Checked which page the file was dropped on.")
				return pageContext
			},
		}),

		get_import_table: tool({
			description:
				"Return the parsed file: detected headers and up to the first 200 data rows. Call once per run, then map each row to a volunteer.",
			inputSchema: z.object({}),
			execute: async () => {
				agent.logActivity(
					"tool",
					`Read the file — ${table.rows.length} row${
						table.rows.length === 1 ? "" : "s"
					}, ${table.headers.length} column${table.headers.length === 1 ? "" : "s"}.`,
				)
				return {
					headers: table.headers,
					rows: table.rows,
					rowCount: table.rows.length,
					truncated,
				}
			},
		}),

		propose_volunteer: tool({
			description:
				"Draft ONE volunteer/judge to import. The organizer sees it stream in immediately. Duplicate detection and no-email warnings are attached automatically.",
			inputSchema: proposeVolunteerInputSchema,
			execute: async (input) => {
				const normalizedEmail = input.email?.trim().toLowerCase() ?? null
				const isDuplicateProposal = normalizedEmail
					? agent.state.volunteerProposals.some(
							(p) =>
								p.proposalId !== input.proposalId &&
								p.email?.trim().toLowerCase() === normalizedEmail,
						)
					: false
				const classification = classifyVolunteer(
					{ email: input.email, name: input.name },
					existingVolunteers,
				)
				const warnings = [...classification.warnings]
				if (isDuplicateProposal) {
					warnings.push(
						"Duplicate email in this import — only the first row will be applied.",
					)
				}
				if (classification.matchKind === "existing_member") {
					warnings.push("Already a volunteer — will be skipped.")
				} else if (classification.matchKind === "existing_invite") {
					warnings.push("Already invited — will be skipped.")
				}

				const merged: VolunteerProposal = {
					...input,
					action: isDuplicateProposal ? "skip" : input.action,
					matchKind: classification.matchKind,
					matchedMembershipId: classification.matchedMembershipId,
					warnings: dedupeStrings(warnings).slice(0, 10),
					status: "pending",
				}

				const next = agent.state.volunteerProposals.filter(
					(p) => p.proposalId !== merged.proposalId,
				)
				next.push(merged)
				agent.setState({ ...agent.state, volunteerProposals: next })

				const label = merged.name || merged.email || merged.rowKey
				if (merged.matchKind === "new") {
					agent.logActivity(
						"proposed",
						`Proposed ${label}${
							merged.warnings.length > 0
								? ` (${merged.warnings.length} warning${merged.warnings.length === 1 ? "" : "s"})`
								: ""
						}.`,
					)
				} else {
					agent.logActivity(
						"skipped",
						`${label} ${
							merged.matchKind === "existing_member"
								? "is already a volunteer"
								: "was already invited"
						} — flagged as a duplicate.`,
					)
				}
				return {
					status: "recorded" as const,
					matchKind: merged.matchKind,
					warnings: merged.warnings,
				}
			},
		}),

		revoke_proposal: tool({
			description:
				"Withdraw a previously drafted volunteer by proposalId. Use when reconsidering or replacing.",
			inputSchema: revokeProposalInputSchema,
			execute: async (input) => {
				const before = agent.state.volunteerProposals.length
				const next = agent.state.volunteerProposals.filter(
					(p) => p.proposalId !== input.proposalId,
				)
				agent.setState({ ...agent.state, volunteerProposals: next })
				agent.logActivity(
					"thinking",
					`Withdrew ${input.proposalId} — ${input.reason}`,
				)
				return {
					status: "revoked" as const,
					removed: before - next.length,
				}
			},
		}),

		ask_clarification: tool({
			description:
				"Ask the organizer a question when the file doesn't match the page (e.g. a roster dropped on Events). Sets a banner and stops proposing.",
			inputSchema: askClarificationInputSchema,
			execute: async (input) => {
				agent.setState({
					...agent.state,
					clarification: {
						question: input.question,
						suggestedRouteKind: input.suggestedRouteKind,
					},
				})
				agent.logActivity("thinking", `Asked: ${input.question}`)
				return { status: "asked" as const }
			},
		}),

		mark_complete: tool({
			description:
				"Mark the draft finished with a 1-2 sentence summary for the organizer.",
			inputSchema: markCompleteInputSchema,
			execute: async (input) => {
				agent.setState({
					...agent.state,
					status: "proposals_ready",
					summary: input.summary,
					completedAt: Date.now(),
				})
				agent.logActivity("done", input.summary)
				return { status: "complete" as const }
			},
		}),
	}
}

function dedupeStrings(input: string[]): string[] {
	return Array.from(new Set(input))
}
