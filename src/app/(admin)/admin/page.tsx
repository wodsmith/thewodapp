import { PageHeader } from "@/components/page-header"
import type { Metadata } from "next"
import Link from "next/link"
import { AdminStats } from "./_components/admin-stats"
import { UsersTable } from "./_components/users/users-table"

export const metadata: Metadata = {
	title: "User Management",
	description: "Manage all users",
}

export default function AdminPage() {
	return (
		<>
			<PageHeader items={[{ href: "/admin", label: "Admin" }]} />

			<div className="space-y-6">
				{/* Welcome Section */}
				<div className="border-2 border-primary bg-card p-6 shadow-[4px_4px_0px_0px] shadow-primary">
					<h1 className="text-3xl font-mono font-bold mb-2">Admin Dashboard</h1>
					<p className="text-muted-foreground font-mono">
						Welcome to the admin panel. Manage your platform from here.
						(placeholder UI)
					</p>
				</div>

				{/* Quick Stats */}
				<AdminStats />

				{/* Quick Actions */}
				<div className="border-2 border-primary bg-card p-6 shadow-[4px_4px_0px_0px] shadow-primary">
					<h2 className="text-xl font-mono font-semibold mb-4">
						Quick Actions
					</h2>
					<div className="flex flex-wrap gap-3">
						<Link
							href="/admin/teams"
							className="inline-flex items-center justify-center font-mono border-2 border-primary bg-orange px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600 shadow-[2px_2px_0px_0px] shadow-primary"
						>
							Manage Teams
						</Link>
						<button
							type="button"
							className="inline-flex items-center justify-center font-mono border-2 border-primary bg-background px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-orange hover:text-white shadow-[2px_2px_0px_0px] shadow-primary"
						>
							View Reports
						</button>
						<button
							type="button"
							className="inline-flex items-center justify-center font-mono border-2 border-primary bg-background px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-orange hover:text-white shadow-[2px_2px_0px_0px] shadow-primary"
						>
							System Settings
						</button>
					</div>
				</div>

				{/* Recent Activity */}
				<div className="border-2 border-primary bg-card p-6 shadow-[4px_4px_0px_0px] shadow-primary">
					<h2 className="text-xl font-mono font-semibold mb-4">
						Recent Activity
					</h2>
					<div className="space-y-3">
						<div className="flex items-center justify-between border-2 border-primary/20 bg-background p-3">
							<div>
								<p className="font-mono text-sm font-medium">
									New user registration
								</p>
								<p className="font-mono text-xs text-muted-foreground">
									john.doe@example.com
								</p>
							</div>
							<span className="font-mono text-xs text-muted-foreground">
								2 hours ago
							</span>
						</div>

						<div className="flex items-center justify-between border-2 border-primary/20 bg-background p-3">
							<div>
								<p className="font-mono text-sm font-medium">Team created</p>
								<p className="font-mono text-xs text-muted-foreground">
									CrossFit Downtown
								</p>
							</div>
							<span className="font-mono text-xs text-muted-foreground">
								4 hours ago
							</span>
						</div>

						<div className="flex items-center justify-between border-2 border-primary/20 bg-background p-3">
							<div>
								<p className="font-mono text-sm font-medium">
									Workout scheduled
								</p>
								<p className="font-mono text-xs text-muted-foreground">
									Morning HIIT Session
								</p>
							</div>
							<span className="font-mono text-xs text-muted-foreground">
								6 hours ago
							</span>
						</div>
					</div>
				</div>
			</div>
		</>
	)
}
