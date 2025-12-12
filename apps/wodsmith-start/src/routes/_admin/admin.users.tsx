import { createFileRoute } from "@tanstack/react-router"
import { getDb } from "~/db/index.server"
import { userTable } from "~/db/schema.server"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card"

export const Route = createFileRoute("/_admin/admin/users")({
	component: AdminUsersPage,
	loader: async () => {
		const db = getDb()
		const users = await db.query.userTable.findMany({
			orderBy: [{ createdAt: "desc" }],
			limit: 100,
		})
		return { users }
	},
})

function AdminUsersPage() {
	const { users } = Route.useLoaderData()

	return (
		<div className="max-w-4xl">
			<div className="mb-8">
				<h1 className="text-3xl font-bold tracking-tight">Users Management</h1>
				<p className="text-muted-foreground mt-2">
					View and manage all users in the system
				</p>
			</div>

			{users.length === 0 ? (
				<Card>
					<CardContent className="pt-6">
						<p className="text-muted-foreground text-center">No users found</p>
					</CardContent>
				</Card>
			) : (
				<div className="space-y-4">
					{users.map((user) => (
						<Card key={user.id}>
							<CardHeader>
								<div className="flex items-start justify-between">
									<div className="flex-1">
										<CardTitle>
											{user.firstName} {user.lastName}
										</CardTitle>
										<CardDescription>{user.email}</CardDescription>
									</div>
								</div>
							</CardHeader>
							<CardContent>
								<div className="grid grid-cols-2 gap-4 text-sm">
									<div>
										<span className="text-muted-foreground">Role:</span>
										<p className="font-medium">{user.role}</p>
									</div>
									<div>
										<span className="text-muted-foreground">
											Email Verified:
										</span>
										<p className="font-medium">
											{user.emailVerified ? "Yes" : "No"}
										</p>
									</div>
									<div className="col-span-2">
										<span className="text-muted-foreground">Created:</span>
										<p className="font-medium">
											{new Date(user.createdAt).toLocaleDateString()}
										</p>
									</div>
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			)}
		</div>
	)
}
