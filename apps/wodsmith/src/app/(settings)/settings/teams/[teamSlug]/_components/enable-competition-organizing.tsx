"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Trophy, CheckCircle, Loader2 } from "lucide-react"
import { useServerAction } from "@repo/zsa-react"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import { enableCompetitionOrganizingAction } from "@/actions/entitlements-actions"
import { toast } from "sonner"

interface EnableCompetitionOrganizingProps {
	teamId: string
	isEnabled: boolean
}

export function EnableCompetitionOrganizing({
	teamId,
	isEnabled,
}: EnableCompetitionOrganizingProps) {
	const router = useRouter()
	const [enabled, setEnabled] = useState(isEnabled)

	const { execute, isPending } = useServerAction(
		enableCompetitionOrganizingAction,
		{
			onSuccess: () => {
				setEnabled(true)
				toast.success("Competition organizing enabled!")
				router.refresh()
			},
			onError: ({ err }) => {
				toast.error(err.message || "Failed to enable competition organizing")
			},
		},
	)

	const handleEnable = () => {
		execute({ teamId })
	}

	if (enabled) {
		return (
			<Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20">
				<CardHeader>
					<div className="flex items-center gap-3">
						<CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
						<div>
							<CardTitle className="text-lg">
								Competition Organizing Enabled
							</CardTitle>
							<CardDescription>
								This team can create and manage competitions
							</CardDescription>
						</div>
					</div>
				</CardHeader>
				<CardContent>
					<Button asChild variant="outline">
						<a href="/compete/organizer">Go to Organizer Dashboard</a>
					</Button>
				</CardContent>
			</Card>
		)
	}

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center gap-3">
					<Trophy className="h-6 w-6 text-muted-foreground" />
					<div>
						<CardTitle className="text-lg">Competition Organizing</CardTitle>
						<CardDescription>
							Enable this team to create and manage CrossFit competitions
						</CardDescription>
					</div>
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				<p className="text-sm text-muted-foreground">
					Competition organizing allows you to:
				</p>
				<ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
					<li>Create and publish competitions</li>
					<li>Manage athlete registrations</li>
					<li>Set up divisions and events</li>
					<li>Accept payments for entry fees</li>
				</ul>
				<Button onClick={handleEnable} disabled={isPending}>
					{isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
					Enable Competition Organizing
				</Button>
			</CardContent>
		</Card>
	)
}
