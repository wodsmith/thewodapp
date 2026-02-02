"use client"

import { Link } from "@tanstack/react-router"
import { User } from "lucide-react"
import CompeteMobileNav from "@/components/compete-mobile-nav"
import { CompeteNavBrand } from "@/components/compete-nav-brand"
import { DarkModeToggle } from "@/components/nav/dark-mode-toggle"
import LogoutButton from "@/components/nav/logout-button"
import type { SessionValidationResult } from "@/types"

interface CompeteNavProps {
	session: SessionValidationResult
	canOrganize: boolean
}

export default function CompeteNav({ session, canOrganize }: CompeteNavProps) {
	// For now, we don't have these other features implemented in wodsmith-start
	const pendingInvitations: never[] = []
	const missingProfileFields = null

	return (
		<header className="border-black border-b-2 bg-background dark:border-dark-border dark:bg-dark-background">
			<div className="container mx-auto flex items-center p-4">
				<CompeteNavBrand />
				<nav className="ml-auto hidden items-center gap-4 md:flex">
					{session?.user ? (
						<>
							<Link
								to="/compete"
								className="font-bold text-foreground uppercase hover:underline dark:text-dark-foreground"
							>
								Events
							</Link>
							{canOrganize && (
								<>
									<div className="h-6 border-black border-l-2 dark:border-dark-border" />
									<Link
										to="/compete/organizer"
										className="flex items-center gap-1 font-bold text-foreground uppercase hover:underline dark:text-dark-foreground"
									>
										Organize
									</Link>
								</>
							)}
							<div className="mx-2 h-6 border-black border-l-2 dark:border-dark-border" />
							<a
								href="/compete/athlete"
								className="font-bold text-foreground dark:text-dark-foreground"
							>
								<User className="h-5 w-5" />
							</a>
							<DarkModeToggle />
							<LogoutButton />
						</>
					) : (
						<div className="flex items-center gap-2">
							<Link
								to="/compete"
								className="font-bold text-foreground uppercase hover:underline dark:text-dark-foreground"
							>
								Events
							</Link>
							<Link
								to="/sign-in"
								search={{ redirect: "/compete" }}
								className="btn-outline"
							>
								Login
							</Link>
							<Link
								to="/sign-up"
								search={{ redirect: "/compete" }}
								className="btn"
							>
								Sign Up
							</Link>
							<DarkModeToggle />
						</div>
					)}
				</nav>
				<div className="ml-auto md:hidden">
					<CompeteMobileNav
						session={session}
						invitations={pendingInvitations}
						canOrganize={canOrganize}
						missingProfileFields={missingProfileFields}
					/>
				</div>
			</div>
		</header>
	)
}
