"use client"

import { VisuallyHidden } from "@radix-ui/react-visually-hidden"
import { Menu, User } from "lucide-react"
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
import type { SessionValidationResult } from "@/types"
import { DarkModeToggle } from "../ui/dark-mode-toggle"

interface CompeteMobileNavProps {
	session: SessionValidationResult | null
}

export default function CompeteMobileNav({ session }: CompeteMobileNavProps) {
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
							<hr className="my-2" />
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
