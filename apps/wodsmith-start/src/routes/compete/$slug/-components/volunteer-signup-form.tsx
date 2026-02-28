"use client"

import { CheckCircle2, Loader2 } from "lucide-react"
import { useState } from "react"
import { useServerFn } from "@tanstack/react-start"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
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
import { VOLUNTEER_AVAILABILITY } from "@/db/schemas/volunteers"
import type { RegistrationQuestion } from "@/server-fns/registration-questions-fns"
import {
	createAccountAndApplyAsVolunteerFn,
	submitVolunteerSignupFn,
} from "@/server-fns/volunteer-fns"

interface VolunteerSignupFormProps {
	competition: {
		id: string
		name: string
		slug: string
	}
	competitionTeamId: string
	questions?: RegistrationQuestion[]
	currentUser: { name: string; email: string } | null
}

/**
 * Public volunteer sign-up form.
 * - Logged-in users: name/email pre-filled and read-only.
 * - Anonymous users: name, email, and password fields shown so they can
 *   create an account and sign up as a volunteer in one step.
 */
export function VolunteerSignupForm({
	competition,
	competitionTeamId,
	questions = [],
	currentUser,
}: VolunteerSignupFormProps) {
	const [submitted, setSubmitted] = useState(false)
	const [isPending, setIsPending] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [answers, setAnswers] = useState<Record<string, string>>({})

	const submitVolunteerSignup = useServerFn(submitVolunteerSignupFn)
	const createAccountAndApply = useServerFn(createAccountAndApplyAsVolunteerFn)

	const handleAnswerChange = (questionId: string, value: string) => {
		setAnswers((prev) => ({ ...prev, [questionId]: value }))
	}

	async function handleSubmit(formData: FormData) {
		setIsPending(true)
		setError(null)

		const availabilityValue = formData.get("availability") as string

		// Validate required questions
		for (const q of questions) {
			if (q.required && (!answers[q.id] || answers[q.id].trim() === "")) {
				setError(`Please answer the required question: "${q.label}"`)
				setIsPending(false)
				return
			}
		}

		const answersArray = Object.entries(answers)
			.filter(([_, value]) => value && value.trim() !== "")
			.map(([questionId, answer]) => ({ questionId, answer }))

		// Resolve name/email — either from the logged-in user or the form
		const signupName = currentUser
			? currentUser.name
			: (formData.get("name") as string)
		const signupEmail = currentUser
			? currentUser.email
			: (formData.get("email") as string)

		const sharedFields = {
			competitionTeamId,
			signupName,
			signupEmail,
			signupPhone: (formData.get("phone") as string) || undefined,
			credentials: (formData.get("credentials") as string) || undefined,
			availability: availabilityValue as "morning" | "afternoon" | "all_day",
			availabilityNotes:
				(formData.get("availabilityNotes") as string) || undefined,
			website: (formData.get("website") as string) || undefined,
			answers: answersArray.length > 0 ? answersArray : undefined,
		}

		try {
			if (currentUser) {
				// Already logged in — just submit the application
				await submitVolunteerSignup({ data: sharedFields })
			} else {
				// Not logged in — create account + submit application in one server call
				const password = formData.get("password") as string
				const nameParts = signupName.trim().split(/\s+/).filter(Boolean)
				if (nameParts.length < 2) {
					setError("Please enter both your first and last name.")
					setIsPending(false)
					return
				}
				const firstName = nameParts[0]
				const lastName = nameParts.slice(1).join(" ")

				await createAccountAndApply({
					data: {
						firstName,
						lastName,
						password,
						...sharedFields,
					},
				})
			}
			setSubmitted(true)
		} catch (err) {
			setError(
				err instanceof Error
					? err.message
					: "Something went wrong. Please try again.",
			)
		} finally {
			setIsPending(false)
		}
	}

	if (submitted) {
		return (
			<Card>
				<CardContent className="pt-6">
					<div className="space-y-4 text-center">
						<div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
							<CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
						</div>
						<h2 className="text-2xl font-bold">Thank you for signing up!</h2>
						<p className="text-muted-foreground">
							Your volunteer application for{" "}
							<span className="font-medium">{competition.name}</span> has been
							submitted. The organizers will review your application and contact
							you with next steps.
						</p>
					</div>
				</CardContent>
			</Card>
		)
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Volunteer for {competition.name}</CardTitle>
				<CardDescription>
					{currentUser
						? "Review your details and submit your volunteer application."
						: "Create an account and sign up to volunteer. The organizers will review your application and reach out with more information."}
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form action={handleSubmit} className="space-y-6">
					{/* Honeypot field - hidden from humans, visible to bots */}
					<div className="sr-only" aria-hidden="true">
						<Label htmlFor="website">Website</Label>
						<Input
							type="text"
							id="website"
							name="website"
							tabIndex={-1}
							autoComplete="off"
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="name">
							Full Name <span className="text-destructive">*</span>
						</Label>
						<Input
							type="text"
							id="name"
							name="name"
							required={!currentUser}
							defaultValue={currentUser?.name ?? ""}
							readOnly={!!currentUser}
							disabled={isPending || !!currentUser}
							placeholder="Your full name"
							className={currentUser ? "bg-muted" : ""}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="email">
							Email <span className="text-destructive">*</span>
						</Label>
						<Input
							type="email"
							id="email"
							name="email"
							required={!currentUser}
							defaultValue={currentUser?.email ?? ""}
							readOnly={!!currentUser}
							disabled={isPending || !!currentUser}
							placeholder="your@email.com"
							className={currentUser ? "bg-muted" : ""}
						/>
						{!currentUser && (
							<p className="text-sm text-muted-foreground">
								We'll use this to contact you about your volunteer assignment.
							</p>
						)}
					</div>

					{/* Password field — only shown for non-logged-in users */}
					{!currentUser && (
						<div className="space-y-2">
							<Label htmlFor="password">
								Password <span className="text-destructive">*</span>
							</Label>
							<Input
								type="password"
								id="password"
								name="password"
								required
								disabled={isPending}
								placeholder="Create a password"
								autoComplete="new-password"
							/>
							<p className="text-sm text-muted-foreground">
								At least 8 characters with uppercase, lowercase, and a number.
							</p>
						</div>
					)}

					<div className="space-y-2">
						<Label htmlFor="phone">Phone Number</Label>
						<Input
							type="tel"
							id="phone"
							name="phone"
							placeholder="(555) 123-4567"
							disabled={isPending}
						/>
						<p className="text-sm text-muted-foreground">
							Optional - for day-of coordination
						</p>
					</div>

					<div className="space-y-2">
						<Label htmlFor="credentials">Certifications / Credentials</Label>
						<Textarea
							id="credentials"
							name="credentials"
							placeholder="e.g., CrossFit L1 Judge, CrossFit L2, EMT, First Aid/CPR certified..."
							rows={2}
							disabled={isPending}
						/>
						<p className="text-sm text-muted-foreground">
							List any relevant certifications or judging credentials you hold
						</p>
					</div>

					<div className="space-y-3">
						<Label>
							Availability <span className="text-destructive">*</span>
						</Label>
						<div className="space-y-2">
							<div className="flex items-center space-x-2">
								<input
									type="radio"
									id="availability-morning"
									name="availability"
									value={VOLUNTEER_AVAILABILITY.MORNING}
									required
									disabled={isPending}
									className="h-4 w-4"
								/>
								<Label htmlFor="availability-morning" className="font-normal">
									Morning
								</Label>
							</div>
							<div className="flex items-center space-x-2">
								<input
									type="radio"
									id="availability-afternoon"
									name="availability"
									value={VOLUNTEER_AVAILABILITY.AFTERNOON}
									required
									disabled={isPending}
									className="h-4 w-4"
								/>
								<Label htmlFor="availability-afternoon" className="font-normal">
									Afternoon
								</Label>
							</div>
							<div className="flex items-center space-x-2">
								<input
									type="radio"
									id="availability-all-day"
									name="availability"
									value={VOLUNTEER_AVAILABILITY.ALL_DAY}
									required
									disabled={isPending}
									className="h-4 w-4"
									defaultChecked
								/>
								<Label htmlFor="availability-all-day" className="font-normal">
									All Day
								</Label>
							</div>
						</div>
						<p className="text-sm text-muted-foreground">
							Select when you'll be available to volunteer
						</p>
					</div>

					<div className="space-y-2">
						<Label htmlFor="availabilityNotes">Additional Notes</Label>
						<Textarea
							id="availabilityNotes"
							name="availabilityNotes"
							placeholder="Anything else you'd like us to know about your availability, experience, or preferences..."
							rows={3}
							disabled={isPending}
						/>
					</div>

					{/* Volunteer Registration Questions */}
					{questions.length > 0 && (
						<div className="space-y-4 border-t pt-4">
							<p className="text-sm font-medium">Additional Questions</p>
							{questions.map((question) => (
								<div key={question.id} className="space-y-2">
									<Label htmlFor={question.id}>
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
											id={question.id}
											value={answers[question.id] || ""}
											onChange={(e) =>
												handleAnswerChange(question.id, e.target.value)
											}
											placeholder="Enter your answer"
											disabled={isPending}
										/>
									)}
									{question.type === "number" && (
										<Input
											id={question.id}
											type="number"
											value={answers[question.id] || ""}
											onChange={(e) =>
												handleAnswerChange(question.id, e.target.value)
											}
											placeholder="Enter a number"
											disabled={isPending}
										/>
									)}
									{question.type === "select" && question.options && (
										<Select
											value={answers[question.id] || ""}
											onValueChange={(value) =>
												handleAnswerChange(question.id, value)
											}
											disabled={isPending}
										>
											<SelectTrigger id={question.id}>
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
						</div>
					)}

					{error && (
						<div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4">
							<p className="text-sm text-destructive">{error}</p>
						</div>
					)}

					<Button type="submit" className="w-full" disabled={isPending}>
						{isPending ? (
							<>
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								Submitting...
							</>
						) : currentUser ? (
							"Sign Up to Volunteer"
						) : (
							"Create Account & Sign Up to Volunteer"
						)}
					</Button>

					{!currentUser && (
						<p className="text-center text-sm text-muted-foreground">
							Already have an account?{" "}
							<a
								href={`/sign-in?redirect=/compete/${competition.slug}/volunteer`}
								className="underline"
							>
								Sign in
							</a>{" "}
							to auto-fill your info.
						</p>
					)}
				</form>
			</CardContent>
		</Card>
	)
}
