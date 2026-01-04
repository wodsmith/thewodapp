/**
 * Welcome Modal Component for Team Registration Page
 * Shown after a user accepts a team invitation and lands on the team page.
 * Displays team info and highlights next steps (waiver signing).
 */

"use client"

import { useNavigate } from "@tanstack/react-router"
import { CheckCircle, FileText, Trophy } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"

interface WelcomeModalProps {
	isOpen: boolean
	onClose: () => void
	teamName: string
	competitionName: string
	competitionSlug: string
	divisionName?: string
	hasUnsignedWaivers: boolean
}

export function WelcomeModal({
	isOpen,
	onClose,
	teamName,
	competitionName,
	competitionSlug,
	divisionName,
	hasUnsignedWaivers,
}: WelcomeModalProps) {
	const navigate = useNavigate()

	const handleViewCompetition = () => {
		onClose()
		navigate({
			to: "/compete/$slug",
			params: { slug: competitionSlug },
		})
	}

	return (
		<Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader className="text-center">
					<div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
						<CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
					</div>
					<DialogTitle className="text-2xl">Welcome to {teamName}!</DialogTitle>
					<DialogDescription className="text-base">
						You've successfully joined the team for{" "}
						<span className="font-medium text-foreground">
							{competitionName}
						</span>
						{divisionName && (
							<>
								{" "}
								in the{" "}
								<span className="font-medium text-foreground">
									{divisionName}
								</span>{" "}
								division
							</>
						)}
						.
					</DialogDescription>
				</DialogHeader>

				{hasUnsignedWaivers && (
					<div className="py-4">
						<div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900">
							<FileText className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
							<div>
								<p className="text-sm font-medium text-amber-800 dark:text-amber-200">
									Sign Competition Waivers
								</p>
								<p className="text-xs text-amber-700 dark:text-amber-300">
									Please sign the required waivers below before competing
								</p>
							</div>
						</div>
					</div>
				)}

				<DialogFooter className="flex-col gap-2 sm:flex-col">
					<Button onClick={onClose} className="w-full">
						{hasUnsignedWaivers ? "Sign Waivers" : "View Team"}
					</Button>
					<Button
						variant="outline"
						onClick={handleViewCompetition}
						className="w-full"
					>
						<Trophy className="w-4 h-4 mr-2" />
						View Competition
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
