import { useRouter } from "@tanstack/react-router"
import { useAgent } from "agents/react"
import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { VOLUNTEER_ROLE_LABELS } from "@/db/schemas/volunteers"
import { useSession } from "@/utils/auth-client"
import type {
	AgentState,
	VolunteerProposal,
} from "@/lib/organizer-file-import/schemas"
import { isApplicableVolunteer } from "@/lib/organizer-file-import/validate"
import {
	type ApplyImportResult,
	applyOrganizerImportFn,
	undoImportFn,
} from "@/server-fns/organizer-file-import-fns"
import type { PageIntent } from "./use-page-intent"

interface ImportReviewDrawerProps {
	importRunId: string
	competition: { id: string; name: string; organizingTeamId: string }
	intent: PageIntent
	onClose: () => void
}

const STATUS_LABEL: Record<AgentState["status"], string> = {
	idle: "Idle",
	parsing: "Reading the file…",
	thinking: "Drafting proposals…",
	proposals_ready: "Ready for review",
	error: "Something went wrong",
}

export function ImportReviewDrawer({
	importRunId,
	competition,
	intent,
	onClose,
}: ImportReviewDrawerProps) {
	const router = useRouter()
	const session = useSession()
	const userId = session?.userId ?? null
	const agent = useAgent<AgentState>({
		agent: "organizer-file-import-agent",
		// The runId is a valid name segment as-is (ULID is uppercase Crockford
		// base32, accepted case-insensitively by the server.ts route regex).
		name: `${importRunId}__${userId ?? "pending"}`,
	})

	const status = agent.state?.status ?? "parsing"
	const proposals = agent.state?.volunteerProposals ?? []
	const thinkingLog = agent.state?.thinkingLog ?? []
	const clarification = agent.state?.clarification ?? null
	const parseWarnings = agent.state?.parseWarnings ?? []
	const summary = agent.state?.summary
	const errorMessage = agent.state?.errorMessage

	const [excluded, setExcluded] = useState<Set<string>>(new Set())
	const [isApplying, setIsApplying] = useState(false)
	const [refineText, setRefineText] = useState("")
	const [receipt, setReceipt] = useState<ApplyImportResult | null>(null)
	const startedRef = useRef(false)

	// One drag → one run: kick the agent off exactly once when the drawer mounts.
	useEffect(() => {
		if (!userId) return
		if (startedRef.current) return
		startedRef.current = true
		agent.stub
			.start({
				importRunId,
				competitionId: competition.id,
				routeKind: intent.routeKind,
				eventId: intent.eventId,
			})
			.catch((err: unknown) => {
				toast.error(
					err instanceof Error ? err.message : "Failed to start the import",
				)
			})
	}, [
		agent.stub,
		importRunId,
		competition.id,
		intent.routeKind,
		intent.eventId,
		userId,
	])

	const pending = useMemo(
		() => proposals.filter((p) => p.status === "pending"),
		[proposals],
	)
	const applicable = useMemo(
		() => pending.filter(isApplicableVolunteer),
		[pending],
	)
	const blocked = useMemo(
		() => pending.filter((p) => !isApplicableVolunteer(p)),
		[pending],
	)
	const included = useMemo(
		() => applicable.filter((p) => !excluded.has(p.proposalId)),
		[applicable, excluded],
	)

	const isWorking = status === "parsing" || status === "thinking"

	function toggleExclude(proposalId: string) {
		setExcluded((prev) => {
			const next = new Set(prev)
			if (next.has(proposalId)) next.delete(proposalId)
			else next.add(proposalId)
			return next
		})
	}

	async function handleConfirm() {
		if (included.length === 0) return
		setIsApplying(true)
		try {
			const result = await applyOrganizerImportFn({
				data: { importRunId, volunteerProposals: included },
			})
			const appliedIds = result.results
				.filter((r) => r.status === "applied")
				.map((r) => r.proposalId)
			if (appliedIds.length > 0) {
				await agent.stub
					.markApplied({ proposalIds: appliedIds })
					.catch(() => {})
			}
			await router.invalidate()
			setReceipt(result)
			if (result.failed > 0) {
				toast.warning(
					`Imported ${result.applied} volunteer${
						result.applied === 1 ? "" : "s"
					}; ${result.failed} failed.`,
				)
			} else if (result.skipped > 0) {
				toast.warning(
					result.applied > 0
						? `Imported ${result.applied} volunteer${
								result.applied === 1 ? "" : "s"
							}; ${result.skipped} skipped.`
						: "No volunteers were imported. Review the skipped rows.",
				)
			} else {
				toast.success(
					`Imported ${result.applied} volunteer${
						result.applied === 1 ? "" : "s"
					}.`,
				)
			}
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : "Failed to apply the import",
			)
		} finally {
			setIsApplying(false)
		}
	}

	async function handleRefine() {
		const instruction = refineText.trim()
		if (!instruction || isWorking) return
		setRefineText("")
		try {
			await agent.stub.refine({ instruction })
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Failed to refine")
		}
	}

	async function handleUndo() {
		try {
			const res = await undoImportFn({ data: { importRunId } })
			await router.invalidate()
			toast.success(
				`Undone — removed ${res.removed} invitation${res.removed === 1 ? "" : "s"}.`,
			)
			onClose()
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Failed to undo")
		}
	}

	const latestActivity = thinkingLog[thinkingLog.length - 1]?.message

	return (
		<Sheet
			open
			onOpenChange={(next) => {
				if (!next) onClose()
			}}
		>
			<SheetContent
				side="right"
				className="flex w-full flex-col gap-0 p-0 sm:max-w-xl"
			>
				<SheetHeader className="border-b p-4">
					<SheetTitle>Import {intent.label}</SheetTitle>
					<SheetDescription>
						Drafted from your file for {competition.name}. Nothing is saved
						until you confirm.
					</SheetDescription>
				</SheetHeader>

				{receipt ? (
					<ImportReceipt
						receipt={receipt}
						onUndo={handleUndo}
						onReviewRemaining={() => setReceipt(null)}
						onDone={onClose}
					/>
				) : (
					<>
						<div className="flex items-center gap-2 border-b px-4 py-2 text-sm">
							{isWorking && (
								<span className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary" />
							)}
							<span className="font-medium">{STATUS_LABEL[status]}</span>
							{latestActivity && (
								<span className="truncate text-muted-foreground">
									· {latestActivity}
								</span>
							)}
						</div>

						<ScrollArea className="flex-1">
							<div className="space-y-3 p-4">
								{errorMessage && (
									<p className="rounded border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
										{errorMessage}
									</p>
								)}

								{clarification && (
									<div className="rounded border border-amber-400/50 bg-amber-50 p-3 text-sm dark:bg-amber-950/30">
										<p className="font-medium">{clarification.question}</p>
									</div>
								)}

								{parseWarnings.length > 0 && (
									<ul className="space-y-1 rounded border bg-muted/40 p-3 text-xs text-muted-foreground">
										{parseWarnings.slice(0, 5).map((w) => (
											<li key={w}>• {w}</li>
										))}
									</ul>
								)}

								{pending.length === 0 && !isWorking && !clarification && (
									<p className="py-8 text-center text-sm text-muted-foreground">
										No people to import were found in this file.
									</p>
								)}

								{applicable.map((proposal) => (
									<ProposalCard
										key={proposal.proposalId}
										proposal={proposal}
										excluded={excluded.has(proposal.proposalId)}
										onToggle={() => toggleExclude(proposal.proposalId)}
									/>
								))}

								{blocked.length > 0 && (
									<div className="space-y-2 pt-2">
										<p className="text-xs font-semibold uppercase text-muted-foreground">
											Won't import ({blocked.length})
										</p>
										{blocked.map((proposal) => (
											<ProposalCard
												key={proposal.proposalId}
												proposal={proposal}
												blocked
											/>
										))}
									</div>
								)}

								{summary && status === "proposals_ready" && (
									<p className="pt-2 text-xs text-muted-foreground">
										{summary}
									</p>
								)}
							</div>
						</ScrollArea>

						<div className="space-y-3 border-t p-4">
							<div className="flex gap-2">
								<Label htmlFor="import-refine-instructions" className="sr-only">
									Refinement instructions
								</Label>
								<Textarea
									id="import-refine-instructions"
									value={refineText}
									onChange={(e) => setRefineText(e.target.value)}
									placeholder="Refine in words — e.g. 'make coaches head judges, skip anyone with no email'"
									rows={2}
									className="resize-none text-sm"
									onKeyDown={(e) => {
										if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
											e.preventDefault()
											void handleRefine()
										}
									}}
								/>
								<Button
									variant="outline"
									onClick={handleRefine}
									disabled={isWorking || refineText.trim().length === 0}
								>
									Refine
								</Button>
							</div>
							<Button
								className="w-full"
								onClick={handleConfirm}
								disabled={isApplying || isWorking || included.length === 0}
							>
								{included.length === 0
									? "Nothing to confirm"
									: `Add ${included.length} ${intent.label.toLowerCase()} · sends invites`}
							</Button>
						</div>
					</>
				)}
			</SheetContent>
		</Sheet>
	)
}

function ProposalCard({
	proposal,
	excluded,
	blocked,
	onToggle,
}: {
	proposal: VolunteerProposal
	excluded?: boolean
	blocked?: boolean
	onToggle?: () => void
}) {
	const label = proposal.name || proposal.email || proposal.rowKey
	return (
		<div
			className={`rounded border p-3 text-sm ${
				excluded || blocked ? "opacity-60" : ""
			}`}
		>
			<div className="flex items-start justify-between gap-2">
				<div className="min-w-0">
					<p className="font-medium">{label}</p>
					{proposal.email && (
						<p className="truncate text-xs text-muted-foreground">
							{proposal.email}
						</p>
					)}
				</div>
				{!blocked && onToggle && (
					<Button
						size="sm"
						variant={excluded ? "outline" : "ghost"}
						onClick={onToggle}
					>
						{excluded ? "Add back" : "Exclude"}
					</Button>
				)}
			</div>

			<div className="mt-2 flex flex-wrap gap-1">
				{proposal.roleTypes.map((role) => (
					<Badge key={role} variant="secondary">
						{VOLUNTEER_ROLE_LABELS[role] ?? role}
					</Badge>
				))}
				{proposal.matchKind === "existing_member" && (
					<Badge variant="outline">Already a volunteer</Badge>
				)}
				{proposal.matchKind === "existing_invite" && (
					<Badge variant="outline">Already invited</Badge>
				)}
				{proposal.confidence !== "high" && (
					<Badge variant="outline">{proposal.confidence} confidence</Badge>
				)}
			</div>

			{proposal.warnings.length > 0 && (
				<ul className="mt-2 space-y-0.5 text-xs text-amber-600 dark:text-amber-400">
					{proposal.warnings.map((w) => (
						<li key={w}>⚠ {w}</li>
					))}
				</ul>
			)}
		</div>
	)
}

function ImportReceipt({
	receipt,
	onUndo,
	onReviewRemaining,
	onDone,
}: {
	receipt: ApplyImportResult
	onUndo: () => void
	onReviewRemaining: () => void
	onDone: () => void
}) {
	const skippedRows = receipt.results.filter((r) => r.status === "skipped")
	const failedRows = receipt.results.filter((r) => r.status === "failed")
	const hasRemainingRows = skippedRows.length > 0 || failedRows.length > 0

	return (
		<div className="flex flex-1 flex-col justify-between p-4">
			<div className="space-y-4">
				<div className="rounded border bg-muted/40 p-4">
					<p className="text-lg font-semibold">
						{receipt.applied} added
						{receipt.skipped > 0 && ` · ${receipt.skipped} skipped`}
						{receipt.failed > 0 && ` · ${receipt.failed} failed`}
					</p>
					<p className="mt-1 text-sm text-muted-foreground">
						{receipt.applied > 0
							? "Invitation emails were sent to the added volunteers."
							: "No invitation emails were sent."}
						{hasRemainingRows ? " Review the rows below before closing." : ""}
					</p>
				</div>

				{skippedRows.length > 0 && (
					<ul className="space-y-1 text-xs text-muted-foreground">
						{skippedRows.map((r) => (
							<li key={r.proposalId}>
								{r.rowKey}: {r.reason ?? "skipped"}
							</li>
						))}
					</ul>
				)}

				{failedRows.length > 0 && (
					<ul className="space-y-1 text-xs text-destructive">
						{failedRows.map((r) => (
							<li key={r.proposalId}>
								{r.rowKey}: {r.reason}
							</li>
						))}
					</ul>
				)}
			</div>

			<div className="flex flex-col gap-2 sm:flex-row">
				{receipt.applied > 0 && (
					<Button variant="outline" onClick={onUndo} className="flex-1">
						Undo added invites
					</Button>
				)}
				{hasRemainingRows && (
					<Button
						variant="outline"
						onClick={onReviewRemaining}
						className="flex-1"
					>
						Review remaining
					</Button>
				)}
				<Button onClick={onDone} className="flex-1">
					Done
				</Button>
			</div>
		</div>
	)
}
