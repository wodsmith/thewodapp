import { User } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import LogoutButton from "@/components/nav/logout-button"
import MobileNav from "@/components/nav/mobile-nav"
import { ActiveTeamSwitcher } from "@/components/nav/active-team-switcher"
import { NotificationBell } from "@/components/nav/notification-bell"
import { DarkModeToggle } from "@/components/ui/dark-mode-toggle"
import { getPendingInvitationsForCurrentUser } from "@/server/team-members"
import { getActiveTeamFromCookie, getSessionFromCookie } from "@/utils/auth"

export default async function MainNav() {
	const session = await getSessionFromCookie()
	const activeTeamId = await getActiveTeamFromCookie()

	let pendingInvitations: Awaited<
		ReturnType<typeof getPendingInvitationsForCurrentUser>
	> = []
	if (session?.user) {
		try {
			pendingInvitations = await getPendingInvitationsForCurrentUser()
		} catch {
			// User not authenticated, no invitations
		}
	}

	return (
		<header className="border-black border-b-2 bg-background p-4 dark:border-dark-border dark:bg-dark-background">
			<div className="container mx-auto flex items-center justify-between">
				<Link
					href={session?.user ? "/workouts" : "/"}
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
								href="/workouts"
								className="font-bold text-foreground uppercase hover:underline dark:text-dark-foreground"
							>
								Workouts
							</Link>

							<Link
								href="/log"
								className="font-bold text-foreground uppercase hover:underline dark:text-dark-foreground"
							>
								Log
							</Link>
							<Link
								href="/teams"
								className="font-bold text-foreground uppercase hover:underline dark:text-dark-foreground"
							>
								Team
							</Link>
							<Link
								href="/compete"
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
								href="/settings/profile"
								className="font-bold text-foreground dark:text-dark-foreground"
							>
								<User className="h-5 w-5" />
							</Link>
							<NotificationBell invitations={pendingInvitations} />
							<DarkModeToggle />
							<LogoutButton />
						</>
					) : (
						<div className="flex items-center gap-2">
							<Link
								href="/compete"
								className="font-bold text-foreground uppercase hover:underline dark:text-dark-foreground"
							>
								Compete
							</Link>
							<Link
								href="/calculator"
								className="font-bold text-foreground uppercase hover:underline dark:text-dark-foreground"
							>
								Calculator
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
				<MobileNav session={session} invitations={pendingInvitations} />
			</div>
		</header>
	)
}
