import { createFileRoute, Link } from "@tanstack/react-router"
import { AdminCompetitionsTable } from "@/components/admin/admin-competitions-table"
import { getAllCompetitionsForAdminFn } from "@/server-fns/admin-fns"

export const Route = createFileRoute("/admin/competitions/")({
	loader: async () => {
		const { competitions } = await getAllCompetitionsForAdminFn()
		return { competitions }
	},
	component: AdminCompetitionsPage,
})

function AdminCompetitionsPage() {
	const { competitions } = Route.useLoaderData()

	return (
		<div className="max-w-6xl">
			{/* Breadcrumb */}
			<nav className="flex items-center space-x-2 text-sm text-muted-foreground mb-6">
				<Link to="/admin" className="hover:text-foreground">
					Admin
				</Link>
				<span>/</span>
				<span className="text-foreground">Competitions</span>
			</nav>

			<div className="space-y-6">
				<div>
					<h1 className="text-3xl font-bold">All Competitions</h1>
					<p className="mt-1 text-muted-foreground">
						Browse and manage competitions from all organizers
					</p>
				</div>

				<AdminCompetitionsTable competitions={competitions} />
			</div>
		</div>
	)
}
