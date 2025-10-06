"use client"
import { Clock } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import { quickActions } from "./SubNav"

const Index = () => {
	const [stats] = useState({
		totalCoaches: 8,
		totalClasses: 24,
		locations: 4,
		upcomingSchedules: 3,
	})

	return (
		<main className="container mx-auto px-6 py-8">
			{/* Hero Section */}
			<div className="text-center mb-12">
				<h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-slate-800 via-blue-800 to-purple-800 bg-clip-text text-transparent">
					Automate Your Gym Scheduling
				</h2>
				<p className="text-xl text-slate-600 max-w-3xl mx-auto mb-8">
					Let AI handle the complexity of coach assignments, location conflicts,
					and skill requirements. Generate optimized schedules in seconds, not
					hours.
				</p>
			</div>

			{/* Stats Cards */}
			<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
				<Card className="bg-white/60 backdrop-blur-sm border-white/20 hover:bg-white/80 transition-all duration-300">
					<CardContent className="p-4 text-center">
						<div className="text-2xl font-bold text-blue-600">
							{stats.totalCoaches}
						</div>
						<div className="text-sm text-slate-600">Active Coaches</div>
					</CardContent>
				</Card>
				<Card className="bg-white/60 backdrop-blur-sm border-white/20 hover:bg-white/80 transition-all duration-300">
					<CardContent className="p-4 text-center">
						<div className="text-2xl font-bold text-purple-600">
							{stats.totalClasses}
						</div>
						<div className="text-sm text-slate-600">Weekly Classes</div>
					</CardContent>
				</Card>
				<Card className="bg-white/60 backdrop-blur-sm border-white/20 hover:bg-white/80 transition-all duration-300">
					<CardContent className="p-4 text-center">
						<div className="text-2xl font-bold text-teal-600">
							{stats.locations}
						</div>
						<div className="text-sm text-slate-600">Locations</div>
					</CardContent>
				</Card>
				<Card className="bg-white/60 backdrop-blur-sm border-white/20 hover:bg-white/80 transition-all duration-300">
					<CardContent className="p-4 text-center">
						<div className="text-2xl font-bold text-orange-600">
							{stats.upcomingSchedules}
						</div>
						<div className="text-sm text-slate-600">Pending Schedules</div>
					</CardContent>
				</Card>
			</div>

			{/* Quick Actions */}
			<div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
				{quickActions
					.filter((action) => action.title !== "Dashboard")
					.map((action) => (
						<Link
							key={`tile-${action.title}`}
							href={action.href}
							className="group"
						>
							<Card className="h-full bg-white/60 backdrop-blur-sm border-white/20 hover:bg-white/80 hover:shadow-xl transition-all duration-300 group-hover:scale-105">
								<CardContent className="p-6">
									<div
										className={`p-3 rounded-xl mb-4 w-fit group-hover:scale-110 transition-transform duration-300`}
									>
										<action.icon className={`h-6 w-6`} />
									</div>
									<h3 className="text-lg font-semibold text-slate-800 mb-2">
										{action.title}
									</h3>
								</CardContent>
							</Card>
						</Link>
					))}
			</div>

			{/* Recent Activity */}
			<Card className="bg-white/60 backdrop-blur-sm border-white/20">
				<CardHeader>
					<CardTitle className="flex items-center space-x-2">
						<Clock className="h-5 w-5 text-slate-600" />
						<span>Recent Activity</span>
					</CardTitle>
					<CardDescription>Latest updates and schedule changes</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="space-y-4">
						{[
							{
								action: "Schedule generated",
								time: "2 hours ago",
								status: "success",
							},
							{
								action: "Coach availability updated",
								time: "4 hours ago",
								status: "info",
							},
							{
								action: "New class added to catalog",
								time: "1 day ago",
								status: "success",
							},
							{
								action: "Location conflict resolved",
								time: "2 days ago",
								status: "warning",
							},
						].map((item) => (
							<div
								key={item.action}
								className="flex items-center justify-between py-2 border-b border-slate-200 last:border-b-0"
							>
								<div className="flex items-center space-x-3">
									<Badge
										variant={
											item.status === "success"
												? "default"
												: item.status === "warning"
													? "destructive"
													: "secondary"
										}
										className="w-2 h-2 p-0 rounded-full"
									/>
									<span className="text-sm text-slate-700">{item.action}</span>
								</div>
								<span className="text-xs text-slate-500">{item.time}</span>
							</div>
						))}
					</div>
				</CardContent>
			</Card>
		</main>
	)
}

export default Index
