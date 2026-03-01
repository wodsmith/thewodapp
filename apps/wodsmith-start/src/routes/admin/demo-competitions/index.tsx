import { createFileRoute, Link, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { format } from "date-fns"
import { Loader2, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { toast } from "sonner"
import {
	deleteDemoCompetitionFn,
	type DemoCompetitionSummary,
	generateDemoCompetitionFn,
	getOrganizingTeamsFn,
	listDemoCompetitionsFn,
} from "@/server-fns/demo-competition-fns"

export const Route = createFileRoute("/admin/demo-competitions/")({
	loader: async () => {
		const [{ competitions }, { teams }] = await Promise.all([
			listDemoCompetitionsFn(),
			getOrganizingTeamsFn(),
		])
		return { competitions, teams }
	},
	component: DemoCompetitionsPage,
})

function DemoCompetitionsPage() {
	const { competitions, teams } = Route.useLoaderData()
	const router = useRouter()

	// Form state
	const [name, setName] = useState("")
	const [organizingTeamId, setOrganizingTeamId] = useState<string>("")
	const [competitionDate, setCompetitionDate] = useState("")
	const [demoTime, setDemoTime] = useState("10:00") // Default 10 AM
	const [isGenerating, setIsGenerating] = useState(false)

	// Delete dialog state
	const [deleteTarget, setDeleteTarget] =
		useState<DemoCompetitionSummary | null>(null)
	const [isDeleting, setIsDeleting] = useState(false)

	// Server functions
	const generateDemo = useServerFn(generateDemoCompetitionFn)
	const deleteDemo = useServerFn(deleteDemoCompetitionFn)

	const handleGenerate = async (e: React.FormEvent) => {
		e.preventDefault()

		if (!name || !competitionDate || !demoTime) {
			toast.error("Please fill in all required fields")
			return
		}

		setIsGenerating(true)

		try {
			const result = await generateDemo({
				data: {
					name,
					organizingTeamId: organizingTeamId || undefined,
					competitionDate,
					demoTime,
				},
			})

			toast.success(
				`Demo competition created: ${result.summary.registrationsCreated} registrations, ${result.summary.heatsCreated} heats, ${result.summary.scoresCreated} scores`,
			)

			// Clear form
			setName("")
			setOrganizingTeamId("")
			setCompetitionDate("")
			setDemoTime("10:00")

			// Refresh data
			router.invalidate()
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to create demo competition",
			)
		} finally {
			setIsGenerating(false)
		}
	}

	const handleDelete = async () => {
		if (!deleteTarget) return

		setIsDeleting(true)

		try {
			const result = await deleteDemo({
				data: { competitionId: deleteTarget.id },
			})

			toast.success(
				`Demo competition deleted: ${result.deletedEntities.users} users, ${result.deletedEntities.registrations} registrations`,
			)

			setDeleteTarget(null)
			router.invalidate()
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to delete demo competition",
			)
		} finally {
			setIsDeleting(false)
		}
	}

	return (
		<div className="max-w-4xl">
			{/* Breadcrumb */}
			<nav className="flex items-center space-x-2 text-sm text-muted-foreground mb-6">
				<Link to="/admin" className="hover:text-foreground">
					Admin
				</Link>
				<span>/</span>
				<span className="text-foreground">Demo Competitions</span>
			</nav>

			<div className="space-y-6">
				<div>
					<h1 className="text-3xl font-bold">Demo Competitions</h1>
					<p className="mt-1 text-muted-foreground">
						Generate fully-populated demo competitions for client presentations
					</p>
				</div>

				{/* Existing Demo Competitions */}
				<Card>
					<CardHeader>
						<CardTitle>Existing Demo Competitions</CardTitle>
						<CardDescription>
							Demo competitions that have been generated. Delete when no longer
							needed.
						</CardDescription>
					</CardHeader>
					<CardContent>
						{competitions.length === 0 ? (
							<p className="text-sm text-muted-foreground">
								No demo competitions found. Create one below.
							</p>
						) : (
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Name</TableHead>
										<TableHead>Dates</TableHead>
										<TableHead>Registrations</TableHead>
										<TableHead>Created</TableHead>
										<TableHead className="w-[100px]">Actions</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{competitions.map((comp) => (
										<TableRow key={comp.id}>
											<TableCell>
												<Link
													to="/compete/$slug"
													params={{ slug: comp.slug }}
													className="font-medium hover:underline"
												>
													{comp.name}
												</Link>
											</TableCell>
											<TableCell className="text-muted-foreground">
												{comp.startDate} - {comp.endDate}
											</TableCell>
											<TableCell>{comp.registrationCount}</TableCell>
											<TableCell className="text-muted-foreground">
												{format(new Date(comp.createdAt), "MMM d, yyyy")}
											</TableCell>
											<TableCell>
												<Button
													variant="ghost"
													size="sm"
													onClick={() => setDeleteTarget(comp)}
												>
													<Trash2 className="h-4 w-4 text-destructive" />
												</Button>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						)}
					</CardContent>
				</Card>

				{/* Generate New Demo Competition */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Plus className="h-5 w-5" />
							Generate New Demo Competition
						</CardTitle>
						<CardDescription>
							Creates a complete competition with 4 divisions, 3 workouts, 40
							athletes, heats, scores, and volunteers.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<form onSubmit={handleGenerate} className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="name">Competition Name *</Label>
								<Input
									id="name"
									value={name}
									onChange={(e) => setName(e.target.value)}
									placeholder="Summer Throwdown 2026"
									disabled={isGenerating}
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="organizingTeam">
									Organizing Team (optional)
								</Label>
								<Select
									value={organizingTeamId}
									onValueChange={setOrganizingTeamId}
									disabled={isGenerating}
								>
									<SelectTrigger id="organizingTeam">
										<SelectValue placeholder="Create demo team automatically" />
									</SelectTrigger>
									<SelectContent>
										{teams.map((team) => (
											<SelectItem key={team.id} value={team.id}>
												{team.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<p className="text-xs text-muted-foreground">
									Leave empty to create a new demo organizing team
								</p>
							</div>

							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label htmlFor="competitionDate">Competition Date *</Label>
									<Input
										id="competitionDate"
										type="date"
										value={competitionDate}
										onChange={(e) => setCompetitionDate(e.target.value)}
										disabled={isGenerating}
									/>
								</div>

								<div className="space-y-2">
									<Label htmlFor="demoTime">Demo Start Time *</Label>
									<Input
										id="demoTime"
										type="time"
										value={demoTime}
										onChange={(e) => setDemoTime(e.target.value)}
										disabled={isGenerating}
									/>
									<p className="text-xs text-muted-foreground">
										Event 2 will start 30 min after this time
									</p>
								</div>
							</div>

							<Button type="submit" disabled={isGenerating} className="w-full">
								{isGenerating ? (
									<>
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
										Generating...
									</>
								) : (
									<>
										<Plus className="mr-2 h-4 w-4" />
										Generate Demo Competition
									</>
								)}
							</Button>
						</form>

						{/* What gets created */}
						<div className="mt-6 border-t pt-4">
							<h4 className="text-sm font-medium mb-2">What gets created:</h4>
							<ul className="text-sm text-muted-foreground space-y-1">
								<li>
									4 Divisions: Rx Male/Female Individual ($150), Rx Male/Female
									Team of 2 ($200)
								</li>
								<li>3 Workouts with smart timing:</li>
								<ul className="ml-4 list-disc">
									<li>Event 1: Completed (in the past with scores)</li>
									<li>Event 2: Starting 30 min after demo time</li>
									<li>Event 3: Upcoming (no heats yet)</li>
								</ul>
								<li>~28 Fake athletes with registrations</li>
								<li>Heats for Event 1 with results, Event 2 ready to go</li>
								<li>Volunteer judges assigned to heats</li>
								<li>1 Liability waiver, 3 Sponsors</li>
							</ul>
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Delete Confirmation Dialog */}
			<AlertDialog
				open={!!deleteTarget}
				onOpenChange={(open) => !open && setDeleteTarget(null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete Demo Competition</AlertDialogTitle>
						<AlertDialogDescription>
							This will permanently delete "{deleteTarget?.name}" and all
							associated data including fake users, registrations, scores, and
							heats. This action cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleDelete}
							disabled={isDeleting}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							{isDeleting ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Deleting...
								</>
							) : (
								"Delete"
							)}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	)
}
