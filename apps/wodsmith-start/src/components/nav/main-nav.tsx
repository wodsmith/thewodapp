"use client"

import { Link } from "@tanstack/react-router"
import { User } from "lucide-react"
import type { SessionValidationResult } from "@/types"
import { DarkModeToggle } from "./dark-mode-toggle"
import LogoutButton from "./logout-button"
import MobileNav from "./mobile-nav"
import { NavTeamSwitcher } from "./nav-team-switcher"

interface MainNavProps {
	session: SessionValidationResult
	activeTeamId: string | null
}

export default function MainNav({ session, activeTeamId }: MainNavProps) {
	// Filter teams for the switcher (exclude competition-related teams)
	const switcherTeams =
		session?.teams?.filter(
			(t) => t.type !== "competition_event" && t.type !== "competition_team",
		) ?? []

	return (
		<header className="border-b-2 border-black bg-background p-4 dark:border-dark-border dark:bg-dark-background">
			<div className="container relative mx-auto flex items-center justify-between">
				{/* Left: Logo */}
				<a
					href={session?.user ? "/workouts" : "/"}
					className="flex items-center gap-2"
				>
					<img
						src="/wodsmith-logo-no-text.png"
						alt="wodsmith"
						width={32}
						height={32}
						className="dark:hidden"
					/>
					<img
						src="/wodsmith-logo-no-text.png"
						alt="wodsmith"
						width={32}
						height={32}
						className="hidden dark:block"
					/>
					<h1 className="text-2xl text-foreground dark:text-dark-foreground">
						<span className="font-black uppercase">wod</span>smith
					</h1>
				</a>

				{/* Right: Navigation links */}
				<nav className="hidden items-center gap-4 md:flex">
					{session?.user ? (
						<>
							<Link
								to="/workouts"
								search={{ view: "row", q: "" }}
								className="font-bold text-foreground uppercase hover:underline dark:text-dark-foreground"
							>
								Workouts
							</Link>
							<a
								href="/log"
								className="font-bold text-foreground uppercase hover:underline dark:text-dark-foreground"
							>
								Log
							</a>
							<a
								href="/team"
								className="font-bold text-foreground uppercase hover:underline dark:text-dark-foreground"
							>
								Team
							</a>
							<a
								href="/compete"
								className="font-bold text-foreground uppercase hover:underline dark:text-dark-foreground"
							>
								Compete
							</a>
							{/* Divider before TeamSwitcher */}
							<div className="-mx-1 h-6 border-l-2 border-black dark:border-dark-border" />
							{/* Team Switcher - positioned between COMPETE and icon group */}
							<NavTeamSwitcher
								teams={switcherTeams}
								activeTeamId={activeTeamId}
							/>
							{/* Divider after TeamSwitcher */}
							<div className="-mx-1 h-6 border-l-2 border-black dark:border-dark-border" />
							<a
								href="/settings/profile"
								className="font-bold text-foreground dark:text-dark-foreground"
							>
								<User className="h-5 w-5" />
							</a>
							<DarkModeToggle />
							<LogoutButton />
						</>
					) : (
						<div className="flex items-center gap-2">
							<a
								href="/compete"
								className="font-bold text-foreground uppercase hover:underline dark:text-dark-foreground"
							>
								Compete
							</a>
							<Link
								to="/sign-in"
								search={{ redirect: "" }}
								className="btn-outline"
							>
								Login
							</Link>
							<Link to="/sign-up" search={{ redirect: "" }} className="btn">
								Sign Up
							</Link>
							<DarkModeToggle />
						</div>
					)}
				</nav>
				<MobileNav session={session} activeTeamId={activeTeamId} />
			</div>
		</header>
	)
}
