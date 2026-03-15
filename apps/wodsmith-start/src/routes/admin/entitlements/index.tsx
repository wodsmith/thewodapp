import { createFileRoute, Link } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { Building2, Check, Search, Shield, User, X } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  type TeamWithEntitlement,
  getFeaturesFn,
  getTeamsWithEntitlementFn,
  toggleFeatureEntitlementFn,
} from "@/server-fns/admin-entitlement-fns"

export const Route = createFileRoute("/admin/entitlements/")({
  loader: async () => {
    const [{ features }, { teams }] = await Promise.all([
      getFeaturesFn(),
      getTeamsWithEntitlementFn({ data: { featureKey: "workout_tracking" } }),
    ])
    return { features, teams, initialFeatureKey: "workout_tracking" }
  },
  component: EntitlementsPage,
})

function EntitlementsPage() {
  const {
    features,
    teams: initialTeams,
    initialFeatureKey,
  } = Route.useLoaderData()
  const [selectedFeature, setSelectedFeature] = useState(initialFeatureKey)
  const [teams, setTeams] = useState(initialTeams)
  const [search, setSearch] = useState("")
  const [loadingFeature, setLoadingFeature] = useState(false)
  const getTeamsFn = useServerFn(getTeamsWithEntitlementFn)
  const enabledCount = teams.filter((t) => t.hasFeature).length

  const selectedFeatureInfo = features.find((f) => f.key === selectedFeature)

  const handleFeatureChange = async (featureKey: string) => {
    setSelectedFeature(featureKey)
    setLoadingFeature(true)
    try {
      const result = await getTeamsFn({ data: { featureKey } })
      setTeams(result.teams)
    } catch {
      toast.error("Failed to load teams for feature")
    } finally {
      setLoadingFeature(false)
    }
  }

  const handleToggleSuccess = async () => {
    const result = await getTeamsFn({ data: { featureKey: selectedFeature } })
    setTeams(result.teams)
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return teams
    const q = search.toLowerCase()
    return teams.filter(
      (t) =>
        t.name.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q),
    )
  }, [teams, search])

  return (
    <div className="max-w-4xl">
      <nav className="flex items-center space-x-2 text-sm text-muted-foreground mb-6">
        <Link to="/admin" className="hover:text-foreground">
          Admin
        </Link>
        <span>/</span>
        <span className="text-foreground">Entitlements</span>
      </nav>

      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Feature Entitlements</h1>
          <p className="mt-1 text-muted-foreground">
            Grant or revoke feature access per team
          </p>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Feature</CardTitle>
            <CardDescription>Select a feature to manage</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={selectedFeature} onValueChange={handleFeatureChange}>
              <SelectTrigger className="w-full md:w-80">
                <SelectValue placeholder="Select a feature..." />
              </SelectTrigger>
              <SelectContent>
                {features.map((f) => (
                  <SelectItem key={f.key} value={f.key}>
                    {f.name}
                    {f.category && (
                      <span className="text-muted-foreground ml-1">
                        ({f.category})
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Teams with Access</CardDescription>
              <CardTitle className="text-2xl">{enabledCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Teams</CardDescription>
              <CardTitle className="text-2xl">{teams.length}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              {selectedFeatureInfo?.name ?? "Feature"} Access
            </CardTitle>
            {selectedFeatureInfo?.description && (
              <CardDescription>
                {selectedFeatureInfo.description}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search teams..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            {loadingFeature ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                Loading...
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Building2 className="h-12 w-12 mb-4 opacity-50" />
                <p>
                  {search ? "No teams match your search" : "No teams found"}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Team</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-center">Members</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((team) => (
                    <TeamRow
                      key={team.id}
                      team={team}
                      featureKey={selectedFeature}
                      featureName={selectedFeatureInfo?.name ?? "Feature"}
                      onToggleSuccess={handleToggleSuccess}
                    />
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function TeamRow({
  team,
  featureKey,
  featureName,
  onToggleSuccess,
}: {
  team: TeamWithEntitlement
  featureKey: string
  featureName: string
  onToggleSuccess: () => Promise<void>
}) {
  const toggleFn = useServerFn(toggleFeatureEntitlementFn)
  const [loading, setLoading] = useState(false)

  const handleToggle = async () => {
    setLoading(true)
    try {
      await toggleFn({
        data: {
          teamId: team.id,
          featureKey,
          enabled: !team.hasFeature,
        },
      })
      toast.success(
        team.hasFeature
          ? `Revoked ${featureName} from ${team.name}`
          : `Granted ${featureName} to ${team.name}`,
      )
      await onToggleSuccess()
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : `Failed to toggle ${featureName}`,
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <TableRow>
      <TableCell>
        <Link
          to="/admin/teams/$teamId"
          params={{ teamId: team.id }}
          className="font-medium hover:underline"
        >
          {team.name}
        </Link>
        <p className="text-xs text-muted-foreground">{team.slug}</p>
      </TableCell>
      <TableCell>
        {team.isPersonalTeam ? (
          <Badge variant="secondary" className="text-xs">
            <User className="mr-1 h-3 w-3" />
            Personal
          </Badge>
        ) : (
          <Badge variant="default" className="text-xs">
            <Building2 className="mr-1 h-3 w-3" />
            {team.type === "gym" ? "Gym" : (team.type ?? "Team")}
          </Badge>
        )}
      </TableCell>
      <TableCell className="text-center">{team.memberCount}</TableCell>
      <TableCell className="text-center">
        {team.hasFeature ? (
          <Check className="mx-auto h-5 w-5 text-green-600" />
        ) : (
          <X className="mx-auto h-5 w-5 text-muted-foreground" />
        )}
      </TableCell>
      <TableCell className="text-right">
        <Button
          variant={team.hasFeature ? "outline" : "default"}
          size="sm"
          disabled={loading}
          onClick={handleToggle}
        >
          {loading ? "..." : team.hasFeature ? "Revoke" : "Grant"}
        </Button>
      </TableCell>
    </TableRow>
  )
}
