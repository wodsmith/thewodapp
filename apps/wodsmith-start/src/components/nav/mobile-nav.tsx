"use client"

import { Link } from "@tanstack/react-router"
import { Menu } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
	Sheet,
	SheetContent,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet"
import type { SessionValidationResult } from "@/types"
import { DarkModeToggle } from "./dark-mode-toggle"
import LogoutButton from "./logout-button"
import { NavTeamSwitcher } from "./nav-team-switcher"

interface MobileNavProps {
	session: SessionValidationResult
	activeTeamId: string | null
}

export default function MobileNav({ session, activeTeamId }: MobileNavProps) {
	const [open, setOpen] = useState(false)

	const handleLinkClick = () => {
		setOpen(false)
	}

	return (
		<Sheet open={open} onOpenChange={setOpen}>
			<SheetTrigger asChild>
				<Button variant="outline" size="icon" className="md:hidden">
					<Menu className="h-6 w-6" />
					<span className="sr-only">Toggle navigation menu</span>
				</Button>
			</SheetTrigger>
			<SheetContent side="left" className="bg-white dark:bg-black">
				<SheetTitle className="sr-only">Navigation Menu</SheetTitle>
				<nav className="grid gap-6 font-medium text-lg">
					<Link
						to="/"
						className="mb-4 flex items-center gap-2 font-semibold text-lg"
						onClick={handleLinkClick}
					>
						<span className="text-2xl text-foreground uppercase dark:text-dark-foreground">
							<span className="font-black uppercase">WOD</span>smith
						</span>
					</Link>
					{session?.user ? (
						<>
							{/* Team Switcher - filter out competition-related teams */}
							<div className="mb-2">
								<NavTeamSwitcher
									teams={
										session.teams?.filter(
											(t) =>
												t.type !== "competition_event" &&
												t.type !== "competition_team",
										) ?? []
									}
									activeTeamId={activeTeamId}
								/>
							</div>
							<hr className="my-2" />
							<Link
								to="/workouts"
								search={{ view: "row", q: "" }}
								className="hover:text-primary"
								onClick={handleLinkClick}
							>
								Workouts
							</Link>
							<a
								href="/log"
								className="hover:text-primary"
								onClick={handleLinkClick}
							>
								Log
							</a>
							<a
								href="/team"
								className="hover:text-primary"
								onClick={handleLinkClick}
							>
								Team
							</a>
							<a
								href="/compete"
								className="hover:text-primary"
								onClick={handleLinkClick}
							>
								Compete
							</a>
							<hr className="my-2" />
							<div className="flex items-center gap-4">
								<LogoutButton />
								<DarkModeToggle />
							</div>
						</>
					) : (
						<>
							<a
								href="/compete"
								className="hover:text-primary"
								onClick={handleLinkClick}
							>
								Compete
							</a>
							<Link
								to="/sign-in"
								search={{ redirect: "" }}
								className="hover:text-primary"
								onClick={handleLinkClick}
							>
								Login
							</Link>
							<Link
								to="/sign-up"
								search={{ redirect: "" }}
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
