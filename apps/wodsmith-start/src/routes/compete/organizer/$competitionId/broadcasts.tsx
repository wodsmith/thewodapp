/**
 * Competition Broadcasts Route
 *
 * Organizer page for sending one-way broadcast messages to athletes.
 * Supports audience filtering by division, volunteer role, and registration question answers.
 */
// @lat: [[organizer-dashboard#Broadcasts]]

import { createFileRoute, getRouteApi, useRouter } from "@tanstack/react-router"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Filter, Megaphone, Plus, Send, Users, X } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
	getDistinctAnswersFn,
	listBroadcastsFn,
	previewAudienceFn,
	sendBroadcastFn,
} from "@/server-fns/broadcast-fns"
import type { QuestionFilter } from "@/server-fns/broadcast-fns"
import { getCompetitionDivisionsWithCountsFn } from "@/server-fns/competition-divisions-fns"
import {
	getCompetitionQuestionsFn,
	getVolunteerQuestionsFn,
} from "@/server-fns/registration-questions-fns"
import type { RegistrationQuestion } from "@/server-fns/registration-questions-fns"

// Get parent route API to access its loader data
const parentRoute = getRouteApi("/compete/organizer/$competitionId")

export const Route = createFileRoute(
	"/compete/organizer/$competitionId/broadcasts",
)({
	staleTime: 10_000,
	component: BroadcastsPage,
	loader: async ({ params, parentMatchPromise }) => {
		const parentMatch = await parentMatchPromise
		const { competition } = parentMatch.loaderData!

		const [
			{ broadcasts },
			divisionsResult,
			{ questions: athleteQuestions },
			{ questions: volunteerQuestions },
		] = await Promise.all([
			listBroadcastsFn({ data: { competitionId: params.competitionId } }),
			getCompetitionDivisionsWithCountsFn({
				data: {
					competitionId: params.competitionId,
					teamId: competition.organizingTeamId,
				},
			}),
			getCompetitionQuestionsFn({
				data: { competitionId: params.competitionId },
			}),
			getVolunteerQuestionsFn({
				data: { competitionId: params.competitionId },
			}),
		])

		const divisions = (divisionsResult.divisions ?? []).map(
			(d: { id: string; label: string }) => ({
				id: d.id,
				name: d.label,
			}),
		)

		return { broadcasts, divisions, athleteQuestions, volunteerQuestions }
	},
})

function BroadcastsPage() {
	const { broadcasts, divisions, athleteQuestions, volunteerQuestions } =
		Route.useLoaderData()
	const { competition } = parentRoute.useLoaderData()
	const router = useRouter()
	const [isComposing, setIsComposing] = useState(false)

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold tracking-tight">Broadcasts</h1>
					<p className="text-muted-foreground">
						Send announcements to your registered athletes
					</p>
				</div>
				{!isComposing && (
					<Button onClick={() => setIsComposing(true)}>
						<Plus className="mr-2 h-4 w-4" />
						New Broadcast
					</Button>
				)}
			</div>

			{isComposing && (
				<ComposeCard
					competitionId={competition.id}
					divisions={divisions}
					athleteQuestions={athleteQuestions}
					volunteerQuestions={volunteerQuestions}
					onSent={() => {
						setIsComposing(false)
						router.invalidate()
					}}
					onCancel={() => setIsComposing(false)}
				/>
			)}

			{broadcasts.length === 0 && !isComposing ? (
				<Card>
					<CardContent className="flex flex-col items-center justify-center py-12">
						<Megaphone className="h-12 w-12 text-muted-foreground mb-4" />
						<h3 className="text-lg font-semibold mb-1">No broadcasts yet</h3>
						<p className="text-muted-foreground text-sm mb-4">
							Send your first broadcast to communicate with athletes
						</p>
						<Button onClick={() => setIsComposing(true)}>
							<Plus className="mr-2 h-4 w-4" />
							New Broadcast
						</Button>
					</CardContent>
				</Card>
			) : (
				<div className="space-y-4">
					{broadcasts.map((broadcast) => (
						<Card key={broadcast.id}>
							<CardHeader className="pb-3">
								<div className="flex items-center justify-between">
									<CardTitle className="text-lg">
										{broadcast.title}
									</CardTitle>
									<div className="flex items-center gap-2">
										<Badge variant="outline" className="gap-1">
											<Users className="h-3 w-3" />
											{broadcast.recipientCount}
										</Badge>
										{broadcast.deliveryStats.failed > 0 ? (
											<Badge variant="destructive">
												{broadcast.deliveryStats.failed} failed
											</Badge>
										) : (
											<Badge variant="secondary">
												{broadcast.deliveryStats.sent} delivered
											</Badge>
										)}
									</div>
								</div>
								<CardDescription>
									{broadcast.sentAt
										? new Date(broadcast.sentAt).toLocaleDateString(
												"en-US",
												{
													month: "short",
													day: "numeric",
													year: "numeric",
													hour: "numeric",
													minute: "2-digit",
												},
											)
										: "Draft"}
								</CardDescription>
							</CardHeader>
							<CardContent>
								<p className="text-sm text-muted-foreground whitespace-pre-wrap">
									{broadcast.body}
								</p>
							</CardContent>
						</Card>
					))}
				</div>
			)}
		</div>
	)
}

// ============================================================================
// Compose Card
// ============================================================================

interface Division {
	id: string
	name: string
}

type AudienceFilterType =
	| "all"
	| "division"
	| "public"
	| "volunteers"
	| "volunteer_role"

const VOLUNTEER_ROLES = [
	{ value: "judge", label: "Judge" },
	{ value: "head_judge", label: "Head Judge" },
	{ value: "scorekeeper", label: "Scorekeeper" },
	{ value: "check_in", label: "Check-In" },
	{ value: "medical", label: "Medical" },
	{ value: "emcee", label: "Emcee" },
	{ value: "floor_manager", label: "Floor Manager" },
	{ value: "equipment", label: "Equipment" },
	{ value: "equipment_team", label: "Equipment Team" },
	{ value: "media", label: "Media" },
	{ value: "athlete_control", label: "Athlete Control" },
	{ value: "staff", label: "Staff" },
	{ value: "general", label: "General" },
]

function ComposeCard({
	competitionId,
	divisions,
	athleteQuestions,
	volunteerQuestions,
	onSent,
	onCancel,
}: {
	competitionId: string
	divisions: Division[]
	athleteQuestions: RegistrationQuestion[]
	volunteerQuestions: RegistrationQuestion[]
	onSent: () => void
	onCancel: () => void
}) {
	const [title, setTitle] = useState("")
	const [body, setBody] = useState("")
	const [filterType, setFilterType] = useState<AudienceFilterType>("all")
	const [divisionId, setDivisionId] = useState<string>("")
	const [volunteerRole, setVolunteerRole] = useState<string>("")
	const [questionFilters, setQuestionFilters] = useState<QuestionFilter[]>([])
	const [shouldSendEmail, setShouldSendEmail] = useState(true)
	const [audienceCount, setAudienceCount] = useState<number | null>(null)
	const [isSending, setIsSending] = useState(false)
	const [isPreviewing, setIsPreviewing] = useState(false)
	const [showQuestionFilters, setShowQuestionFilters] = useState(false)

	// Determine which questions to show based on audience type
	const relevantQuestions = useMemo(() => {
		const isAthleteAudience =
			filterType === "all" || filterType === "division"
		const isVolunteerAudience =
			filterType === "volunteers" || filterType === "volunteer_role"
		const isPublic = filterType === "public"

		if (isAthleteAudience) return athleteQuestions
		if (isVolunteerAudience) return volunteerQuestions
		if (isPublic) return [...athleteQuestions, ...volunteerQuestions]
		return []
	}, [filterType, athleteQuestions, volunteerQuestions])

	const audienceFilter = useMemo(() => {
		const base =
			filterType === "division" && divisionId
				? { type: "division" as const, divisionId }
				: filterType === "volunteer_role" && volunteerRole
					? { type: "volunteer_role" as const, volunteerRole }
					: { type: filterType as "all" | "public" | "volunteers" }

		if (questionFilters.length > 0) {
			return { ...base, questionFilters }
		}
		return base
	}, [filterType, divisionId, volunteerRole, questionFilters])

	// Auto-fetch recipient count when filter is complete
	const filterReady =
		(filterType !== "division" || !!divisionId) &&
		(filterType !== "volunteer_role" || !!volunteerRole)

	// Debounce the preview call
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	useEffect(() => {
		if (!filterReady) {
			setAudienceCount(null)
			setIsPreviewing(false)
			return
		}
		let cancelled = false
		setIsPreviewing(true)

		if (debounceRef.current) clearTimeout(debounceRef.current)
		debounceRef.current = setTimeout(() => {
			previewAudienceFn({
				data: { competitionId, audienceFilter },
			})
				.then((result) => {
					if (!cancelled) setAudienceCount(result.count)
				})
				.catch(() => {
					if (!cancelled) setAudienceCount(null)
				})
				.finally(() => {
					if (!cancelled) setIsPreviewing(false)
				})
		}, 300)

		return () => {
			cancelled = true
			if (debounceRef.current) clearTimeout(debounceRef.current)
		}
	}, [filterReady, audienceFilter, competitionId])

	const updateQuestionFilter = useCallback(
		(questionId: string, values: string[]) => {
			setQuestionFilters((prev) => {
				if (values.length === 0) {
					return prev.filter((f) => f.questionId !== questionId)
				}
				const existing = prev.find((f) => f.questionId === questionId)
				if (existing) {
					return prev.map((f) =>
						f.questionId === questionId ? { ...f, values } : f,
					)
				}
				return [...prev, { questionId, values }]
			})
			setAudienceCount(null)
		},
		[],
	)

	const handleSend = async () => {
		if (!title.trim() || !body.trim()) {
			toast.error("Title and body are required")
			return
		}

		if (filterType === "division" && !divisionId) {
			toast.error("Please select a division")
			return
		}

		if (filterType === "volunteer_role" && !volunteerRole) {
			toast.error("Please select a volunteer role")
			return
		}

		setIsSending(true)
		try {
			const result = await sendBroadcastFn({
				data: {
					competitionId,
					title: title.trim(),
					body: body.trim(),
					audienceFilter,
					sendEmail: shouldSendEmail,
				},
			})
			toast.success(
				`Broadcast sent to ${result.recipientCount} recipient${result.recipientCount === 1 ? "" : "s"}`,
			)
			onSent()
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : "Failed to send broadcast",
			)
		} finally {
			setIsSending(false)
		}
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>New Broadcast</CardTitle>
				<CardDescription>
					Compose a message to send to athletes, volunteers, or everyone via
					email and in-app notification
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="space-y-2">
					<Label htmlFor="title">Title</Label>
					<Input
						id="title"
						placeholder="e.g., Schedule Change for Saturday"
						value={title}
						onChange={(e) => setTitle(e.target.value)}
					/>
				</div>

				<div className="space-y-2">
					<Label htmlFor="body">Message</Label>
					<Textarea
						id="body"
						placeholder="Write your broadcast message..."
						rows={5}
						value={body}
						onChange={(e) => setBody(e.target.value)}
					/>
				</div>

				<div className="space-y-2">
					<Label>Audience</Label>
					<div className="flex gap-3">
						<Select
							value={filterType}
							onValueChange={(v) => {
								setFilterType(v as AudienceFilterType)
								setDivisionId("")
								setVolunteerRole("")
								setQuestionFilters([])
								setShowQuestionFilters(false)
								setAudienceCount(null)
							}}
						>
							<SelectTrigger className="w-[200px]">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="public">Everyone (Public)</SelectItem>
								<SelectItem value="all">All Athletes</SelectItem>
								<SelectItem value="division">Athletes by Division</SelectItem>
								<SelectItem value="volunteers">All Volunteers</SelectItem>
								<SelectItem value="volunteer_role">Volunteers by Role</SelectItem>
							</SelectContent>
						</Select>

						{filterType === "division" && (
							<Select
								value={divisionId}
								onValueChange={(v) => {
									setDivisionId(v)
									setAudienceCount(null)
								}}
							>
								<SelectTrigger className="w-[200px]">
									<SelectValue placeholder="Select division" />
								</SelectTrigger>
								<SelectContent>
									{divisions.map((div) => (
										<SelectItem key={div.id} value={div.id}>
											{div.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						)}

						{filterType === "volunteer_role" && (
							<Select
								value={volunteerRole}
								onValueChange={(v) => {
									setVolunteerRole(v)
									setAudienceCount(null)
								}}
							>
								<SelectTrigger className="w-[200px]">
									<SelectValue placeholder="Select role" />
								</SelectTrigger>
								<SelectContent>
									{VOLUNTEER_ROLES.map((role) => (
										<SelectItem key={role.value} value={role.value}>
											{role.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						)}

						<span className="flex items-center gap-1.5 text-sm text-muted-foreground">
							<Users className="h-4 w-4" />
							{isPreviewing
								? "Counting..."
								: audienceCount !== null
									? `${audienceCount} recipient${audienceCount === 1 ? "" : "s"}`
									: ""}
						</span>
					</div>
				</div>

				{/* Question Filters */}
				{filterReady && relevantQuestions.length > 0 && (
					<div className="space-y-3">
						{!showQuestionFilters ? (
							<Button
								variant="outline"
								size="sm"
								onClick={() => setShowQuestionFilters(true)}
							>
								<Filter className="mr-2 h-4 w-4" />
								Filter by registration questions
							</Button>
						) : (
							<div className="space-y-3 rounded-md border p-4">
								<div className="flex items-center justify-between">
									<Label className="text-sm font-medium">
										Filter by registration questions
									</Label>
									<Button
										variant="ghost"
										size="sm"
										onClick={() => {
											setShowQuestionFilters(false)
											setQuestionFilters([])
											setAudienceCount(null)
										}}
									>
										<X className="h-4 w-4" />
									</Button>
								</div>
								<p className="text-xs text-muted-foreground">
									Narrow recipients by their answers. Multiple questions are
									combined with AND logic.
								</p>
								<div className="space-y-4">
									{relevantQuestions.map((question) => (
										<QuestionFilterRow
											key={question.id}
											question={question}
											competitionId={competitionId}
											selectedValues={
												questionFilters.find(
													(f) => f.questionId === question.id,
												)?.values ?? []
											}
											onChange={(values) =>
												updateQuestionFilter(question.id, values)
											}
										/>
									))}
								</div>
							</div>
						)}

						{/* Active question filter chips */}
						{questionFilters.length > 0 && (
							<div className="flex flex-wrap gap-2">
								{questionFilters.map((f) => {
									const question = relevantQuestions.find(
										(q) => q.id === f.questionId,
									)
									return (
										<Badge
											key={f.questionId}
											variant="secondary"
											className="gap-1 pr-1"
										>
											{question?.label}: {f.values.join(", ")}
											<button
												type="button"
												onClick={() =>
													updateQuestionFilter(f.questionId, [])
												}
												className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
											>
												<X className="h-3 w-3" />
											</button>
										</Badge>
									)
								})}
							</div>
						)}
					</div>
				)}

				<label className="flex items-center gap-2 text-sm">
					<input
						type="checkbox"
						checked={shouldSendEmail}
						onChange={(e) => setShouldSendEmail(e.target.checked)}
						className="rounded border-border"
					/>
					Send email notification to recipients
				</label>

				<div className="flex justify-end gap-3 pt-4 border-t">
					<Button variant="outline" onClick={onCancel} disabled={isSending}>
						Cancel
					</Button>
					<Button
						onClick={handleSend}
						disabled={isSending || !title.trim() || !body.trim()}
					>
						<Send className="mr-2 h-4 w-4" />
						{isSending ? "Sending..." : "Send Broadcast"}
					</Button>
				</div>
			</CardContent>
		</Card>
	)
}

// ============================================================================
// Question Filter Row
// ============================================================================

function QuestionFilterRow({
	question,
	competitionId,
	selectedValues,
	onChange,
}: {
	question: RegistrationQuestion
	competitionId: string
	selectedValues: string[]
	onChange: (values: string[]) => void
}) {
	if (question.type === "select" && question.options) {
		return (
			<div className="space-y-2">
				<Label className="text-sm">{question.label}</Label>
				<div className="flex flex-wrap gap-3">
					{question.options.map((option) => {
						const checked = selectedValues.includes(option)
						const id = `qf-${question.id}-${option}`
						return (
							<div
								key={option}
								className="flex items-center gap-2 text-sm"
							>
								<Checkbox
									id={id}
									checked={checked}
									onCheckedChange={(c) => {
										if (c) {
											onChange([...selectedValues, option])
										} else {
											onChange(
												selectedValues.filter((v) => v !== option),
											)
										}
									}}
								/>
								<Label htmlFor={id} className="text-sm font-normal cursor-pointer">
									{option}
								</Label>
							</div>
						)
					})}
				</div>
			</div>
		)
	}

	// Text/Number questions — tag input with autocomplete
	return (
		<TextQuestionFilter
			question={question}
			competitionId={competitionId}
			selectedValues={selectedValues}
			onChange={onChange}
		/>
	)
}

// ============================================================================
// Text/Number Question Filter with Autocomplete
// ============================================================================

function TextQuestionFilter({
	question,
	competitionId,
	selectedValues,
	onChange,
}: {
	question: RegistrationQuestion
	competitionId: string
	selectedValues: string[]
	onChange: (values: string[]) => void
}) {
	const [inputValue, setInputValue] = useState("")
	const [suggestions, setSuggestions] = useState<string[]>([])
	const [showSuggestions, setShowSuggestions] = useState(false)
	const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false)
	const inputRef = useRef<HTMLInputElement>(null)

	const loadSuggestions = useCallback(async () => {
		setIsLoadingSuggestions(true)
		try {
			const result = await getDistinctAnswersFn({
				data: {
					competitionId,
					questionId: question.id,
					questionTarget: question.questionTarget,
				},
			})
			setSuggestions(
				result.values.filter((v) => !selectedValues.includes(v)),
			)
		} catch {
			setSuggestions([])
		} finally {
			setIsLoadingSuggestions(false)
		}
	}, [competitionId, question.id, question.questionTarget, selectedValues])

	const addValue = (value: string) => {
		const trimmed = value.trim()
		if (trimmed && !selectedValues.includes(trimmed)) {
			onChange([...selectedValues, trimmed])
		}
		setInputValue("")
		setShowSuggestions(false)
	}

	const filteredSuggestions = suggestions.filter(
		(s) =>
			!selectedValues.includes(s) &&
			s.toLowerCase().includes(inputValue.toLowerCase()),
	)

	return (
		<div className="space-y-2">
			<Label className="text-sm">{question.label}</Label>
			<div className="flex flex-wrap gap-1.5 mb-2">
				{selectedValues.map((val) => (
					<Badge key={val} variant="secondary" className="gap-1 pr-1">
						{val}
						<button
							type="button"
							onClick={() =>
								onChange(selectedValues.filter((v) => v !== val))
							}
							className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
						>
							<X className="h-3 w-3" />
						</button>
					</Badge>
				))}
			</div>
			<div className="relative">
				<Input
					ref={inputRef}
					value={inputValue}
					onChange={(e) => setInputValue(e.target.value)}
					onFocus={() => {
						setShowSuggestions(true)
						loadSuggestions()
					}}
					onBlur={() => {
						// Delay to allow click on suggestion
						setTimeout(() => setShowSuggestions(false), 200)
					}}
					onKeyDown={(e) => {
						if (e.key === "Enter") {
							e.preventDefault()
							if (inputValue.trim()) {
								addValue(inputValue)
							}
						}
					}}
					placeholder={`Type a value to match...`}
					className="h-8 text-sm"
				/>
				{showSuggestions && filteredSuggestions.length > 0 && (
					<div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md">
						<div className="max-h-32 overflow-y-auto p-1">
							{isLoadingSuggestions ? (
								<p className="px-2 py-1 text-xs text-muted-foreground">
									Loading...
								</p>
							) : (
								filteredSuggestions.map((suggestion) => (
									<button
										key={suggestion}
										type="button"
										className="w-full rounded px-2 py-1 text-left text-sm hover:bg-accent"
										onMouseDown={(e) => e.preventDefault()}
										onClick={() => addValue(suggestion)}
									>
										{suggestion}
									</button>
								))
							)}
						</div>
					</div>
				)}
			</div>
		</div>
	)
}
