"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface CompetitionTabsProps {
	children: React.ReactNode
	workoutsContent: React.ReactNode
	scheduleContent: React.ReactNode
	leaderboardContent: React.ReactNode
	registerButton: React.ReactNode
}

export function CompetitionTabs({
	children,
	workoutsContent,
	scheduleContent,
	leaderboardContent,
	registerButton,
}: CompetitionTabsProps) {
	return (
		<Tabs defaultValue="details" className="w-full">
			<div className="border-b bg-background sticky top-0 z-10">
				<div className="container mx-auto">
					<div className="flex items-center justify-between">
						<TabsList className="h-auto justify-start gap-0 rounded-none bg-transparent p-0">
							<TabsTrigger
								value="details"
								className="rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-teal-500 data-[state=active]:bg-transparent data-[state=active]:shadow-none"
							>
								Event Details
							</TabsTrigger>
							<TabsTrigger
								value="workouts"
								className="rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-teal-500 data-[state=active]:bg-transparent data-[state=active]:shadow-none"
							>
								Workouts
							</TabsTrigger>
							<TabsTrigger
								value="schedule"
								className="rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-teal-500 data-[state=active]:bg-transparent data-[state=active]:shadow-none"
							>
								Schedule
							</TabsTrigger>
							<TabsTrigger
								value="leaderboard"
								className="rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-teal-500 data-[state=active]:bg-transparent data-[state=active]:shadow-none"
							>
								Leaderboard
							</TabsTrigger>
						</TabsList>
						<div className="py-2 pr-4">
							{registerButton}
						</div>
					</div>
				</div>
			</div>

			<TabsContent value="details" className="mt-0">
				{children}
			</TabsContent>

			<TabsContent value="workouts" className="mt-0">
				{workoutsContent}
			</TabsContent>

			<TabsContent value="schedule" className="mt-0">
				{scheduleContent}
			</TabsContent>

			<TabsContent value="leaderboard" className="mt-0">
				{leaderboardContent}
			</TabsContent>
		</Tabs>
	)
}
