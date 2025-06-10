import { TeamProgrammingSettings } from "@/components/teams/TeamProgrammingSettings"

interface PageProps {
	params: { teamId: string }
}

export default function Page({ params }: PageProps) {
	return (
		<main className="container mx-auto p-4">
			<TeamProgrammingSettings teamId={params.teamId} />
		</main>
	)
}
