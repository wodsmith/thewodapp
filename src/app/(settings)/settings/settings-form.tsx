"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import type * as z from "zod"
import { useServerAction } from "zsa-react"
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
import { userSettingsSchema } from "@/schemas/settings.schema"
import { useSessionStore } from "@/state/session"
import { updateUserProfileAction } from "./settings.actions"

export function SettingsForm() {
	const router = useRouter()

	const { execute: updateUserProfile } = useServerAction(
		updateUserProfileAction,
		{
			onError: (error) => {
				toast.dismiss()
				toast.error(error.err?.message)
			},
			onStart: () => {
				toast.loading("Signing you in...")
			},
			onSuccess: () => {
				toast.dismiss()
				toast.success("Signed in successfully")
				router.refresh()
			},
		},
	)

	const { session, isLoading } = useSessionStore()
	const form = useForm<z.infer<typeof userSettingsSchema>>({
		resolver: zodResolver(userSettingsSchema),
	})

	useEffect(() => {
		form.reset({
			firstName: session?.user.firstName ?? "",
			lastName: session?.user.lastName ?? "",
		})
	}, [session, form.reset])

	if (!session || isLoading) {
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

						<div className="flex justify-end">
							<Skeleton className="h-10 w-[100px]" />
						</div>
					</div>
				</CardContent>
			</Card>
		)
	}

	async function onSubmit(values: z.infer<typeof userSettingsSchema>) {
		updateUserProfile(values)
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
								<Input type="email" disabled value={session.user.email ?? ""} />
							</FormControl>
							<FormDescription>
								This is the email you use to sign in.
							</FormDescription>
							<FormMessage />
						</FormItem>

						<div className="flex justify-end">
							<Button type="submit">Save changes</Button>
						</div>
					</form>
				</Form>
			</CardContent>
		</Card>
	)
}
