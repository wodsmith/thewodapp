import {createFileRoute} from '@tanstack/react-router'
import {ClipboardList, Settings, Trophy, Users} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export const Route = createFileRoute('/admin/')({
  component: AdminDashboardPage,
})

function AdminDashboardPage() {
  return (
    <div className="max-w-3xl">
      {/* Breadcrumb */}
      <nav className="flex items-center space-x-2 text-sm text-muted-foreground mb-6">
        <span className="text-foreground">Admin</span>
      </nav>

      <div className="space-y-6">
        {/* Welcome Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">Admin Dashboard</CardTitle>
            <CardDescription>
              Welcome to the admin panel. Manage your platform from here.
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Quick Stats Placeholder */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Teams</CardDescription>
              <CardTitle className="text-2xl">--</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Pending Requests</CardDescription>
              <CardTitle className="text-2xl">--</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Active Competitions</CardDescription>
              <CardTitle className="text-2xl">--</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <a href="/admin/competitions">
                  <Trophy className="mr-2 h-4 w-4" />
                  Manage Competitions
                </a>
              </Button>
              <Button asChild variant="outline">
                <a href="/admin/entitlements">
                  <Settings className="mr-2 h-4 w-4" />
                  Entitlements
                </a>
              </Button>
              <Button asChild variant="outline">
                <a href="/admin/organizer-requests">
                  <ClipboardList className="mr-2 h-4 w-4" />
                  Organizer Requests
                </a>
              </Button>
              <Button variant="outline" disabled>
                <Users className="mr-2 h-4 w-4" />
                View Reports
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity Placeholder */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between border rounded-lg bg-muted/50 p-3">
                <div>
                  <p className="text-sm font-medium">Activity tracking</p>
                  <p className="text-xs text-muted-foreground">
                    Coming soon...
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">--</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
