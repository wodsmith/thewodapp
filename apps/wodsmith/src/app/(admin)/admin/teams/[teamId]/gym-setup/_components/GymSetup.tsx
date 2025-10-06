"use client"
import { zodResolver } from "@hookform/resolvers/zod"
import { MapPin, Plus, Settings, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useForm } from "react-hook-form"
import * as z from "zod"
import type { inferServerActionReturnData } from "zsa"
import { useServerAction } from "zsa-react"
import type {
	getLocationsByTeam,
	getSkillsByTeam,
} from "@/actions/gym-setup-actions"
import {
	createLocation,
	createSkill,
	deleteLocation,
	deleteSkill,
} from "@/actions/gym-setup-actions"
import type { getTeamAction } from "@/actions/team-actions"
import { updateTeamAction } from "@/actions/team-actions"
import { Badge } from "@/components/ui/badge"
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

type Props = {
	locations: inferServerActionReturnData<typeof getLocationsByTeam>["data"]
	skills: inferServerActionReturnData<typeof getSkillsByTeam>["data"]
	team: inferServerActionReturnData<typeof getTeamAction>["data"]
	teamId: string
}

const GymSetup = ({
	locations: initialLocations,
	skills: initialSkills,
	team,
	teamId,
}: Props) => {
	const _router = useRouter()
	const [locations, setLocations] = useState(initialLocations)
	const [skills, setSkills] = useState(initialSkills)
	let currentSettings: { country?: string } = {}
	try {
		currentSettings = JSON.parse(team.settings || "{}")
	} catch (error) {
		console.error("Error parsing team settings:", error)
	}
	const [country, setCountry] = useState(
		currentSettings.country || "United States",
	)

	const { execute: updateTeamExecute } = useServerAction(updateTeamAction)
	const handleCountryChange = async (value: string) => {
		const prevCountry = country
		setCountry(value)
		try {
			const newSettings = JSON.stringify({ ...currentSettings, country: value })
			const [_result, err] = await updateTeamExecute({
				teamId,
				data: { settings: newSettings },
			})
			if (err) {
				console.error("Error updating team country:", err)
				setCountry(prevCountry)
				return
			}
		} catch (error) {
			console.error("Unexpected error updating team country:", error)
			setCountry(prevCountry)
		}
	}

	// Location form
	const locationSchema = z.object({
		name: z.string().min(1, "Location name cannot be empty"),
		capacity: z.coerce.number().int().min(1, "Capacity must be at least 1"),
	})
	type LocationForm = z.infer<typeof locationSchema>
	const locationForm = useForm<LocationForm>({
		resolver: zodResolver(locationSchema),
		defaultValues: { name: "", capacity: 20 },
	})
	const { execute: addLocationExecute, isPending: addLocationPending } =
		useServerAction(createLocation)
	const handleAddLocation = async (data: LocationForm) => {
		try {
			const [result, err] = await addLocationExecute({ teamId, ...data })
			if (err) {
				console.error("Error adding location:", err)
				return
			}
			if (result?.success && result.data) {
				setLocations([...locations, result.data])
				locationForm.reset()
			}
		} catch (error) {
			console.error("Unexpected error adding location:", error)
		}
	}

	const { execute: deleteLocationExecute } = useServerAction(deleteLocation)
	const handleDeleteLocation = async (id: string) => {
		try {
			const [_result, err] = await deleteLocationExecute({ id, teamId })
			if (err) {
				console.error("Error deleting location:", err)
				return
			}
			setLocations(locations.filter((l) => l.id !== id))
		} catch (error) {
			console.error("Unexpected error deleting location:", error)
		}
	}

	// Skill form
	const skillSchema = z.object({
		name: z.string().min(1, "Skill name cannot be empty"),
	})
	type SkillForm = z.infer<typeof skillSchema>
	const skillForm = useForm<SkillForm>({
		resolver: zodResolver(skillSchema),
		defaultValues: { name: "" },
	})
	const { execute: addSkillExecute, isPending: addSkillPending } =
		useServerAction(createSkill)
	const handleAddSkill = async (data: SkillForm) => {
		try {
			const [result, err] = await addSkillExecute({ teamId, ...data })
			if (err) {
				console.error("Error adding skill:", err)
				return
			}
			if (result?.success && result.data) {
				setSkills([...skills, result.data])
				skillForm.reset()
			}
		} catch (error) {
			console.error("Unexpected error adding skill:", error)
		}
	}

	const { execute: deleteSkillExecute } = useServerAction(deleteSkill)
	const handleDeleteSkill = async (id: string) => {
		try {
			const [_result, err] = await deleteSkillExecute({ id, teamId })
			if (err) {
				console.error("Error deleting skill:", err)
				return
			}
			setSkills(skills.filter((s) => s.id !== id))
		} catch (error) {
			console.error("Unexpected error deleting skill:", error)
		}
	}

	return (
		<div className="min-h-screen">
			<header className="border-b">
				<div className="container mx-auto px-6 py-4">
					<div className="flex items-center space-x-3">
						<Settings className="h-6 w-6" />
						<div>
							<h1 className="text-2xl font-bold">Gym Setup</h1>
							<p className="text-sm text-muted-foreground">
								Configure your gym's locations and settings
							</p>
						</div>
					</div>
				</div>
			</header>

			<main className="container mx-auto px-6 py-8">
				<div className="grid lg:grid-cols-2 gap-8">
					{/* General Settings */}
					<Card>
						<CardHeader>
							<CardTitle>General Settings</CardTitle>
							<CardDescription>Configure basic gym information</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div>
								<Label htmlFor="country">Country</Label>
								<Select value={country} onValueChange={handleCountryChange}>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="United States">United States</SelectItem>
										<SelectItem value="Canada">Canada</SelectItem>
										<SelectItem value="United Kingdom">
											United Kingdom
										</SelectItem>
										<SelectItem value="Australia">Australia</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</CardContent>
					</Card>

					{/* Manage Skills */}
					<Card>
						<CardHeader>
							<CardTitle>Coach Skills</CardTitle>
							<CardDescription>
								Define skills and certifications for your coaches
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<form
								onSubmit={skillForm.handleSubmit(handleAddSkill)}
								className="flex space-x-2"
							>
								<Input
									placeholder="Add new skill..."
									{...skillForm.register("name")}
								/>
								<Button type="submit" size="sm" disabled={addSkillPending}>
									<Plus className="h-4 w-4" />
								</Button>
							</form>
							<div className="flex flex-wrap gap-2">
								{skills.map((skill) => (
									<Badge
										key={skill.id}
										variant="secondary"
										className="flex items-center space-x-1"
									>
										<span>{skill.name}</span>
										<Button
											variant="ghost"
											size="icon"
											onClick={() => handleDeleteSkill(skill.id)}
										>
											<Trash2 className="h-3 w-3" />
										</Button>
									</Badge>
								))}
							</div>
						</CardContent>
					</Card>
				</div>

				{/* Manage Locations */}
				<Card className="mt-8">
					<CardHeader>
						<CardTitle className="flex items-center space-x-2">
							<MapPin className="h-5 w-5" />
							<span>Locations</span>
						</CardTitle>
						<CardDescription>Manage your gym's class locations</CardDescription>
					</CardHeader>
					<CardContent className="space-y-6">
						{/* Add New Location */}
						<form
							onSubmit={locationForm.handleSubmit(handleAddLocation)}
							className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted rounded-lg"
						>
							<div>
								<Label htmlFor="locationName">Location Name</Label>
								<Input id="locationName" {...locationForm.register("name")} />
								{locationForm.formState.errors.name && (
									<p className="text-destructive text-sm">
										{locationForm.formState.errors.name.message}
									</p>
								)}
							</div>
							<div>
								<Label htmlFor="capacity">Capacity</Label>
								<Input
									id="capacity"
									type="number"
									{...locationForm.register("capacity", {
										valueAsNumber: true,
									})}
								/>
								{locationForm.formState.errors.capacity && (
									<p className="text-destructive text-sm">
										{locationForm.formState.errors.capacity.message}
									</p>
								)}
							</div>
							<div className="flex items-end">
								<Button
									type="submit"
									disabled={addLocationPending}
									className="w-full"
								>
									<Plus className="h-4 w-4 mr-2" />
									Add Location
								</Button>
							</div>
						</form>

						{/* Existing Locations */}
						<div className="grid gap-4">
							{locations.map((location) => (
								<div
									key={location.id}
									className="flex items-center justify-between p-4 rounded-lg border"
								>
									<div className="flex items-center space-x-4">
										<MapPin className="h-4 w-4" />
										<div>
											<h3 className="font-medium">{location.name}</h3>
											<p className="text-sm text-muted-foreground">
												Capacity: {location.capacity} people
											</p>
										</div>
									</div>
									<Button
										variant="ghost"
										size="sm"
										onClick={() => handleDeleteLocation(location.id)}
									>
										<Trash2 className="h-4 w-4" />
									</Button>
								</div>
							))}
						</div>
					</CardContent>
				</Card>
			</main>
		</div>
	)
}

export default GymSetup
