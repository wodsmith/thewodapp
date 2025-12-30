"use client"

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema"
import { useRouter } from "@tanstack/react-router"
import { CheckCircle, Loader2 } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import {
	Form,
	FormControl,
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
import { GENDER_ENUM, type Gender } from "@/db/schemas/users"
import { AffiliateCombobox } from "./affiliate-combobox"

const profileSchema = z.object({
	gender: z.enum([GENDER_ENUM.MALE, GENDER_ENUM.FEMALE], {
		message: "Please select your gender",
	}),
	dateOfBirth: z.string().min(1, "Please enter your date of birth"),
	affiliateName: z
		.string()
		.min(1, "Please select your affiliate or Independent"),
})

type ProfileFormValues = z.infer<typeof profileSchema>

type ProfileCompletionFormProps = {
	currentGender?: Gender | null
	currentDateOfBirth?: Date | null
	currentAffiliateName?: string | null
	onSubmit: (values: {
		gender: Gender
		dateOfBirth: Date
		affiliateName: string
	}) => Promise<void>
}

export function ProfileCompletionForm({
	currentGender,
	currentDateOfBirth,
	currentAffiliateName,
	onSubmit,
}: ProfileCompletionFormProps) {
	const router = useRouter()
	const [isPending, setIsPending] = useState(false)
	const [isSuccess, setIsSuccess] = useState(false)

	const form = useForm<ProfileFormValues>({
		resolver: standardSchemaResolver(profileSchema),
		defaultValues: {
			gender: currentGender ?? undefined,
			dateOfBirth: currentDateOfBirth
				? currentDateOfBirth.toISOString().split("T")[0]
				: "",
			affiliateName: currentAffiliateName ?? "",
		},
	})

	async function handleSubmit(values: ProfileFormValues) {
		setIsPending(true)
		try {
			await onSubmit({
				gender: values.gender,
				dateOfBirth: new Date(values.dateOfBirth),
				affiliateName: values.affiliateName,
			})
			setIsSuccess(true)
			router.invalidate()
		} catch (error) {
			console.error("Failed to update profile:", error)
		} finally {
			setIsPending(false)
		}
	}

	if (isSuccess) {
		return (
			<div className="flex items-center gap-2 text-green-600 dark:text-green-400">
				<CheckCircle className="w-5 h-5" />
				<span>Profile updated!</span>
			</div>
		)
	}

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
				<div className="grid grid-cols-2 gap-4">
					<FormField
						control={form.control}
						name="gender"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Gender</FormLabel>
								<Select
									onValueChange={field.onChange}
									defaultValue={field.value}
								>
									<FormControl>
										<SelectTrigger>
											<SelectValue placeholder="Select" />
										</SelectTrigger>
									</FormControl>
									<SelectContent>
										<SelectItem value={GENDER_ENUM.MALE}>Male</SelectItem>
										<SelectItem value={GENDER_ENUM.FEMALE}>Female</SelectItem>
									</SelectContent>
								</Select>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="dateOfBirth"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Date of Birth</FormLabel>
								<FormControl>
									<Input type="date" {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
				</div>

				<FormField
					control={form.control}
					name="affiliateName"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Affiliate</FormLabel>
							<FormControl>
								<AffiliateCombobox
									value={field.value || ""}
									onChange={field.onChange}
									placeholder="Select your affiliate..."
									disabled={isPending}
								/>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				<Button type="submit" disabled={isPending} className="w-full">
					{isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
					Save Profile
				</Button>
			</form>
		</Form>
	)
}
