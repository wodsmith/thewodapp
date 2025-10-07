"use client"

import { VisuallyHidden } from "@radix-ui/react-visually-hidden"
import { Calendar, Menu, User } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import LogoutButton from "@/components/nav/logout-button"
import { Button } from "@/components/ui/button"
import {
	Sheet,
	SheetContent,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet"
import type { SessionValidationResult } from "@/types"
import { DarkModeToggle } from "../ui/dark-mode-toggle"

interface MobileNavProps {
	session: SessionValidationResult | null
}

export default function MobileNav({ session }: MobileNavProps) {
	const router = useRouter()
	const [open, setOpen] = useState(false)

	// Filter teams where the user is an owner
	const ownedTeams =
		session?.teams?.filter((team) => team.role.name === "owner") || []

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
				<VisuallyHidden>
					<SheetTitle>Navigation Menu</SheetTitle>
				</VisuallyHidden>
				<nav className="grid gap-6 font-medium text-lg">
					<Link
						href={session?.user ? "/workouts" : "/"}
						className="mb-4 flex items-center gap-2 font-semibold text-lg"
						onClick={handleLinkClick}
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
						<span className="text-2xl text-foreground uppercase dark:text-dark-foreground">
							<span className="font-black uppercase">WOD</span>smith
						</span>
					</Link>
					{session?.user ? (
						<>
							<Link
								href="/workouts"
								className="hover:text-primary"
								onClick={handleLinkClick}
							>
								Workouts
							</Link>
							<Link
								href="/teams"
								className="hover:text-primary"
								onClick={handleLinkClick}
							>
								Team
							</Link>
							<Link
								href="/log"
								className="hover:text-primary"
								onClick={handleLinkClick}
							>
								Log
							</Link>
							{ownedTeams.length > 0 && (
								<>
									<div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
										<Calendar className="h-4 w-4" />
										Schedule
									</div>
									{ownedTeams.map((team) => (
										<button
											type="button"
											key={team.id}
											onClick={() => {
												router.push(`/admin/teams/${team.id}`)
												handleLinkClick()
											}}
											className="ml-4 text-left hover:text-primary"
										>
											{team.name}
										</button>
									))}
								</>
							)}
							<hr className="my-2" />
							<Link
								href="/settings/profile"
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
