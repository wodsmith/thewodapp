import { User } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import LogoutButton from "@/components/nav/logout-button"
import CompeteMobileNav from "@/components/nav/compete-mobile-nav"
import { NotificationBell } from "@/components/nav/notification-bell"
import { DarkModeToggle } from "@/components/ui/dark-mode-toggle"
import { getPendingInvitationsForCurrentUser } from "@/server/team-members"
import { getSessionFromCookie } from "@/utils/auth"
import { canOrganizeCompetitions } from "@/utils/get-user-organizing-teams"

export default async function CompeteNav() {
	const session = await getSessionFromCookie()

	let pendingInvitations: Awaited<
		ReturnType<typeof getPendingInvitationsForCurrentUser>
	> = []
	let canOrganize = false
	if (session?.user) {
		try {
			const [invitations, organize] = await Promise.all([
				getPendingInvitationsForCurrentUser(),
				canOrganizeCompetitions(),
			])
			pendingInvitations = invitations
			canOrganize = organize
		} catch {
			// User not authenticated or error fetching invitations
		}
	}

	return (
		<header className="border-black border-b-2 bg-background p-4 dark:border-dark-border dark:bg-dark-background">
			<div className="container mx-auto flex items-center justify-between">
				<Link href="/compete" className="flex items-center gap-2">
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
					<h1 className="text-2xl text-foreground dark:text-dark-foreground">
						<span className="font-black uppercase">wod</span>smith{" "}
						<span className="font-medium dark:text-amber-500 text-amber-600">
							Compete
						</span>
					</h1>
				</Link>
				<nav className="hidden items-center gap-4 md:flex">
					{session?.user ? (
						<>
							<Link
								href="/compete"
								className="font-bold text-foreground uppercase hover:underline dark:text-dark-foreground"
							>
								Events
							</Link>
							{canOrganize && (
								<>
									<div className="h-6 border-black border-l-2 dark:border-dark-border" />
									<Link
										href="/compete/organizer"
										className="flex items-center gap-1 font-bold text-foreground uppercase hover:underline dark:text-dark-foreground"
									>
										Organize
									</Link>
								</>
							)}
							<div className="mx-2 h-6 border-black border-l-2 dark:border-dark-border" />
							<Link
								href="/compete/athlete"
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
								Events
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
				<CompeteMobileNav
					session={session}
					invitations={pendingInvitations}
					canOrganize={canOrganize}
				/>
			</div>
		</header>
	)
}
