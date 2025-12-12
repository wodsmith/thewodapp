"use client"

/**
 * Main Navigation Component
 * TODO: Data should be loaded in route loader and passed as props
 */

import { User } from "lucide-react"
import { Link } from "@tanstack/react-router"
import LogoutButton from "~/components/nav/logout-button"
import MobileNav from "~/components/nav/mobile-nav"
import { ActiveTeamSwitcher } from "~/components/nav/active-team-switcher"
import { NotificationBell } from "~/components/nav/notification-bell"
import { DarkModeToggle } from "~/components/ui/dark-mode-toggle"
import type { AthleteProfileMissingFields } from "~/server/user"
import type { Session, Team } from "~/db/schema"

// Placeholder Image component until proper one is implemented
function Image({
	src,
	alt,
	width,
	height,
	className,
}: {
	src: string
	alt: string
	width: number
	height: number
	className?: string
}) {
	return (
		<img
			src={src}
			alt={alt}
			width={width}
			height={height}
			className={className}
		/>
	)
}

interface PendingInvitation {
	id: string
	teamId: string
	teamName: string
}

export interface MainNavProps {
	session?: {
		user?: { id: string; email: string }
		userId: string
		teams?: Team[]
	} | null
	activeTeamId?: string | null
	pendingInvitations?: PendingInvitation[]
	missingProfileFields?: AthleteProfileMissingFields | null
}

export default function MainNav({
	session,
	activeTeamId,
	pendingInvitations = [],
	missingProfileFields = null,
}: MainNavProps) {
	return (
		<header className="border-black border-b-2 bg-background p-4 dark:border-dark-border dark:bg-dark-background">
			<div className="container mx-auto flex items-center justify-between">
				<Link
					to={session?.user ? "/workouts" : "/"}
					className="flex items-center gap-2"
				>
					<Image
						src="/wodsmith-logo-no-text.png"
						alt="wodsmith"
						width={32}
						height={32}
						className="dark:hidden"
					/>
					<Image
						src="/wodsmith-logo-no-text.png"
						alt="wodsmith"
						width={32}
						height={32}
						className="hidden dark:block"
					/>
					<h1 className="text-2xl text-foreground dark:text-dark-foreground">
						<span className="font-black uppercase">wod</span>smith
					</h1>
				</Link>
				<nav className="hidden items-center gap-4 md:flex">
					{session?.user ? (
						<>
							<Link
								to="/workouts"
								className="font-bold text-foreground uppercase hover:underline dark:text-dark-foreground"
							>
								Workouts
							</Link>

							<Link
								to="/log"
								className="font-bold text-foreground uppercase hover:underline dark:text-dark-foreground"
							>
								Log
							</Link>
							<Link
								to="/teams"
								className="font-bold text-foreground uppercase hover:underline dark:text-dark-foreground"
							>
								Team
							</Link>
							<Link
								to="/compete"
								className="font-bold text-foreground uppercase hover:underline dark:text-dark-foreground"
							>
								Compete
							</Link>
							<div className="mx-2 h-6 border-black border-l-2 dark:border-dark-border" />
							{session.teams && session.teams.length > 0 && (
								<ActiveTeamSwitcher
									teams={session.teams.filter(
										(team) =>
											team.type !== "competition_event" &&
											team.type !== "competition_team",
									)}
									activeTeamId={activeTeamId}
								/>
							)}
							<Link
								to="/settings/profile"
								className="font-bold text-foreground dark:text-dark-foreground"
							>
								<User className="h-5 w-5" />
							</Link>
							<NotificationBell
								invitations={pendingInvitations}
								missingProfileFields={missingProfileFields}
							/>
							<DarkModeToggle />
							<LogoutButton />
						</>
					) : (
						<div className="flex items-center gap-2">
							<Link
								to="/compete"
								className="font-bold text-foreground uppercase hover:underline dark:text-dark-foreground"
							>
								Compete
							</Link>
							<Link
								to="/calculator"
								className="font-bold text-foreground uppercase hover:underline dark:text-dark-foreground"
							>
								Calculator
							</Link>
							<Link to="/sign-in" className="btn-outline">
								Login
							</Link>
							<Link to="/sign-up" className="btn">
								Sign Up
							</Link>
							<DarkModeToggle />
						</div>
					)}
				</nav>
				<MobileNav
					session={session}
					invitations={pendingInvitations}
					missingProfileFields={missingProfileFields}
				/>
			</div>
		</header>
	)
}
