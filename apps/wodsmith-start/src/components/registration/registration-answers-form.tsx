"use client"

/**
 * Registration Answers Form Component
 * Displays and allows editing of competition registration question answers
 */

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema"
import { useServerFn } from "@tanstack/react-start"
import { ClipboardList, Loader2 } from "lucide-react"
import { useEffect, useMemo } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import {
	submitRegistrationAnswersFn,
	type RegistrationQuestion,
} from "@/server-fns/registration-questions-fns"

// ============================================================================
// Types & Schemas
// ============================================================================

interface Answer {
	questionId: string
	answer: string
	userId?: string
}

interface RegistrationAnswersFormProps {
	registrationId: string
	questions: RegistrationQuestion[]
	answers: Answer[]
	isEditable: boolean
	currentUserId: string
	isCaptain?: boolean
}

// Build dynamic form schema based on questions
const buildFormSchema = (questions: RegistrationQuestion[]) => {
	const schemaFields: Record<string, z.ZodString | z.ZodOptional<z.ZodString>> = {}

	for (const question of questions) {
		const fieldSchema = question.required
			? z.string().min(1, `${question.label} is required`)
			: z.string().optional()

		schemaFields[question.id] = fieldSchema
	}

	return z.object(schemaFields)
}

// ============================================================================
// Component
// ============================================================================

export function RegistrationAnswersForm({
	registrationId,
	questions,
	answers,
	isEditable,
	currentUserId,
	isCaptain = false,
}: RegistrationAnswersFormProps) {
	const submitAnswers = useServerFn(submitRegistrationAnswersFn)

	// Filter questions for current user
	// - Captain sees all questions (both regular and forTeammates)
	// - Teammates see only forTeammates questions
	const userQuestions = useMemo(() => {
		if (isCaptain) {
			return questions
		}
		return questions.filter((q) => q.forTeammates)
	}, [questions, isCaptain])

	// Build form schema
	const formSchema = useMemo(() => buildFormSchema(userQuestions), [userQuestions])
	type FormValues = z.infer<typeof formSchema>

	// Initialize form
	const form = useForm<FormValues>({
		resolver: standardSchemaResolver(formSchema),
		defaultValues: {},
	})

	// Populate form with existing answers
	useEffect(() => {
		const defaultValues: Record<string, string> = {}

		for (const question of userQuestions) {
			const existingAnswer = answers.find(
				(a) => a.questionId === question.id && a.userId === currentUserId,
			)
			defaultValues[question.id] = existingAnswer?.answer || ""
		}

		form.reset(defaultValues)
	}, [answers, userQuestions, currentUserId, form])

	// Handle form submission
	const onSubmit = async (values: FormValues) => {
		try {
			const answersToSubmit = Object.entries(values)
				.filter(([_, answer]) => answer !== undefined && answer !== "")
				.map(([questionId, answer]) => ({
					questionId,
					answer: answer as string,
				}))

			await submitAnswers({
				data: {
					registrationId,
					answers: answersToSubmit,
				},
			})

			toast.success("Your answers have been saved")
		} catch (error) {
			console.error("Failed to save answers:", error)
			toast.error("Failed to save your answers. Please try again.")
		}
	}

	// Don't show if no questions
	if (userQuestions.length === 0) {
		return null
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<ClipboardList className="w-5 h-5" />
					Registration Questions
				</CardTitle>
				<CardDescription>
					{isEditable
						? "Answer the following questions about your registration"
						: "Your registration question answers"}
				</CardDescription>
			</CardHeader>
			<CardContent>
				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
						{userQuestions.map((question) => (
							<FormField
								key={question.id}
								control={form.control}
								name={question.id}
								render={({ field }) => (
									<FormItem>
										<FormLabel>
											{question.label}
											{question.required && (
												<span className="text-destructive ml-1">*</span>
											)}
										</FormLabel>
										<FormControl>
											{question.type === "text" ? (
												<Input
													{...field}
													disabled={!isEditable}
													placeholder={
														isEditable ? "Enter your answer" : "No answer provided"
													}
												/>
											) : question.type === "number" ? (
												<Input
													{...field}
													type="number"
													disabled={!isEditable}
													placeholder={
														isEditable ? "Enter a number" : "No answer provided"
													}
												/>
											) : question.type === "select" && question.options ? (
												<Select
													disabled={!isEditable}
													value={field.value}
													onValueChange={field.onChange}
												>
													<SelectTrigger>
														<SelectValue
															placeholder={
																isEditable
																	? "Select an option"
																	: "No answer provided"
															}
														/>
													</SelectTrigger>
													<SelectContent>
														{question.options.map((option) => (
															<SelectItem key={option} value={option}>
																{option}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
											) : null}
										</FormControl>
										{question.helpText && (
											<FormDescription>{question.helpText}</FormDescription>
										)}
										<FormMessage />
									</FormItem>
								)}
							/>
						))}

						{isEditable && (
							<Button
								type="submit"
								disabled={form.formState.isSubmitting}
								className="w-full sm:w-auto"
							>
								{form.formState.isSubmitting && (
									<Loader2 className="w-4 h-4 mr-2 animate-spin" />
								)}
								Save Answers
							</Button>
						)}
					</form>
				</Form>
			</CardContent>
		</Card>
	)
}
