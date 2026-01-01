/**
 * Admin Team Gym Setup Route
 *
 * Manages gym locations, skills, and general settings for a team.
 */

import { createFileRoute, getRouteApi } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { MapPin, Plus, Settings, Trash2 } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
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
import {
	createLocationFn,
	createSkillFn,
	deleteLocationFn,
	deleteSkillFn,
	getLocationsByTeamFn,
	getSkillsByTeamFn,
	updateTeamSettingsFn,
} from "@/server-fns/admin-gym-setup-fns"

// Get parent route API to access its loader data
const parentRoute = getRouteApi("/admin/teams/$teamId")

export const Route = createFileRoute("/admin/teams/$teamId/gym-setup/")({
	component: GymSetupPage,
	loader: async ({ params }) => {
		const [locationsResult, skillsResult] = await Promise.all([
			getLocationsByTeamFn({ data: { teamId: params.teamId } }),
			getSkillsByTeamFn({ data: { teamId: params.teamId } }),
		])

		return {
			locations: locationsResult.data ?? [],
			skills: skillsResult.data ?? [],
		}
	},
})

// Form types
interface LocationForm {
	name: string
	capacity: number
}

interface SkillForm {
	name: string
}

function GymSetupPage() {
	const { team } = parentRoute.useLoaderData()
	const { locations: initialLocations, skills: initialSkills } =
		Route.useLoaderData()
	const { teamId } = Route.useParams()

	const [locations, setLocations] = useState(initialLocations)
	const [skills, setSkills] = useState(initialSkills)

	// Parse team settings for country
	let currentSettings: { country?: string } = {}
	try {
		currentSettings = JSON.parse(team.settings || "{}")
	} catch {
		console.error("Error parsing team settings")
	}
	const [country, setCountry] = useState(
		currentSettings.country || "United States",
	)

	// Server functions
	const createLocation = useServerFn(createLocationFn)
	const deleteLocation = useServerFn(deleteLocationFn)
	const createSkill = useServerFn(createSkillFn)
	const deleteSkill = useServerFn(deleteSkillFn)
	const updateTeamSettings = useServerFn(updateTeamSettingsFn)

	// Location form
	const locationForm = useForm<LocationForm>({
		defaultValues: { name: "", capacity: 20 },
	})
	const [addLocationPending, setAddLocationPending] = useState(false)

	const handleAddLocation = async (data: LocationForm) => {
		setAddLocationPending(true)
		try {
			const result = await createLocation({
				data: { teamId, ...data },
			})
			if (result?.success && result.data) {
				setLocations([...locations, result.data])
				locationForm.reset()
				toast.success("Location added successfully")
			}
		} catch (error) {
			console.error("Error adding location:", error)
			toast.error("Failed to add location")
		} finally {
			setAddLocationPending(false)
		}
	}

	const handleDeleteLocation = async (id: string) => {
		try {
			await deleteLocation({ data: { id, teamId } })
			setLocations(locations.filter((l) => l.id !== id))
			toast.success("Location deleted successfully")
		} catch (error) {
			console.error("Error deleting location:", error)
			toast.error(
				error instanceof Error ? error.message : "Failed to delete location",
			)
		}
	}

	// Skill form
	const skillForm = useForm<SkillForm>({
		defaultValues: { name: "" },
	})
	const [addSkillPending, setAddSkillPending] = useState(false)

	const handleAddSkill = async (data: SkillForm) => {
		setAddSkillPending(true)
		try {
			const result = await createSkill({
				data: { teamId, ...data },
			})
			if (result?.success && result.data) {
				setSkills([...skills, result.data])
				skillForm.reset()
				toast.success("Skill added successfully")
			}
		} catch (error) {
			console.error("Error adding skill:", error)
			toast.error("Failed to add skill")
		} finally {
			setAddSkillPending(false)
		}
	}

	const handleDeleteSkill = async (id: string) => {
		try {
			await deleteSkill({ data: { id, teamId } })
			setSkills(skills.filter((s) => s.id !== id))
			toast.success("Skill deleted successfully")
		} catch (error) {
			console.error("Error deleting skill:", error)
			toast.error(
				error instanceof Error ? error.message : "Failed to delete skill",
			)
		}
	}

	// Country change handler
	const handleCountryChange = async (value: string) => {
		const prevCountry = country
		setCountry(value)
		try {
			const newSettings = JSON.stringify({ ...currentSettings, country: value })
			await updateTeamSettings({
				data: { teamId, settings: newSettings },
			})
			toast.success("Country updated successfully")
		} catch (error) {
			console.error("Error updating team country:", error)
			setCountry(prevCountry)
			toast.error("Failed to update country")
		}
	}

	return (
		<div className="space-y-6">
			<header>
				<div className="flex items-center space-x-3">
					<Settings className="h-6 w-6" />
					<div>
						<h2 className="text-2xl font-bold">Gym Setup</h2>
						<p className="text-sm text-muted-foreground">
							Configure your gym's locations and settings
						</p>
					</div>
				</div>
			</header>

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
									<SelectItem value="United Kingdom">United Kingdom</SelectItem>
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
										className="h-4 w-4 p-0 hover:bg-transparent"
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
			<Card>
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
		</div>
	)
}
