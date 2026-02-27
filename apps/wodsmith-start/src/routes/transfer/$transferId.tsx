import { createFileRoute, Link, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import {
	AlertCircle,
	Calendar,
	CheckCircle2,
	ChevronDown,
	Clock,
	FileText,
	LogIn,
	Trophy,
	UserPlus,
	Users,
	XCircle,
} from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { WaiverViewer } from "@/components/compete/waiver-viewer"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import {
	acceptPurchaseTransferFn,
	getPendingTransferFn,
	getTransferSessionFn,
} from "@/server-fns/purchase-transfer-accept-fns"
import {
	getCompetitionQuestionsFn,
	type RegistrationQuestion,
} from "@/server-fns/registration-questions-fns"
import { getCompetitionWaiversFn } from "@/server-fns/waiver-fns"
import type { Waiver } from "@/db/schemas/waivers"
import { PURCHASE_TRANSFER_STATUS } from "@/db/schemas/commerce"

export const Route = createFileRoute("/transfer/$transferId")({
	loader: async ({ params }) => {
		const [transfer, session] = await Promise.all([
			getPendingTransferFn({ data: { transferId: params.transferId } }),
			getTransferSessionFn(),
		])

		let questions: RegistrationQuestion[] = []
		let waivers: Waiver[] = []

		if (transfer?.competition?.id) {
			const [questionsResult, waiversResult] = await Promise.all([
				getCompetitionQuestionsFn({
					data: { competitionId: transfer.competition.id },
				}),
				getCompetitionWaiversFn({
					data: { competitionId: transfer.competition.id },
				}),
			])
			questions = questionsResult.questions
			waivers = waiversResult.waivers
		}

		return {
			transfer,
			session,
			questions,
			waivers,
			transferId: params.transferId,
		}
	},
	component: TransferAcceptPage,
	head: ({ loaderData }) => {
		const competitionName = loaderData?.transfer?.competition?.name
		return {
			meta: [
				{
					title: competitionName
						? `Registration Transfer - ${competitionName}`
						: "Registration Transfer | WODsmith",
				},
				{
					name: "description",
					content: "Accept a competition registration transfer",
				},
			],
		}
	},
})

function TransferAcceptPage() {
	const { transfer, session, questions, waivers, transferId } =
		Route.useLoaderData()

	// Transfer not found
	if (!transfer) {
		return (
			<div className="container mx-auto max-w-lg py-16">
				<Card>
					<CardContent className="space-y-4 py-8 text-center">
						<AlertCircle className="mx-auto h-12 w-12 text-destructive" />
						<h2 className="text-xl font-semibold">Transfer Not Found</h2>
						<p className="text-muted-foreground">
							This transfer link is invalid or the transfer no longer exists.
						</p>
						<Button asChild variant="outline">
							<Link to="/compete">Browse Competitions</Link>
						</Button>
					</CardContent>
				</Card>
			</div>
		)
	}

	// Transfer COMPLETED
	if (transfer.transferState === PURCHASE_TRANSFER_STATUS.COMPLETED) {
		return (
			<div className="container mx-auto max-w-lg py-16">
				<Card>
					<CardContent className="space-y-4 py-8 text-center">
						<CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
						<h2 className="text-xl font-semibold">
							Transfer Already Accepted
						</h2>
						<p className="text-muted-foreground">
							This transfer has already been accepted.
						</p>
						{transfer.competition && (
							<Button asChild>
								<Link
									to="/compete/$slug"
									params={{ slug: transfer.competition.slug }}
								>
									View Competition
								</Link>
							</Button>
						)}
					</CardContent>
				</Card>
			</div>
		)
	}

	// Transfer EXPIRED
	if (
		transfer.transferState === PURCHASE_TRANSFER_STATUS.EXPIRED ||
		new Date(transfer.expiresAt) < new Date()
	) {
		return (
			<div className="container mx-auto max-w-lg py-16">
				<Card>
					<CardContent className="space-y-4 py-8 text-center">
						<Clock className="mx-auto h-12 w-12 text-yellow-500" />
						<h2 className="text-xl font-semibold">Transfer Expired</h2>
						<p className="text-muted-foreground">
							This transfer has expired. Contact the organizer to resend.
						</p>
						<Button asChild variant="outline">
							<Link to="/compete">Browse Competitions</Link>
						</Button>
					</CardContent>
				</Card>
			</div>
		)
	}

	// Transfer CANCELLED
	if (transfer.transferState === PURCHASE_TRANSFER_STATUS.CANCELLED) {
		return (
			<div className="container mx-auto max-w-lg py-16">
				<Card>
					<CardContent className="space-y-4 py-8 text-center">
						<XCircle className="mx-auto h-12 w-12 text-destructive" />
						<h2 className="text-xl font-semibold">Transfer Cancelled</h2>
						<p className="text-muted-foreground">
							This transfer was cancelled by the organizer.
						</p>
						<Button asChild variant="outline">
							<Link to="/compete">Browse Competitions</Link>
						</Button>
					</CardContent>
				</Card>
			</div>
		)
	}

	const redirectPath = `/transfer/${transferId}`
	const sourceFullName = [
		transfer.sourceUser.firstName,
		transfer.sourceUser.lastName,
	]
		.filter(Boolean)
		.join(" ")

	// Not logged in
	if (!session) {
		return (
			<div className="container mx-auto max-w-lg py-16">
				<Card>
					<CardHeader className="text-center">
						<div className="mx-auto mb-4 w-fit rounded-full bg-primary/10 p-3">
							<Trophy className="h-8 w-8 text-primary" />
						</div>
						<CardTitle className="text-2xl">Registration Transfer</CardTitle>
						<CardDescription>
							{sourceFullName || transfer.sourceUser.email || "Someone"} has
							transferred a registration to you
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-6">
						<TransferDetails transfer={transfer} sourceFullName={sourceFullName} />

						<div className="rounded-lg border p-4 text-center space-y-3">
							<p className="text-sm text-muted-foreground">
								Sign in or create an account to accept this transfer
							</p>
							<Button asChild className="w-full" size="lg">
								<Link to="/sign-in" search={{ redirect: redirectPath }}>
									<LogIn className="mr-2 h-4 w-4" />
									Sign In to Accept
								</Link>
							</Button>
							<p className="text-xs text-muted-foreground">
								Don&apos;t have an account?{" "}
								<Link
									to="/sign-up"
									search={{ redirect: redirectPath }}
									className="text-primary underline"
								>
									Create one
								</Link>
							</p>
						</div>

						<ExpiryNotice expiresAt={transfer.expiresAt} />
					</CardContent>
				</Card>
			</div>
		)
	}

	// Logged in + INITIATED — show full accept form
	return (
		<div className="container mx-auto max-w-lg py-16">
			<Card>
				<CardHeader className="text-center">
					<div className="mx-auto mb-4 w-fit rounded-full bg-primary/10 p-3">
						<Trophy className="h-8 w-8 text-primary" />
					</div>
					<CardTitle className="text-2xl">Registration Transfer</CardTitle>
					<CardDescription>
						{sourceFullName || transfer.sourceUser.email || "Someone"} has
						transferred a registration to you
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-6">
					{session.email &&
						transfer.targetEmail &&
						session.email.toLowerCase() !==
							transfer.targetEmail.toLowerCase() && (
							<div className="flex items-start gap-3 rounded-lg border border-yellow-500/50 bg-yellow-50 p-4 dark:bg-yellow-950/20">
								<AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
								<div className="text-sm">
									<p className="font-medium text-yellow-800 dark:text-yellow-300">
										Different account
									</p>
									<p className="text-yellow-700 dark:text-yellow-400 mt-1">
										This transfer was sent to{" "}
										<span className="font-medium">
											{transfer.targetEmail}
										</span>
										, but you&apos;re signed in as{" "}
										<span className="font-medium">{session.email}</span>. You
										can still accept it, but make sure this is the right
										account.
									</p>
								</div>
							</div>
						)}

					<TransferDetails transfer={transfer} sourceFullName={sourceFullName} />

					<AcceptTransferForm
						transferId={transferId}
						questions={questions}
						waivers={waivers}
						competitionSlug={transfer.competition?.slug}
					/>

					<ExpiryNotice expiresAt={transfer.expiresAt} />
				</CardContent>
			</Card>
		</div>
	)
}

// ============================================================================
// Sub-components
// ============================================================================

function TransferDetails({
	transfer,
	sourceFullName,
}: {
	transfer: NonNullable<Awaited<ReturnType<typeof getPendingTransferFn>>>
	sourceFullName: string
}) {
	return (
		<div className="space-y-3 rounded-lg bg-muted/50 p-4">
			{transfer.competition && (
				<div className="flex items-center gap-3">
					<Trophy className="h-5 w-5 text-muted-foreground shrink-0" />
					<div>
						<p className="text-sm text-muted-foreground">Competition</p>
						<p className="font-medium">{transfer.competition.name}</p>
					</div>
				</div>
			)}

			{transfer.division && (
				<div className="flex items-center gap-3">
					<Calendar className="h-5 w-5 text-muted-foreground shrink-0" />
					<div>
						<p className="text-sm text-muted-foreground">Division</p>
						<p className="font-medium">{transfer.division.label}</p>
					</div>
				</div>
			)}

			<div className="flex items-center gap-3">
				<UserPlus className="h-5 w-5 text-muted-foreground shrink-0" />
				<div>
					<p className="text-sm text-muted-foreground">From</p>
					<p className="font-medium">
						{sourceFullName || transfer.sourceUser.email || "Unknown"}
						{transfer.sourceUser.email && sourceFullName && (
							<span className="text-muted-foreground font-normal">
								{" "}
								({transfer.sourceUser.email})
							</span>
						)}
					</p>
				</div>
			</div>

			{transfer.team && (
				<div className="flex items-center gap-3">
					<Users className="h-5 w-5 text-muted-foreground shrink-0" />
					<div>
						<p className="text-sm text-muted-foreground">Team</p>
						<p className="font-medium">{transfer.team.name}</p>
					</div>
				</div>
			)}

			{transfer.teammates.length > 0 && (
				<div className="flex items-start gap-3">
					<Users className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
					<div>
						<p className="text-sm text-muted-foreground">Teammates</p>
						<ul className="mt-1 space-y-1">
							{transfer.teammates.map((teammate, i) => (
								<li key={i} className="text-sm flex items-center gap-1.5">
									<span
										className={
											teammate.status === "confirmed"
												? "text-green-600 dark:text-green-400"
												: "text-muted-foreground"
										}
									>
										{teammate.status === "confirmed" ? "+" : "-"}
									</span>
									<span>
										{teammate.name || teammate.email}
										{teammate.status === "pending" && (
											<span className="text-muted-foreground ml-1">
												(pending invite)
											</span>
										)}
									</span>
								</li>
							))}
						</ul>
					</div>
				</div>
			)}

			{transfer.notes && (
				<div className="pt-2 border-t">
					<p className="text-sm text-muted-foreground">Note from organizer</p>
					<p className="text-sm mt-1">{transfer.notes}</p>
				</div>
			)}
		</div>
	)
}

function ExpiryNotice({ expiresAt }: { expiresAt: Date }) {
	const formatted = new Date(expiresAt).toLocaleDateString("en-US", {
		month: "long",
		day: "numeric",
		year: "numeric",
	})
	return (
		<p className="text-center text-xs text-muted-foreground">
			This transfer expires on {formatted}
		</p>
	)
}

interface AcceptTransferFormProps {
	transferId: string
	questions: RegistrationQuestion[]
	waivers: Waiver[]
	competitionSlug?: string
}

function AcceptTransferForm({
	transferId,
	questions,
	waivers,
	competitionSlug,
}: AcceptTransferFormProps) {
	const router = useRouter()
	const acceptTransfer = useServerFn(acceptPurchaseTransferFn)
	const [isPending, setIsPending] = useState(false)

	// Question answers
	const [answers, setAnswers] = useState<Record<string, string>>({})

	// Waiver agreements: { [waiverId]: { signatureName, agreed } }
	const [waiverState, setWaiverState] = useState<
		Record<string, { signatureName: string; agreed: boolean }>
	>({})

	const handleAnswerChange = (questionId: string, value: string) => {
		setAnswers((prev) => ({ ...prev, [questionId]: value }))
	}

	const handleSignatureNameChange = (waiverId: string, name: string) => {
		setWaiverState((prev) => ({
			...prev,
			[waiverId]: {
				signatureName: name,
				agreed: prev[waiverId]?.agreed ?? false,
			},
		}))
	}

	const handleAgreedChange = (waiverId: string, agreed: boolean) => {
		setWaiverState((prev) => ({
			...prev,
			[waiverId]: {
				signatureName: prev[waiverId]?.signatureName ?? "",
				agreed,
			},
		}))
	}

	// Validation
	const requiredQuestions = questions.filter((q) => q.required)
	const allRequiredAnswered = requiredQuestions.every(
		(q) => (answers[q.id] ?? "").trim() !== "",
	)

	const requiredWaivers = waivers.filter((w) => w.required)
	const allRequiredWaiversSigned = requiredWaivers.every(
		(w) =>
			(waiverState[w.id]?.signatureName ?? "").trim() !== "" &&
			waiverState[w.id]?.agreed === true,
	)

	const canSubmit = allRequiredAnswered && allRequiredWaiversSigned

	async function handleAccept() {
		setIsPending(true)
		try {
			const answersArray = Object.entries(answers)
				.filter(([_, v]) => v.trim() !== "")
				.map(([questionId, answer]) => ({ questionId, answer }))

			// Only include waivers that have been agreed to with a signature
			const signaturesArray = Object.entries(waiverState)
				.filter(([_, s]) => s.agreed && s.signatureName.trim() !== "")
				.map(([waiverId]) => ({ waiverId }))

			await acceptTransfer({
				data: {
					transferId,
					answers: answersArray.length > 0 ? answersArray : undefined,
					waiverSignatures:
						signaturesArray.length > 0 ? signaturesArray : undefined,
				},
			})

			toast.success("Transfer accepted! Welcome to the competition.")
			await router.invalidate()

			if (competitionSlug) {
				router.navigate({
					to: "/compete/$slug",
					params: { slug: competitionSlug },
				})
			}
		} catch (err) {
			const message =
				err instanceof Error ? err.message : "Failed to accept transfer"
			toast.error(message)
			setIsPending(false)
		}
	}

	return (
		<>
			{/* Registration Questions */}
			{questions.length > 0 && (
				<Card>
					<CardHeader>
						<CardTitle className="text-base">Registration Questions</CardTitle>
						<CardDescription>
							Please answer these questions to complete your registration
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-5">
						{questions.map((question) => (
							<div key={question.id} className="space-y-2">
								<Label htmlFor={`q-${question.id}`}>
									{question.label}
									{question.required && (
										<span className="text-destructive ml-1">*</span>
									)}
								</Label>
								{question.helpText && (
									<p className="text-sm text-muted-foreground">
										{question.helpText}
									</p>
								)}

								{question.type === "text" && (
									<Input
										id={`q-${question.id}`}
										value={answers[question.id] ?? ""}
										onChange={(e) =>
											handleAnswerChange(question.id, e.target.value)
										}
										placeholder="Enter your answer"
									/>
								)}

								{question.type === "number" && (
									<Input
										id={`q-${question.id}`}
										type="number"
										value={answers[question.id] ?? ""}
										onChange={(e) =>
											handleAnswerChange(question.id, e.target.value)
										}
										placeholder="Enter a number"
									/>
								)}

								{question.type === "select" && question.options && (
									<Select
										value={answers[question.id] ?? ""}
										onValueChange={(value) =>
											handleAnswerChange(question.id, value)
										}
									>
										<SelectTrigger id={`q-${question.id}`}>
											<SelectValue placeholder="Select an option" />
										</SelectTrigger>
										<SelectContent>
											{question.options.map((option) => (
												<SelectItem key={option} value={option}>
													{option}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								)}
							</div>
						))}
					</CardContent>
				</Card>
			)}

			{/* Waivers */}
			{waivers.length > 0 && (
				<Card>
					<CardHeader>
						<CardTitle className="text-base">Waivers</CardTitle>
						<CardDescription>
							Please review and sign all required waivers
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						{waivers.map((waiver) => (
							<Card key={waiver.id} className="border-2">
								<Collapsible>
									<CardHeader>
										<div className="flex items-center justify-between">
											<CardTitle className="text-base">
												{waiver.title}
												{waiver.required && (
													<span className="text-destructive ml-1">*</span>
												)}
											</CardTitle>
											<CollapsibleTrigger asChild>
												<Button variant="ghost" size="sm">
													<FileText className="h-4 w-4 mr-2" />
													View
													<ChevronDown className="h-4 w-4 ml-2" />
												</Button>
											</CollapsibleTrigger>
										</div>
									</CardHeader>
									<CollapsibleContent>
										<CardContent className="space-y-4 pt-0">
											<div className="border rounded-lg p-4 max-h-64 overflow-y-auto bg-muted/10">
												<WaiverViewer
													content={waiver.content}
													className="prose prose-sm max-w-none dark:prose-invert"
												/>
											</div>
										</CardContent>
									</CollapsibleContent>
								</Collapsible>
								<CardContent className="space-y-4">
									<div className="space-y-2">
										<Label htmlFor={`sig-${waiver.id}`}>
											Full Name (Signature)
											{waiver.required && (
												<span className="text-destructive ml-1">*</span>
											)}
										</Label>
										<Input
											id={`sig-${waiver.id}`}
											value={waiverState[waiver.id]?.signatureName ?? ""}
											onChange={(e) =>
												handleSignatureNameChange(waiver.id, e.target.value)
											}
											placeholder="Enter your full name"
										/>
									</div>
									<div className="flex items-start gap-3 p-4 bg-muted/20 rounded-lg">
										<Checkbox
											id={`agree-${waiver.id}`}
											checked={waiverState[waiver.id]?.agreed ?? false}
											onCheckedChange={(checked) =>
												handleAgreedChange(waiver.id, checked === true)
											}
										/>
										<Label
											htmlFor={`agree-${waiver.id}`}
											className="text-sm font-medium leading-none cursor-pointer peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
										>
											I have read and agree to this waiver
										</Label>
									</div>
								</CardContent>
							</Card>
						))}
					</CardContent>
				</Card>
			)}

			{/* Accept button */}
			<Button
				onClick={handleAccept}
				disabled={isPending || !canSubmit}
				className="w-full"
				size="lg"
			>
				{isPending
					? "Accepting Transfer..."
					: !canSubmit
						? "Complete all required fields to accept"
						: "Accept Transfer"}
			</Button>
		</>
	)
}
