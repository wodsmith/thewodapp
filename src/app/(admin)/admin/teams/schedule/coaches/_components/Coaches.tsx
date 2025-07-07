"use client"
import { useState } from "react"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import { Users, Plus, Trash2, Clock, User, Mail, Phone } from "lucide-react"

const Coaches = () => {
	const [coaches, setCoaches] = useState([
		{
			id: 1,
			name: "Sarah Johnson",
			email: "sarah@gym.com",
			phone: "(555) 123-4567",
			skills: ["CrossFit Level 1", "Yoga Certified"],
			weeklyLimit: 15,
			timePreference: "Morning",
			blackoutDates: [],
		},
		{
			id: 2,
			name: "Mike Chen",
			email: "mike@gym.com",
			phone: "(555) 234-5678",
			skills: ["Olympic Lifting", "CrossFit Level 1"],
			weeklyLimit: 12,
			timePreference: "Afternoon",
			blackoutDates: [],
		},
		{
			id: 3,
			name: "Emma Davis",
			email: "emma@gym.com",
			phone: "(555) 345-6789",
			skills: ["Kids Class Certified", "Yoga Certified"],
			weeklyLimit: 10,
			timePreference: "Morning",
			blackoutDates: [],
		},
	])

	const [newCoach, setNewCoach] = useState({
		name: "",
		email: "",
		phone: "",
		skills: [] as string[],
		weeklyLimit: "",
		timePreference: "",
	})

	const availableSkills = [
		"CrossFit Level 1",
		"Yoga Certified",
		"Kids Class Certified",
		"Olympic Lifting",
		"Nutrition Coaching",
	]

	const timePreferences = ["Morning", "Afternoon", "Night"]

	const addCoach = () => {
		if (
			newCoach.name &&
			newCoach.email &&
			newCoach.weeklyLimit &&
			newCoach.timePreference
		) {
			setCoaches([
				...coaches,
				{
					id: Date.now(),
					name: newCoach.name,
					email: newCoach.email,
					phone: newCoach.phone,
					skills: newCoach.skills,
					weeklyLimit: parseInt(newCoach.weeklyLimit),
					timePreference: newCoach.timePreference,
					blackoutDates: [],
				},
			])
			setNewCoach({
				name: "",
				email: "",
				phone: "",
				skills: [],
				weeklyLimit: "",
				timePreference: "",
			})
		}
	}

	const removeCoach = (id: number) => {
		setCoaches(coaches.filter((coach) => coach.id !== id))
	}

	const addSkillToNewCoach = (skill: string) => {
		if (!newCoach.skills.includes(skill)) {
			setNewCoach({
				...newCoach,
				skills: [...newCoach.skills, skill],
			})
		}
	}

	const removeSkillFromNewCoach = (skill: string) => {
		setNewCoach({
			...newCoach,
			skills: newCoach.skills.filter((s) => s !== skill),
		})
	}

	return (
		<div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
			<header className="bg-white/80 backdrop-blur-md border-b border-white/20 sticky top-0 z-50">
				<div className="container mx-auto px-6 py-4">
					<div className="flex items-center space-x-3">
						<div className="bg-gradient-to-br from-blue-500 to-purple-600 p-2 rounded-xl">
							<Users className="h-6 w-6 text-white" />
						</div>
						<div>
							<h1 className="text-2xl font-bold text-slate-800">
								Coach Management
							</h1>
							<p className="text-sm text-slate-600">
								Manage your coaching staff and their availability
							</p>
						</div>
					</div>
				</div>
			</header>

			<main className="container mx-auto px-6 py-8">
				{/* Add New Coach */}
				<Card className="bg-white/60 backdrop-blur-sm border-white/20 mb-8">
					<CardHeader>
						<CardTitle>Add New Coach</CardTitle>
						<CardDescription>Add a new coach to your team</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
							<div>
								<Label htmlFor="coachName">Name</Label>
								<Input
									id="coachName"
									placeholder="Coach name"
									value={newCoach.name}
									onChange={(e) =>
										setNewCoach({ ...newCoach, name: e.target.value })
									}
								/>
							</div>
							<div>
								<Label htmlFor="coachEmail">Email</Label>
								<Input
									id="coachEmail"
									type="email"
									placeholder="coach@gym.com"
									value={newCoach.email}
									onChange={(e) =>
										setNewCoach({ ...newCoach, email: e.target.value })
									}
								/>
							</div>
							<div>
								<Label htmlFor="coachPhone">Phone</Label>
								<Input
									id="coachPhone"
									placeholder="(555) 123-4567"
									value={newCoach.phone}
									onChange={(e) =>
										setNewCoach({ ...newCoach, phone: e.target.value })
									}
								/>
							</div>
						</div>

						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div>
								<Label htmlFor="weeklyLimit">Weekly Class Limit</Label>
								<Input
									id="weeklyLimit"
									type="number"
									placeholder="15"
									value={newCoach.weeklyLimit}
									onChange={(e) =>
										setNewCoach({ ...newCoach, weeklyLimit: e.target.value })
									}
								/>
							</div>
							<div>
								<Label htmlFor="timePreference">Time Preference</Label>
								<Select
									value={newCoach.timePreference}
									onValueChange={(value) =>
										setNewCoach({ ...newCoach, timePreference: value })
									}
								>
									<SelectTrigger>
										<SelectValue placeholder="Select time preference" />
									</SelectTrigger>
									<SelectContent>
										{timePreferences.map((time) => (
											<SelectItem key={time} value={time}>
												{time}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</div>

						<div>
							<Label>Skills & Certifications</Label>
							<div className="flex flex-wrap gap-2 mb-2">
								{newCoach.skills.map((skill) => (
									<Badge
										key={skill}
										variant="secondary"
										className="flex items-center space-x-1"
									>
										<span>{skill}</span>
										<Button
											variant="ghost"
											size="icon"
											onClick={() => removeSkillFromNewCoach(skill)}
										>
											<Trash2 className="h-3 w-3" />
										</Button>
									</Badge>
								))}
							</div>
							<Select onValueChange={addSkillToNewCoach}>
								<SelectTrigger>
									<SelectValue placeholder="Add skill..." />
								</SelectTrigger>
								<SelectContent>
									{availableSkills
										.filter((skill) => !newCoach.skills.includes(skill))
										.map((skill) => (
											<SelectItem key={skill} value={skill}>
												{skill}
											</SelectItem>
										))}
								</SelectContent>
							</Select>
						</div>

						<Button onClick={addCoach} className="w-full md:w-auto">
							<Plus className="h-4 w-4 mr-2" />
							Add Coach
						</Button>
					</CardContent>
				</Card>

				{/* Existing Coaches */}
				<div className="grid gap-6">
					{coaches.map((coach) => (
						<Card
							key={coach.id}
							className="bg-white/60 backdrop-blur-sm border-white/20 hover:bg-white/80 transition-all duration-300"
						>
							<CardContent className="p-6">
								<div className="flex items-start justify-between">
									<div className="flex-1">
										<div className="flex items-center space-x-3 mb-4">
											<div className="bg-gradient-to-br from-blue-500 to-purple-600 p-3 rounded-full">
												<User className="h-6 w-6 text-white" />
											</div>
											<div>
												<h3 className="text-xl font-semibold text-slate-800">
													{coach.name}
												</h3>
												<div className="flex items-center space-x-4 text-sm text-slate-600">
													<div className="flex items-center space-x-1">
														<Mail className="h-3 w-3" />
														<span>{coach.email}</span>
													</div>
													{coach.phone && (
														<div className="flex items-center space-x-1">
															<Phone className="h-3 w-3" />
															<span>{coach.phone}</span>
														</div>
													)}
												</div>
											</div>
										</div>

										<div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
											<div>
												<Label className="text-sm font-medium text-slate-700 mb-2 block">
													Weekly Limit:
												</Label>
												<div className="flex items-center space-x-1 text-sm text-slate-600">
													<Clock className="h-4 w-4" />
													<span>{coach.weeklyLimit} classes per week</span>
												</div>
											</div>
											<div>
												<Label className="text-sm font-medium text-slate-700 mb-2 block">
													Time Preference:
												</Label>
												<Badge
													variant="outline"
													className="bg-gradient-to-r from-orange-100 to-pink-100"
												>
													{coach.timePreference}
												</Badge>
											</div>
										</div>

										<div>
											<Label className="text-sm font-medium text-slate-700 mb-2 block">
												Skills & Certifications:
											</Label>
											<div className="flex flex-wrap gap-2">
												{coach.skills.map((skill) => (
													<Badge key={skill} variant="secondary">
														{skill}
													</Badge>
												))}
											</div>
										</div>
									</div>

									<Button
										variant="outline"
										size="sm"
										onClick={() => removeCoach(coach.id)}
										className="text-red-600 hover:text-red-700 ml-4"
									>
										<Trash2 className="h-4 w-4" />
									</Button>
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			</main>
		</div>
	)
}

export default Coaches
