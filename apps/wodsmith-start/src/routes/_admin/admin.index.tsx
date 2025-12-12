import { createFileRoute } from '@tanstack/react-router'
import Link from '~/components/link'
import { Button } from '~/components/ui/button'
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '~/components/ui/card'

export const Route = createFileRoute('/_admin/admin/')({
	component: AdminDashboard,
})

function AdminDashboard() {
	return (
		<div className="max-w-3xl">
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

				{/* Quick Actions */}
				<Card>
					<CardHeader>
						<CardTitle>Quick Actions</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="flex flex-wrap gap-3">
							<Button asChild>
								<Link to="/admin/teams">Manage Teams</Link>
							</Button>
							<Button asChild variant="outline">
								<Link to="/admin/entitlements">Entitlements</Link>
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
