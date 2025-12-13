import { User } from "lucide-react"
import Link from "next/link"
import LogoutButton from "@/components/nav/logout-button"
import { CompeteNavBrand } from "@/components/nav/compete-nav-brand"
import CompeteMobileNav from "@/components/nav/compete-mobile-nav"
import { NotificationBell } from "@/components/nav/notification-bell"
import { DarkModeToggle } from "@/components/ui/dark-mode-toggle"
import { getPendingInvitationsForCurrentUser } from "@/server/team-members"
import {
	type AthleteProfileMissingFields,
	getAthleteProfileMissingFields,
} from "@/server/user"
import { getSessionFromCookie } from "@/utils/auth"
import { canOrganizeCompetitions } from "@/utils/get-user-organizing-teams"

export default async function CompeteNav() {
	const session = await getSessionFromCookie()

	let pendingInvitations: Awaited<
		ReturnType<typeof getPendingInvitationsForCurrentUser>
	> = []
	let canOrganize = false
	let missingProfileFields: AthleteProfileMissingFields | null = null
	if (session?.user) {
		try {
			const [invitations, organize, missing] = await Promise.all([
				getPendingInvitationsForCurrentUser(),
				canOrganizeCompetitions(),
				getAthleteProfileMissingFields(session.userId),
			])
			pendingInvitations = invitations
			canOrganize = organize
			missingProfileFields = missing
		} catch {
			// User not authenticated or error fetching invitations
		}
	}

	return (
		<header className="border-black border-b-2 bg-background p-4 dark:border-dark-border dark:bg-dark-background">
			<div className="container mx-auto flex items-center">
				<CompeteNavBrand />
				<nav className="ml-auto hidden items-center gap-4 md:flex">
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
