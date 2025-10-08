"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { useServerAction } from "@repo/zsa-react"
import { inviteUserAction } from "@/actions/team-membership-actions"
import { checkCanInviteMemberAction } from "@/actions/entitlements-actions"
import { Button } from "@/components/ui/button"
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog"
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, Crown, Info } from "lucide-react"
import Link from "next/link"
import type { LimitCheckResult } from "@/server/entitlements-checks"

// Define the form schema with validation
const formSchema = z.object({
	email: z
		.string()
		.email("Please enter a valid email address")
		.min(1, "Email is required"),
})

type FormValues = z.infer<typeof formSchema>

interface InviteMemberModalProps {
	teamId: string
	trigger: React.ReactNode
	onInviteSuccess?: () => void
}

export function InviteMemberModal({
	teamId,
	trigger,
	onInviteSuccess,
}: InviteMemberModalProps) {
	const [open, setOpen] = useState(false)
	const [limitCheck, setLimitCheck] = useState<LimitCheckResult | null>(null)

	// Initialize react-hook-form
	const form = useForm<FormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			email: "",
		},
	})

	const { execute: checkLimit } = useServerAction(checkCanInviteMemberAction, {
		onSuccess: (result) => {
			if (result.data) {
				setLimitCheck(result.data.data)
			}
		},
	})

	// Check limit when dialog opens
	useEffect(() => {
		if (open && teamId) {
			checkLimit({ teamId })
		}
	}, [open, teamId, checkLimit])

	const { execute } = useServerAction(inviteUserAction, {
		onError: (error) => {
			toast.dismiss()
			toast.error(error.err?.message || "Failed to invite user")
			console.error("Invite error:", error)
		},
		onStart: () => {
			toast.loading("Sending invitation...")
		},
		onSuccess: () => {
			toast.dismiss()
			toast.success("Invitation sent successfully")
			form.reset()

			if (onInviteSuccess) {
				onInviteSuccess()
			}

			// Close the modal after a short delay
			setTimeout(() => {
				setOpen(false)
			}, 1500)
		},
	})

	const onSubmit = async (data: FormValues) => {
		// Block if at limit
		if (limitCheck && !limitCheck.canCreate) {
			toast.error("You've reached your member limit. Please upgrade your plan.")
			return
		}

		execute({
			teamId,
			email: data.email,
			roleId: "member", // Default role
			isSystemRole: true,
		})
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>{trigger}</DialogTrigger>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Invite Team Member</DialogTitle>
				</DialogHeader>

				{/* Show limit warning */}
				{limitCheck && !limitCheck.canCreate && (
					<Alert variant="destructive">
						<AlertCircle className="h-4 w-4" />
						<AlertTitle>Member Limit Reached</AlertTitle>
						<AlertDescription className="mt-2 space-y-2">
							<p>{limitCheck.message}</p>
							<Button size="sm" variant="outline" asChild className="mt-2">
								<Link href="/settings/billing">
									<Crown className="h-4 w-4 mr-2" />
									Upgrade Plan
								</Link>
							</Button>
						</AlertDescription>
					</Alert>
				)}

				{/* Show usage info */}
				{limitCheck &&
					limitCheck.canCreate &&
					!limitCheck.isUnlimited &&
					limitCheck.message && (
						<Alert>
							<Info className="h-4 w-4" />
							<AlertTitle>Plan Usage</AlertTitle>
							<AlertDescription>{limitCheck.message}</AlertDescription>
						</Alert>
					)}

				<Form {...form}>
					<form
						onSubmit={form.handleSubmit(onSubmit)}
						className="space-y-4 pt-4"
					>
						<FormField
							control={form.control}
							name="email"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Email Address</FormLabel>
									<FormControl>
										<Input
											type="email"
											placeholder="colleague@example.com"
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<div className="flex justify-end gap-2 pt-2">
							<DialogClose asChild>
								<Button type="button" variant="outline">
									Cancel
								</Button>
							</DialogClose>

							<Button
								type="submit"
								disabled={limitCheck ? !limitCheck.canCreate : false}
							>
								{limitCheck && !limitCheck.canCreate
									? "Upgrade to Invite"
									: "Send Invitation"}
							</Button>
						</div>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	)
}
