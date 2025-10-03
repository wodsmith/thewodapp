import type { Metadata } from "next"
import Link from "next/link"
import { PageHeader } from "@/components/page-header"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AdminStats } from "./_components/admin-stats"

export const metadata: Metadata = {
	title: "User Management",
	description: "Manage all users",
}

export default function AdminPage() {
	return (
		<div className="max-w-3xl">
			<PageHeader items={[{ href: "/admin", label: "Admin" }]} />

			<div className="space-y-6">
				{/* Welcome Section */}
				<Card>
					<CardHeader>
						<CardTitle className="text-3xl">Admin Dashboard</CardTitle>
						<CardDescription>
							Welcome to the admin panel. Manage your platform from here.
							(placeholder UI)
						</CardDescription>
					</CardHeader>
				</Card>

				{/* Quick Stats */}
				<AdminStats />

				{/* Quick Actions */}
				<Card>
					<CardHeader>
						<CardTitle>Quick Actions</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="flex flex-wrap gap-3">
							<Button asChild>
								<Link href="/admin/teams">Manage Teams</Link>
							</Button>
							<Button variant="outline">View Reports</Button>
							<Button variant="outline">System Settings</Button>
						</div>
					</CardContent>
				</Card>

				{/* Recent Activity */}
				<Card>
					<CardHeader>
						<CardTitle>Recent Activity</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="space-y-3">
							<div className="flex items-center justify-between border rounded-lg bg-muted/50 p-3">
								<div>
									<p className="text-sm font-medium">New user registration</p>
									<p className="text-xs text-muted-foreground">
										john.doe@example.com
									</p>
								</div>
								<span className="text-xs text-muted-foreground">
									2 hours ago
								</span>
							</div>

							<div className="flex items-center justify-between border rounded-lg bg-muted/50 p-3">
								<div>
									<p className="text-sm font-medium">Team created</p>
									<p className="text-xs text-muted-foreground">
										CrossFit Downtown
									</p>
								</div>
								<span className="text-xs text-muted-foreground">
									4 hours ago
								</span>
							</div>

							<div className="flex items-center justify-between border rounded-lg bg-muted/50 p-3">
								<div>
									<p className="text-sm font-medium">Workout scheduled</p>
									<p className="text-xs text-muted-foreground">
										Morning HIIT Session
									</p>
								</div>
								<span className="text-xs text-muted-foreground">
									6 hours ago
								</span>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	)
}
