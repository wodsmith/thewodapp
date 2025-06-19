import { getOwnedTeamsAction } from "@/actions/team-actions"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import { Calendar, Settings, Users } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
	title: "Team Management",
	description: "Manage your teams",
}

export default async function AdminTeamsPage() {
	const [result] = await getOwnedTeamsAction()

	if (!result?.success) {
		return (
			<>
				<PageHeader
					items={[
						{ href: "/admin", label: "Admin" },
						{ href: "/admin/teams", label: "Teams" },
					]}
				/>
				<div className="container mx-auto px-5 py-8">
					<div className="text-center py-12">
						<p className="text-muted-foreground mb-4">
							Failed to load teams. Please try again.
						</p>
						<Button asChild>
							<Link href="/admin">Back to Admin</Link>
						</Button>
					</div>
				</div>
			</>
		)
	}

	const teams = result.data || []

	return (
		<>
			<PageHeader
				items={[
					{ href: "/admin", label: "Admin" },
					{ href: "/admin/teams", label: "Teams" },
				]}
			/>
			<div className="container mx-auto px-5 py-8">
				<div className="mb-8">
					<h1 className="text-3xl font-bold tracking-tight mb-2">
						Team Management
					</h1>
					<p className="text-muted-foreground">
						Manage the teams you own. Click on a team to access its admin
						dashboard.
					</p>
				</div>

				{teams.length === 0 ? (
					<div className="text-center py-12">
						<div className="mx-auto max-w-md">
							<div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4">
								<Users className="w-6 h-6 text-muted-foreground" />
							</div>
							<h3 className="text-lg font-semibold mb-2">No teams found</h3>
							<p className="text-muted-foreground mb-6">
								You don't own any teams yet. Create a team first to manage it
								here.
							</p>
							<Button asChild>
								<Link href="/settings/teams/create">
									Create Your First Team
								</Link>
							</Button>
						</div>
					</div>
				) : (
					<div className="flex gap-6">
						{teams.map((team) => (
							<Card
								key={team.id}
								className="hover:shadow-md transition-shadow flex flex-col"
							>
								<CardHeader className="pb-3">
									<div className="flex items-start justify-between">
										<div className="space-y-1">
											<CardTitle className="text-lg">{team.name}</CardTitle>
											{team.description && (
												<CardDescription className="line-clamp-2">
													{team.description}
												</CardDescription>
											)}
										</div>
										<Badge variant="secondary" className="ml-2">
											Owner
										</Badge>
									</div>
								</CardHeader>
								<CardContent className="pt-0 flex-1">
									<div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
										<div className="flex items-center gap-1">
											<Users className="w-4 h-4" />
											<span>Slug: {team.slug}</span>
										</div>
									</div>
								</CardContent>
								<CardFooter className="mt-auto">
									<div className="flex gap-2">
										<Button asChild className="flex-1">
											<Link
												href={`/admin/teams/${team.slug}`}
												className="flex items-center gap-2"
											>
												<Calendar className="w-4 h-4" />
												Schedule Workouts
											</Link>
										</Button>
										<Button asChild variant="outline" size="icon">
											<Link href={`/settings/teams/${team.slug}`}>
												<Settings className="w-4 h-4" />
												<span className="sr-only">Team Settings</span>
											</Link>
										</Button>
									</div>
								</CardFooter>
							</Card>
						))}
					</div>
				)}
			</div>
		</>
	)
}
