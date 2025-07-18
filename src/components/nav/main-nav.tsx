"use server"
import { User } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import LogoutButton from "@/components/nav/logout-button"
import MobileNav from "@/components/nav/mobile-nav"
import { DarkModeToggle } from "@/components/ui/dark-mode-toggle"
import { getSessionFromCookie } from "@/utils/auth"

export default async function MainNav() {
	const session = await getSessionFromCookie()

	return (
		<header className="border-black border-b-2 bg-background p-4 dark:border-dark-border dark:bg-dark-background">
			<div className="container mx-auto flex items-center justify-between">
				<Link href="/" className="flex items-center gap-2">
					<Image
						src="/wodsmith-logo-1000.png"
						alt="wodsmith"
						width={32}
						height={32}
						className="dark:hidden"
					/>
					<Image
						src="/wodsmith-logo-1000.png"
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
								href="/workouts"
								className="font-bold text-foreground uppercase hover:underline dark:text-dark-foreground"
							>
								Workouts
							</Link>
							<Link
								href="/movements"
								className="font-bold text-foreground uppercase hover:underline dark:text-dark-foreground"
							>
								Movements
							</Link>
							<Link
								href="/log"
								className="font-bold text-foreground uppercase hover:underline dark:text-dark-foreground"
							>
								Log
							</Link>
							<Link
								href="/programming"
								className="font-bold text-foreground uppercase hover:underline dark:text-dark-foreground"
							>
								Programming
							</Link>
							<div className="mx-2 h-6 border-black border-l-2 dark:border-dark-border" />
							<Link
								href="/settings/profile"
								className="font-bold text-foreground dark:text-dark-foreground"
							>
								<User className="h-5 w-5" />
							</Link>
							<DarkModeToggle />
							<LogoutButton />
						</>
					) : (
						<div className="flex items-center gap-2">
							<Link
								href="/calculator"
								className="font-bold text-foreground uppercase hover:underline dark:text-dark-foreground"
							>
								Calculator
							</Link>
							<Link
								href="/programming"
								className="font-bold text-foreground uppercase hover:underline dark:text-dark-foreground"
							>
								Programming
							</Link>
							<Link href="/sign-in" className="btn-outline">
								Login
							</Link>
							<Link href="/sign-up" className="btn">
								Sign Up
							</Link>
							<DarkModeToggle />
						</div>
					)}
				</nav>
				<MobileNav session={session} />
			</div>
		</header>
	)
}
