"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { createFileRoute, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
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
import { Skeleton } from "@/components/ui/skeleton"
import { getUserProfileFn, updateUserProfileFn } from "@/server-fns/profile-fns"

// ============================================================================
// Schema
// ============================================================================

const userProfileSchema = z.object({
	firstName: z.string().min(2, {
		message: "First name must be at least 2 characters.",
	}),
	lastName: z.string().min(2, {
		message: "Last name must be at least 2 characters.",
	}),
	avatar: z
		.string()
		.url("Invalid avatar URL")
		.max(600, "URL is too long")
		.optional()
		.or(z.literal("")),
})

type UserProfileFormValues = z.infer<typeof userProfileSchema>

// ============================================================================
// Route Definition
// ============================================================================

export const Route = createFileRoute("/_protected/settings/profile/")({
	component: ProfileSettingsPage,
	loader: async () => {
		const result = await getUserProfileFn()
		return {
			user: result.data,
		}
	},
})

// ============================================================================
// Components
// ============================================================================

function ProfileSettingsPage() {
	const { user } = Route.useLoaderData()
	const router = useRouter()
	const updateProfile = useServerFn(updateUserProfileFn)

	const form = useForm<UserProfileFormValues>({
		resolver: zodResolver(userProfileSchema),
		defaultValues: {
			firstName: user?.firstName ?? "",
			lastName: user?.lastName ?? "",
			avatar: user?.avatar ?? "",
		},
	})

	async function onSubmit(values: UserProfileFormValues) {
		try {
			toast.loading("Updating profile...")
			await updateProfile({
				data: {
					firstName: values.firstName,
					lastName: values.lastName,
					avatar: values.avatar,
				},
			})
			toast.dismiss()
			toast.success("Profile updated successfully")
			router.invalidate()
		} catch (error) {
			toast.dismiss()
			toast.error(
				error instanceof Error ? error.message : "Failed to update profile",
			)
		}
	}

	if (!user) {
		return <ProfileSettingsSkeleton />
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Profile Settings</CardTitle>
				<CardDescription>
					Update your personal information and contact details.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
						<div className="grid gap-6 sm:grid-cols-2">
							<FormField
								control={form.control}
								name="firstName"
								render={({ field }) => (
									<FormItem>
										<FormLabel>First Name</FormLabel>
										<FormControl>
											<Input {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="lastName"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Last Name</FormLabel>
										<FormControl>
											<Input {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

						<FormItem>
							<FormLabel>Email</FormLabel>
							<FormControl>
								<Input type="email" disabled value={user.email ?? ""} />
							</FormControl>
							<FormDescription>
								This is the email you use to sign in.
							</FormDescription>
							<FormMessage />
						</FormItem>

						<FormField
							control={form.control}
							name="avatar"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Avatar URL</FormLabel>
									<FormControl>
										<Input
											{...field}
											placeholder="https://example.com/avatar.jpg"
										/>
									</FormControl>
									<FormDescription>
										Enter a URL to an image to use as your profile picture.
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>

						<div className="flex justify-end">
							<Button type="submit" disabled={form.formState.isSubmitting}>
								{form.formState.isSubmitting ? "Saving..." : "Save changes"}
							</Button>
						</div>
					</form>
				</Form>
			</CardContent>
		</Card>
	)
}

function ProfileSettingsSkeleton() {
	return (
		<Card>
			<CardHeader>
				<div className="space-y-2">
					<Skeleton className="h-8 w-[200px]" />
					<Skeleton className="h-4 w-[300px]" />
				</div>
			</CardHeader>
			<CardContent>
				<div className="space-y-6">
					<div className="grid gap-6 sm:grid-cols-2">
						<div className="space-y-2">
							<Skeleton className="h-4 w-[100px]" />
							<Skeleton className="h-10 w-full" />
						</div>
						<div className="space-y-2">
							<Skeleton className="h-4 w-[100px]" />
							<Skeleton className="h-10 w-full" />
						</div>
					</div>

					<div className="space-y-2">
						<Skeleton className="h-4 w-[100px]" />
						<Skeleton className="h-10 w-full" />
						<Skeleton className="h-4 w-[200px]" />
					</div>

					<div className="space-y-2">
						<Skeleton className="h-4 w-[100px]" />
						<Skeleton className="h-10 w-full" />
						<Skeleton className="h-4 w-[250px]" />
					</div>

					<div className="flex justify-end">
						<Skeleton className="h-10 w-[100px]" />
					</div>
				</div>
			</CardContent>
		</Card>
	)
}
