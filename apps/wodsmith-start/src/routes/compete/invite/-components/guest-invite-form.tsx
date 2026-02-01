"use client"

import { useServerFn } from "@tanstack/react-start"
import { ChevronDown, FileText, Loader2 } from "lucide-react"
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
import type { Waiver } from "@/db/schemas/waivers"
import { submitPendingInviteDataFn } from "@/server-fns/invite-fns"
import type { RegistrationQuestion } from "@/server-fns/registration-questions-fns"

interface GuestInviteFormProps {
	token: string
	questions: RegistrationQuestion[]
	waivers: Waiver[]
	teamName: string
	competitionName: string
	onSuccess: () => void
}

/**
 * Guest invite form component for unauthenticated users.
 * Allows users to answer questions and sign waivers before creating an account.
 * Stores data in invitation.metadata for later transfer to user account.
 */
export function GuestInviteForm({
	token,
	questions,
	waivers,
	competitionName,
	onSuccess,
}: GuestInviteFormProps) {
	const [guestName, setGuestName] = useState("")
	const [answers, setAnswers] = useState<Record<string, string>>({})
	const [signatures, setSignatures] = useState<
		Record<string, { signatureName: string; agreed: boolean }>
	>({})
	const [isSubmitting, setIsSubmitting] = useState(false)

	const submitPendingData = useServerFn(submitPendingInviteDataFn)

	const handleAnswerChange = (questionId: string, value: string) => {
		setAnswers((prev) => ({ ...prev, [questionId]: value }))
	}

	const handleSignatureNameChange = (waiverId: string, name: string) => {
		setSignatures((prev) => ({
			...prev,
			[waiverId]: {
				signatureName: name,
				agreed: prev[waiverId]?.agreed || false,
			},
		}))
	}

	const handleAgreementChange = (waiverId: string, agreed: boolean) => {
		setSignatures((prev) => ({
			...prev,
			[waiverId]: {
				signatureName: prev[waiverId]?.signatureName || "",
				agreed,
			},
		}))
	}

	// Validate all required fields
	const hasValidName = guestName.trim().length > 0

	const requiredQuestions = questions.filter((q) => q.required)
	const allRequiredAnswered = requiredQuestions.every(
		(q) => answers[q.id] && answers[q.id].trim() !== "",
	)

	const requiredWaivers = waivers.filter((w) => w.required)
	const allRequiredWaiversSigned = requiredWaivers.every(
		(w) =>
			signatures[w.id]?.signatureName?.trim() !== "" &&
			signatures[w.id]?.agreed === true,
	)

	const canSubmit = hasValidName && allRequiredAnswered && allRequiredWaiversSigned

	const handleSubmit = async () => {
		setIsSubmitting(true)

		try {
			// Convert answers to array format
			const answersArray = Object.entries(answers)
				.filter(([_, value]) => value && value.trim() !== "")
				.map(([questionId, answer]) => ({
					questionId,
					answer,
				}))

			// Convert signatures to array format
			const signaturesArray = Object.entries(signatures)
				.filter(([_, sig]) => sig.signatureName && sig.agreed)
				.map(([waiverId, sig]) => ({
					waiverId,
					signedAt: new Date().toISOString(),
					signatureName: sig.signatureName,
				}))

			const result = await submitPendingData({
				data: {
					token,
					guestName: guestName.trim(),
					answers: answersArray.length > 0 ? answersArray : undefined,
					signatures: signaturesArray.length > 0 ? signaturesArray : undefined,
				},
			})

			if (result.success) {
				toast.success("Registration information saved")
				onSuccess()
			} else {
				toast.error("Failed to save registration information")
			}
		} catch (err) {
			toast.error(
				err instanceof Error
					? err.message
					: "Failed to save registration information",
			)
		} finally {
			setIsSubmitting(false)
		}
	}

	const hasQuestions = questions.length > 0
	const hasWaivers = waivers.length > 0

	return (
		<div className="space-y-6">
			{/* Name Field - Always Required */}
			<Card>
				<CardHeader>
					<CardTitle>Your Information</CardTitle>
					<CardDescription>
						Enter your name to complete registration
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="space-y-2">
						<Label htmlFor="guest-name">
							Full Name
							<span className="text-destructive ml-1">*</span>
						</Label>
						<Input
							id="guest-name"
							value={guestName}
							onChange={(e) => setGuestName(e.target.value)}
							placeholder="Enter your full name"
						/>
					</div>
				</CardContent>
			</Card>

			{/* Questions Section */}
			{hasQuestions && (
				<Card>
					<CardHeader>
						<CardTitle>Registration Questions</CardTitle>
						<CardDescription>
							Please answer these questions for {competitionName}
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-6">
						{questions.map((question) => (
							<div key={question.id} className="space-y-2">
								<Label htmlFor={`question-${question.id}`}>
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
										id={`question-${question.id}`}
										value={answers[question.id] || ""}
										onChange={(e) =>
											handleAnswerChange(question.id, e.target.value)
										}
										placeholder="Enter your answer"
									/>
								)}

								{question.type === "number" && (
									<Input
										id={`question-${question.id}`}
										type="number"
										value={answers[question.id] || ""}
										onChange={(e) =>
											handleAnswerChange(question.id, e.target.value)
										}
										placeholder="Enter a number"
									/>
								)}

								{question.type === "select" && question.options && (
									<Select
										value={answers[question.id] || ""}
										onValueChange={(value) =>
											handleAnswerChange(question.id, value)
										}
									>
										<SelectTrigger id={`question-${question.id}`}>
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

			{/* Waivers Section */}
			{hasWaivers && (
				<Card>
					<CardHeader>
						<CardTitle>Required Waivers</CardTitle>
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
											<CardTitle className="text-lg">
												{waiver.title}
												{waiver.required && (
													<span className="text-destructive ml-1">*</span>
												)}
											</CardTitle>
											<CollapsibleTrigger asChild>
												<Button variant="ghost" size="sm">
													<FileText className="h-4 w-4 mr-2" />
													View Details
													<ChevronDown className="h-4 w-4 ml-2" />
												</Button>
											</CollapsibleTrigger>
										</div>
									</CardHeader>
									<CollapsibleContent>
										<CardContent className="space-y-4 pt-0">
											{/* Waiver Content */}
											<div className="border rounded-lg p-4 max-h-96 overflow-y-auto bg-muted/10">
												<WaiverViewer
													content={waiver.content}
													className="prose prose-sm max-w-none dark:prose-invert"
												/>
											</div>
										</CardContent>
									</CollapsibleContent>
								</Collapsible>
								<CardContent className="space-y-4">
									{/* Signature Input */}
									<div className="space-y-2">
										<Label htmlFor={`signature-${waiver.id}`}>
											Full Name (Signature)
											{waiver.required && (
												<span className="text-destructive ml-1">*</span>
											)}
										</Label>
										<Input
											id={`signature-${waiver.id}`}
											value={signatures[waiver.id]?.signatureName || ""}
											onChange={(e) =>
												handleSignatureNameChange(waiver.id, e.target.value)
											}
											placeholder="Enter your full name"
										/>
									</div>

									{/* Agreement Checkbox */}
									<div className="flex items-start gap-3 p-4 bg-muted/20 rounded-lg">
										<Checkbox
											id={`agree-${waiver.id}`}
											checked={signatures[waiver.id]?.agreed || false}
											onCheckedChange={(checked) =>
												handleAgreementChange(waiver.id, checked === true)
											}
										/>
										<Label
											htmlFor={`agree-${waiver.id}`}
											className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
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

			{/* Submit Button */}
			<Button
				onClick={handleSubmit}
				disabled={!canSubmit || isSubmitting}
				className="w-full"
				size="lg"
			>
				{isSubmitting ? (
					<>
						<Loader2 className="w-4 h-4 mr-2 animate-spin" />
						Saving...
					</>
				) : (
					"Complete Registration"
				)}
			</Button>
		</div>
	)
}
