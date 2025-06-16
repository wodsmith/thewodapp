import { PageHeader } from "@/components/page-header"
import { CalendarSkeleton } from "./_components/calendar-skeleton"

export default function Loading() {
	return (
		<>
			<PageHeader
				items={[
					{ href: "/admin", label: "Admin" },
					{ href: "/admin/teams", label: "Teams" },
					{ href: "#", label: "Loading..." },
				]}
			/>
			<div className="container mx-auto px-5 pb-12">
				<div className="flex justify-between items-start mb-8">
					<div>
						<h1 className="text-3xl font-bold mb-2">Team Scheduling</h1>
						<p className="text-muted-foreground">
							Loading team scheduling interface...
						</p>
					</div>
				</div>

				<div className="bg-card rounded-lg border p-6">
					<CalendarSkeleton />
				</div>
			</div>
		</>
	)
}
