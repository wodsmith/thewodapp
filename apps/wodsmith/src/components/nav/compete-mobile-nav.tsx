"use client"

import { VisuallyHidden } from "@radix-ui/react-visually-hidden"
import { Bell, Menu, Settings, User } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useState } from "react"
import LogoutButton from "@/components/nav/logout-button"
import { Button } from "@/components/ui/button"
import {
	Sheet,
	SheetContent,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet"
import type { AthleteProfileMissingFields } from "@/server/user"
import type { SessionValidationResult } from "@/types"
import { DarkModeToggle } from "../ui/dark-mode-toggle"

interface PendingInvitation {
	id: string
	token: string
	team: {
		id: string | undefined
		name: string | undefined
		slug: string | undefined
	}
}

interface CompeteMobileNavProps {
	session: SessionValidationResult | null
	invitations?: PendingInvitation[]
	canOrganize?: boolean
	missingProfileFields?: AthleteProfileMissingFields | null
}

function formatMissingFields(
	missing: AthleteProfileMissingFields | null | undefined,
): string {
	if (!missing) return ""
	const fields: string[] = []
	if (missing.gender) fields.push("gender")
	if (missing.dateOfBirth) fields.push("date of birth")
	if (missing.affiliateName) fields.push("affiliate")
	if (fields.length === 0) return ""
	if (fields.length === 1) return `Add ${fields[0]}`
	if (fields.length === 2) return `Add ${fields[0]} & ${fields[1]}`
	return `Add ${fields.slice(0, -1).join(", ")} & ${fields[fields.length - 1]}`
}

export default function CompeteMobileNav({
	session,
	invitations = [],
	canOrganize = false,
	missingProfileFields = null,
}: CompeteMobileNavProps) {
	const [open, setOpen] = useState(false)
	const isProfileIncomplete =
		missingProfileFields &&
		(missingProfileFields.gender ||
			missingProfileFields.dateOfBirth ||
			missingProfileFields.affiliateName)
	const hasNotifications = invitations.length > 0 || isProfileIncomplete

	const handleLinkClick = () => {
		setOpen(false)
	}

	return (
		<Sheet open={open} onOpenChange={setOpen}>
			<SheetTrigger asChild>
				<Button variant="outline" size="icon" className="relative md:hidden">
					<Menu className="h-6 w-6" />
					{hasNotifications && (
						<span className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full bg-red-500" />
					)}
					<span className="sr-only">Toggle navigation menu</span>
				</Button>
			</SheetTrigger>
			<SheetContent side="left" className="bg-white dark:bg-black">
				<VisuallyHidden>
					<SheetTitle>Navigation Menu</SheetTitle>
				</VisuallyHidden>
				<nav className="grid gap-6 font-medium text-lg">
					<Link
						href="/compete"
						className="mb-4 flex items-center gap-2 font-semibold text-lg"
						onClick={handleLinkClick}
					>
						<Image
							src="/wodsmith-logo-no-text.png"
							alt="wodsmith compete"
							width={32}
							height={32}
							className="dark:hidden"
						/>
						<Image
							src="/wodsmith-logo-no-text.png"
							alt="wodsmith compete"
							width={32}
							height={32}
							className="hidden dark:block"
						/>
						<span className="text-2xl text-foreground dark:text-dark-foreground">
							<span className="font-black uppercase">WOD</span>smith{" "}
							<span className="font-medium text-muted-foreground">Compete</span>
						</span>
					</Link>
					{session?.user ? (
						<>
							<Link
								href="/compete"
								className="hover:text-primary"
								onClick={handleLinkClick}
							>
								Events
							</Link>
							{canOrganize && (
								<Link
									href="/compete/organizer"
									className="flex items-center gap-2 hover:text-primary"
									onClick={handleLinkClick}
								>
									<Settings className="h-5 w-5" />
									<span>Organizer</span>
								</Link>
							)}
							<hr className="my-2" />
							{hasNotifications && (
								<>
									<p className="font-bold text-muted-foreground text-sm uppercase">
										Notifications
									</p>
									{isProfileIncomplete && (
										<Link
											href="/compete/athlete"
											className="flex items-center gap-2 hover:text-primary"
											onClick={handleLinkClick}
										>
											<User className="h-4 w-4 text-amber-600 dark:text-amber-400" />
											<div className="flex flex-col">
												<span>Complete Your Profile</span>
												<span className="text-muted-foreground text-sm">
													{formatMissingFields(missingProfileFields)}
												</span>
											</div>
											<span className="ml-auto h-2 w-2 rounded-full bg-red-500" />
										</Link>
									)}
									{invitations.map((invitation) => (
										<Link
											key={invitation.id}
											href={`/compete/invite/${invitation.token}`}
											className="flex items-center gap-2 hover:text-primary"
											onClick={handleLinkClick}
										>
											<Bell className="h-4 w-4" />
											<div className="flex flex-col">
												<span>Team Invite</span>
												<span className="text-muted-foreground text-sm">
													{invitation.team.name}
												</span>
											</div>
											<span className="ml-auto h-2 w-2 rounded-full bg-red-500" />
										</Link>
									))}
									<hr className="my-2" />
								</>
							)}
							<Link
								href="/compete/athlete"
								className="hover:text-primary"
								onClick={handleLinkClick}
							>
								<div className="flex items-center gap-2">
									<User className="h-5 w-5" />
									<span>Profile</span>
								</div>
							</Link>
							<LogoutButton />
							<DarkModeToggle />
						</>
					) : (
						<>
							<Link
								href="/compete"
								className="hover:text-primary"
								onClick={handleLinkClick}
							>
								Events
							</Link>
							<Link
								href="/sign-in"
								className="hover:text-primary"
								onClick={handleLinkClick}
							>
								Login
							</Link>
							<Link
								href="/sign-up"
								className="hover:text-primary"
								onClick={handleLinkClick}
							>
								Sign Up
							</Link>
							<DarkModeToggle />
						</>
					)}
				</nav>
			</SheetContent>
		</Sheet>
	)
}
