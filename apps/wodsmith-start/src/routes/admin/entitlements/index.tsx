import { createFileRoute, Link, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { Building2, Check, Dumbbell, Search, User, X } from "lucide-react"
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
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table"
import {
	type TeamWithWorkoutTracking,
	getTeamsWithWorkoutTrackingFn,
	toggleWorkoutTrackingFn,
} from "@/server-fns/admin-entitlement-fns"

export const Route = createFileRoute("/admin/entitlements/")({
	loader: async () => {
		const result = await getTeamsWithWorkoutTrackingFn()
		return { teams: result.teams }
	},
	component: EntitlementsPage,
})

function EntitlementsPage() {
	const { teams } = Route.useLoaderData()
	const [search, setSearch] = useState("")
	const enabledCount = teams.filter((t) => t.hasWorkoutTracking).length

	const filtered = useMemo(() => {
		if (!search.trim()) return teams
		const q = search.toLowerCase()
		return teams.filter(
			(t) =>
				t.name.toLowerCase().includes(q) ||
				t.slug.toLowerCase().includes(q),
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
					<h1 className="text-3xl font-bold">Workout Tracking</h1>
					<p className="mt-1 text-muted-foreground">
						Grant or revoke workout tracking access per team
					</p>
				</div>

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
							<Dumbbell className="h-5 w-5" />
							Workout Tracking Access
						</CardTitle>
						<CardDescription>
							Teams with this entitlement can see Workouts, Log, Team,
							Dashboard, Programming, Movements, and Calculator.
						</CardDescription>
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
						{filtered.length === 0 ? (
							<div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
								<Building2 className="h-12 w-12 mb-4 opacity-50" />
								<p>{search ? "No teams match your search" : "No teams found"}</p>
							</div>
						) : (
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Team</TableHead>
										<TableHead>Type</TableHead>
										<TableHead className="text-center">Members</TableHead>
										<TableHead className="text-center">
											Workout Tracking
										</TableHead>
										<TableHead className="text-right">Action</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{filtered.map((team) => (
										<TeamRow key={team.id} team={team} />
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

function TeamRow({ team }: { team: TeamWithWorkoutTracking }) {
	const router = useRouter()
	const toggleFn = useServerFn(toggleWorkoutTrackingFn)
	const [loading, setLoading] = useState(false)

	const handleToggle = async () => {
		setLoading(true)
		try {
			await toggleFn({
				data: { teamId: team.id, enabled: !team.hasWorkoutTracking },
			})
			toast.success(
				team.hasWorkoutTracking
					? `Revoked workout tracking from ${team.name}`
					: `Granted workout tracking to ${team.name}`,
			)
			await router.invalidate()
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to toggle workout tracking",
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
				{team.hasWorkoutTracking ? (
					<Check className="mx-auto h-5 w-5 text-green-600" />
				) : (
					<X className="mx-auto h-5 w-5 text-muted-foreground" />
				)}
			</TableCell>
			<TableCell className="text-right">
				<Button
					variant={team.hasWorkoutTracking ? "outline" : "default"}
					size="sm"
					disabled={loading}
					onClick={handleToggle}
				>
					{loading
						? "..."
						: team.hasWorkoutTracking
							? "Revoke"
							: "Grant"}
				</Button>
			</TableCell>
		</TableRow>
	)
}
