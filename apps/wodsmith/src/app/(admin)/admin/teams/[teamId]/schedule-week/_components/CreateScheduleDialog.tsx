import { format } from "date-fns"
import { AlertCircle, Calendar, Clock, MapPin } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { generateScheduleAction } from "@/actions/generate-schedule-actions"
import { getScheduleTemplatesByTeam } from "@/actions/schedule-template-actions"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import type { Location } from "@/db/schemas/scheduling"

// Type for schedule template with relations from ZSA response - directly extract the success case
type ScheduleTemplateWithClasses = NonNullable<
	Awaited<ReturnType<typeof getScheduleTemplatesByTeam>>[0]
>[number]

interface CreateScheduleDialogProps {
	isOpen: boolean
	onClose: () => void
	teamId: string
	weekStartDate: Date
	locations: Location[]
	onScheduleCreated: () => void
}

const CreateScheduleDialog = ({
	isOpen,
	onClose,
	teamId,
	weekStartDate,
	locations,
	onScheduleCreated,
}: CreateScheduleDialogProps) => {
	const [templates, setTemplates] = useState<ScheduleTemplateWithClasses[]>([])
	const [selectedTemplateId, setSelectedTemplateId] = useState("")
	const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([])
	const [isLoading, setIsLoading] = useState(false)
	const [isCreating, setIsCreating] = useState(false)

	const loadTemplates = useCallback(async () => {
		setIsLoading(true)
		try {
			const [result] = await getScheduleTemplatesByTeam({ teamId })
			if (result && Array.isArray(result)) {
				setTemplates(result)
				// If there's only one template, select it by default
				if (result.length === 1 && result[0]) {
					setSelectedTemplateId(result[0].id)
				}
			}
		} catch (error) {
			console.error("Failed to load templates:", error)
			toast.error("Failed to load schedule templates")
		} finally {
			setIsLoading(false)
		}
	}, [teamId])

	useEffect(() => {
		if (isOpen) {
			loadTemplates()
		}
	}, [isOpen, loadTemplates])

	const handleCreate = async () => {
		if (!selectedTemplateId || selectedLocationIds.length === 0) {
			toast.error("Please select both a template and at least one location")
			return
		}

		setIsCreating(true)
		let successCount = 0
		let failureCount = 0

		try {
			// Create schedules for each selected location
			for (const locationId of selectedLocationIds) {
				try {
					const [result] = await generateScheduleAction({
						templateId: selectedTemplateId,
						locationId: locationId,
						weekStartDate,
						teamId,
					})

					if (result) {
						successCount++
					}
				} catch (error: unknown) {
					console.error(
						`Failed to create schedule for location ${locationId}:`,
						error,
					)
					failureCount++
					if (
						!(error instanceof Error) ||
						!error.message?.includes("already exists")
					) {
						toast.error(
							`Failed to create schedule for ${locations.find((l) => l.id === locationId)?.name || "location"}`,
						)
					}
				}
			}

			if (successCount > 0) {
				toast.success(
					`Successfully created ${successCount} schedule${successCount > 1 ? "s" : ""}!`,
				)
				onScheduleCreated()
				onClose()
			} else if (failureCount > 0) {
				toast.error("Failed to create any schedules")
			}
		} finally {
			setIsCreating(false)
		}
	}

	const toggleLocation = (locationId: string) => {
		setSelectedLocationIds((prev) =>
			prev.includes(locationId)
				? prev.filter((id) => id !== locationId)
				: [...prev, locationId],
		)
	}

	const selectedTemplate = templates.find((t) => t?.id === selectedTemplateId)
	const templateClassCount = selectedTemplate?.templateClasses?.length || 0

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle className="flex items-center space-x-2">
						<Calendar className="h-5 w-5" />
						<span>Create Weekly Schedule</span>
					</DialogTitle>
					<DialogDescription>
						Select a template and location to generate a schedule for the week
						of {format(weekStartDate, "MMM d, yyyy")}
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					{isLoading ? (
						<div className="p-4 text-center text-muted-foreground">
							Loading templates...
						</div>
					) : templates.length === 0 ? (
						<div className="rounded-lg border border-primary/20 bg-primary/10 p-4">
							<div className="flex items-start space-x-2">
								<AlertCircle className="mt-0.5 h-5 w-5 text-primary" />
								<div>
									<p className="text-sm font-medium text-primary">
										No templates found
									</p>
									<p className="mt-1 text-xs text-primary/80">
										Please create a schedule template first before generating a
										schedule.
									</p>
								</div>
							</div>
						</div>
					) : (
						<>
							{/* Template Selection */}
							<div className="space-y-2">
								<Label htmlFor="template-select">Schedule Template</Label>
								<Select
									value={selectedTemplateId}
									onValueChange={setSelectedTemplateId}
									disabled={isCreating}
								>
									<SelectTrigger id="template-select">
										<SelectValue placeholder="Choose a template..." />
									</SelectTrigger>
									<SelectContent>
										{templates.map(
											(template) =>
												template && (
													<SelectItem key={template.id} value={template.id}>
														<div className="flex items-center justify-between w-full">
															<span>{template.name}</span>
															<span className="text-xs text-slate-500 ml-2">
																{template.templateClasses?.length || 0} classes
															</span>
														</div>
													</SelectItem>
												),
										)}
									</SelectContent>
								</Select>
							</div>

							{/* Location Selection */}
							<div className="space-y-2">
								<Label>Locations</Label>
								<div className="space-y-2 max-h-48 overflow-y-auto rounded-lg border p-3">
									{locations.map((location) => (
										<div
											key={location.id}
											className="flex items-center space-x-3 rounded p-2 hover:bg-muted"
										>
											<Checkbox
												id={`location-${location.id}`}
												checked={selectedLocationIds.includes(location.id)}
												onCheckedChange={() => toggleLocation(location.id)}
												disabled={isCreating}
											/>
											<label
												htmlFor={`location-${location.id}`}
												className="flex flex-1 cursor-pointer items-center space-x-2"
											>
												<MapPin className="h-3 w-3 text-muted-foreground" />
												<span>{location.name}</span>
												{location.capacity && (
													<span className="text-xs text-muted-foreground">
														(Capacity: {location.capacity})
													</span>
												)}
											</label>
										</div>
									))}
								</div>
								{selectedLocationIds.length === 0 && (
									<p className="text-xs text-muted-foreground">
										Select one or more locations to create schedules for
									</p>
								)}
							</div>

							{/* Template Info */}
							{selectedTemplate && (
								<div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
									<div className="flex items-start space-x-2">
										<Clock className="mt-0.5 h-4 w-4 text-primary" />
										<div className="text-sm">
											<p className="font-medium text-primary">
												{selectedTemplate.name}
											</p>
											<p className="mt-1 text-xs text-primary/80">
												This template contains {templateClassCount} classes that
												will be scheduled for {selectedLocationIds.length}{" "}
												location{selectedLocationIds.length !== 1 ? "s" : ""}.
											</p>
										</div>
									</div>
								</div>
							)}
						</>
					)}
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={onClose} disabled={isCreating}>
						Cancel
					</Button>
					<Button
						onClick={handleCreate}
						disabled={
							!selectedTemplateId ||
							selectedLocationIds.length === 0 ||
							isCreating ||
							templates.length === 0
						}
					>
						{isCreating
							? "Creating..."
							: `Create ${selectedLocationIds.length} Schedule${selectedLocationIds.length !== 1 ? "s" : ""}`}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}

export default CreateScheduleDialog
