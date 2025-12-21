"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useServerAction } from "@repo/zsa-react"
import { CheckCircle, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { updateAthleteProfileAction } from "@/app/(settings)/settings/settings.actions"
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
import { AffiliateCombobox } from "../../_components/affiliate-combobox"

const profileSchema = z.object({
	gender: z.enum([GENDER_ENUM.MALE, GENDER_ENUM.FEMALE], {
		required_error: "Please select your gender",
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
}

export function ProfileCompletionForm({
	currentGender,
	currentDateOfBirth,
	currentAffiliateName,
}: ProfileCompletionFormProps) {
	const router = useRouter()
	const { execute, isPending, isSuccess } = useServerAction(
		updateAthleteProfileAction,
	)

	const form = useForm<ProfileFormValues>({
		resolver: zodResolver(profileSchema),
		defaultValues: {
			gender: currentGender ?? undefined,
			dateOfBirth: currentDateOfBirth
				? currentDateOfBirth.toISOString().split("T")[0]
				: "",
			affiliateName: currentAffiliateName ?? "",
		},
	})

	async function onSubmit(values: ProfileFormValues) {
		const [, error] = await execute({
			gender: values.gender,
			dateOfBirth: new Date(values.dateOfBirth),
			affiliateName: values.affiliateName,
		})

		if (!error) {
			router.refresh()
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
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
