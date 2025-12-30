import {createFileRoute} from '@tanstack/react-router'
import {Settings, Wrench} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export const Route = createFileRoute('/admin/entitlements/')({
  component: EntitlementsPage,
})

function EntitlementsPage() {
  return (
    <div className="max-w-4xl">
      {/* Breadcrumb */}
      <nav className="flex items-center space-x-2 text-sm text-muted-foreground mb-6">
        <a href="/admin" className="hover:text-foreground">
          Admin
        </a>
        <span>/</span>
        <span className="text-foreground">Entitlements</span>
      </nav>

      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">
            Entitlements Management
          </h1>
          <p className="text-muted-foreground">
            Manage team plans, view usage, and add entitlement overrides for all
            teams in the system.
          </p>
        </div>

        {/* Placeholder Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              Feature Under Construction
            </CardTitle>
            <CardDescription>
              The entitlements management interface is being migrated to
              TanStack Start.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                This feature will allow you to:
              </p>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                <li>View all teams and their current plans</li>
                <li>Change team plans (Free, Pro, Enterprise)</li>
                <li>Add feature and limit overrides for specific teams</li>
                <li>View entitlement usage and history</li>
              </ul>

              <div className="pt-4 flex gap-3">
                <Button variant="outline" disabled>
                  <Settings className="mr-2 h-4 w-4" />
                  Configure Plans
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Info Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Available Plans</CardDescription>
              <CardTitle className="text-2xl">3</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Free, Pro, Enterprise
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Feature Flags</CardDescription>
              <CardTitle className="text-2xl">--</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                System-wide feature toggles
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Active Overrides</CardDescription>
              <CardTitle className="text-2xl">--</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Custom team entitlements
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
