import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { ArrowLeft } from "lucide-react"
import { z } from "zod"
import { OrganizerCompetitionForm } from "@/components/organizer-competition-form"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import { getCompetitionGroupsFn } from "@/server-fns/competition-fns"

const searchSchema = z.object({
	groupId: z.string().optional(),
})

export const Route = createFileRoute("/compete/organizer/new")({
	component: NewCompetitionPage,
	validateSearch: searchSchema,
	loader: async ({ context }) => {
		const session = context.session
		const userTeams = session?.teams || []
		const selectedTeamId = userTeams[0]?.id

		if (!selectedTeamId) {
			return {
				teams: [],
				groups: [],
				selectedTeamId: null,
			}
		}

		// Fetch groups for the team
		const groupsResult = await getCompetitionGroupsFn({
			data: { teamId: selectedTeamId },
		})

		return {
			teams: userTeams,
			groups: groupsResult.groups,
			selectedTeamId,
		}
	},
})

function NewCompetitionPage() {
	const { teams, groups, selectedTeamId } = Route.useLoaderData()
	const { groupId } = Route.useSearch()
	const navigate = useNavigate()

	if (!selectedTeamId) {
		return (
			<div className="container mx-auto px-4 py-8">
				<div className="text-center py-12">
					<h1 className="text-2xl font-bold mb-4">No Team Found</h1>
					<p className="text-muted-foreground mb-6">
						You need to be part of a team to create competitions.
					</p>
				</div>
			</div>
		)
	}

	const handleSuccess = (_competitionId: string) => {
		// Navigate to organizer dashboard after successful creation
		navigate({ to: "/compete/organizer" })
	}

	const handleCancel = () => {
		// Navigate back - if we came from a series page, go back there
		if (groupId) {
			navigate({
				to: "/compete/organizer/series/$groupId",
				params: { groupId },
			})
		} else {
			navigate({ to: "/compete/organizer" })
		}
	}

	return (
		<div className="container mx-auto px-4 py-8">
			<div className="flex flex-col gap-6 max-w-2xl mx-auto">
				{/* Header */}
				<div>
					<div className="mb-4">
						<Button variant="ghost" size="sm" onClick={handleCancel}>
							<ArrowLeft className="h-4 w-4 mr-2" />
							Back
						</Button>
					</div>
					<h1 className="text-3xl font-bold">Create Competition</h1>
					<p className="text-muted-foreground mt-1">
						Set up a new competition for your team
					</p>
				</div>

				{/* Form Card */}
				<Card>
					<CardHeader>
						<CardTitle>Competition Details</CardTitle>
						<CardDescription>
							Enter the basic information for your competition
						</CardDescription>
					</CardHeader>
					<CardContent>
						<OrganizerCompetitionForm
							teams={teams}
							selectedTeamId={selectedTeamId}
							groups={groups}
							onSuccess={handleSuccess}
							onCancel={handleCancel}
						/>
					</CardContent>
				</Card>
			</div>
		</div>
	)
}
