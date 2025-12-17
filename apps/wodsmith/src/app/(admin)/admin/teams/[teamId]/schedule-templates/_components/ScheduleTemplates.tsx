"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import type { inferServerActionReturnData } from "@repo/zsa"
import { useServerAction } from "@repo/zsa-react"
import { Edit, Trash2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import * as z from "zod"
import type {
	getClassCatalogByTeam,
	getLocationsByTeam,
	getSkillsByTeam,
} from "@/actions/gym-setup-actions"
import type { getScheduleTemplatesByTeam } from "@/actions/schedule-template-actions"
import {
	createScheduleTemplate,
	createScheduleTemplateClass,
	deleteScheduleTemplate,
	deleteScheduleTemplateClass,
	updateScheduleTemplate,
} from "@/actions/schedule-template-actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog"
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"

type Template = inferServerActionReturnData<
	typeof getScheduleTemplatesByTeam
>[number]
type ClassCatalog = NonNullable<
	inferServerActionReturnData<typeof getClassCatalogByTeam>["data"]
>[number]
type Location = NonNullable<
	inferServerActionReturnData<typeof getLocationsByTeam>["data"]
>[number]
type Skill = NonNullable<
	inferServerActionReturnData<typeof getSkillsByTeam>["data"]
>[number]

type Props = {
	templates: Template[]
	classCatalog: ClassCatalog[]
	locations: Location[]
	availableSkills: Skill[]
	teamId: string
	_teamSlug: string
}

const createTemplateSchema = z.object({
	name: z.string().min(1, "Name is required"),
	classCatalogId: z.string().min(1),
	locationId: z.string().min(1),
})

type CreateTemplateData = z.infer<typeof createTemplateSchema>

const createClassSchema = z.object({
	classCatalogId: z.string().min(1),
	locationId: z.string().min(1),
	dayOfWeek: z.coerce.number().min(0).max(6),
	startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
	endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
	requiredCoaches: z.coerce.number().min(1).optional(),
	requiredSkillIds: z.array(z.string()).optional(),
})

type CreateClassData = z.infer<typeof createClassSchema>

const _dayNames = [
	"Sunday",
	"Monday",
	"Tuesday",
	"Wednesday",
	"Thursday",
	"Friday",
	"Saturday",
]

const ScheduleTemplates = ({
	templates: initialTemplates,
	classCatalog,
	locations,
	availableSkills,
	teamId,
	_teamSlug,
}: Props) => {
	const router = useRouter()
	const [templates, setTemplates] = useState(initialTemplates)
	const [selectedTemplateId, _setSelectedTemplateId] = useState<string | null>(
		null,
	)
	const [editingTemplateId, setEditingTemplateId] = useState<string | null>(
		null,
	)
	const [_editingClassId, _setEditingClassId] = useState<string | null>(null)
	const [selectedSkills, setSelectedSkills] = useState<string[]>([])
	const [templateToDelete, setTemplateToDelete] = useState<string | null>(null)
	const [deletingTemplates, setDeletingTemplates] = useState<Set<string>>(
		new Set(),
	)

	// Create template form
	const createTemplateForm = useForm<CreateTemplateData>({
		resolver: zodResolver(createTemplateSchema),
		defaultValues: { name: "", classCatalogId: "", locationId: "" },
	})

	const { execute: createTemplateExec, isPending: creatingTemplate } =
		useServerAction(createScheduleTemplate)

	const onCreateTemplate = async (data: CreateTemplateData) => {
		const [res, err] = await createTemplateExec({ teamId, ...data })
		if (err || !res) return toast.error("Error creating template")
		setTemplates([...templates, { ...res, templateClasses: [] }])
		createTemplateForm.reset()
		toast.success("Template created")
		router.refresh()
	}

	// Update template form (similar, but for edit)
	const updateTemplateForm = useForm<CreateTemplateData>({
		resolver: zodResolver(createTemplateSchema),
	})

	const { execute: updateTemplateExec } = useServerAction(
		updateScheduleTemplate,
	)

	const _onUpdateTemplate = async (data: CreateTemplateData) => {
		if (!editingTemplateId) return
		const [res, err] = await updateTemplateExec({
			id: editingTemplateId,
			teamId,
			...data,
		})
		if (err) return toast.error("Error updating template")
		setTemplates(
			templates.map((t) => (t.id === editingTemplateId ? { ...t, ...res } : t)),
		)
		setEditingTemplateId(null)
		toast.success("Template updated")
		router.refresh()
	}

	// Delete template
	const { execute: deleteTemplateExec } = useServerAction(
		deleteScheduleTemplate,
	)

	const handleConfirmedDeleteTemplate = async () => {
		if (!templateToDelete) return

		setDeletingTemplates((prev) => new Set(prev).add(templateToDelete))
		const [, err] = await deleteTemplateExec({ id: templateToDelete, teamId })
		setDeletingTemplates((prev) => {
			const updated = new Set(prev)
			updated.delete(templateToDelete)
			return updated
		})
		setTemplateToDelete(null)

		if (err) {
			toast.error("Failed to delete template.")
		} else {
			setTemplates(templates.filter((t) => t.id !== templateToDelete))
			toast.success("Template deleted successfully!")
			router.refresh()
		}
	}

	// Create class form
	const createClassForm = useForm<CreateClassData>({
		resolver: zodResolver(createClassSchema),
		defaultValues: {
			classCatalogId: "",
			locationId: "",
			dayOfWeek: 1,
			startTime: "09:00",
			endTime: "10:00",
			requiredCoaches: 1,
			requiredSkillIds: [],
		},
	})

	const { execute: createClassExec } = useServerAction(
		createScheduleTemplateClass,
	)

	const _onCreateClass = async (data: CreateClassData) => {
		if (!selectedTemplateId) return
		const [res, err] = await createClassExec({
			templateId: selectedTemplateId,
			...data,
			requiredSkillIds: selectedSkills,
		})
		if (err || !res) return toast.error("Error adding class")
		const newClass = {
			...res,
			requiredSkills: selectedSkills.map((skillId) => {
				const skill = availableSkills.find((s) => s.id === skillId)
				if (!skill) {
					throw new Error(`Skill with id ${skillId} not found`)
				}
				return {
					skillId,
					templateClassId: res.id,
					skill,
				}
			}),
		}
		setTemplates(
			templates.map((t) =>
				t.id === selectedTemplateId
					? { ...t, templateClasses: [...t.templateClasses, newClass] }
					: t,
			),
		)
		createClassForm.reset()
		setSelectedSkills([])
		toast.success("Class added")
		router.refresh()
	}

	// Bulk create form

	// Similar for update class and delete class

	// For simplicity, omit update class form here, but implement similarly

	const { execute: deleteClassExec } = useServerAction(
		deleteScheduleTemplateClass,
	)
	const _onDeleteClass = async (id: string, templateId: string) => {
		const [_res, err] = await deleteClassExec({ id, templateId })
		if (err) return toast.error("Error deleting class")
		setTemplates(
			templates.map((t) =>
				t.id === templateId
					? {
							...t,
							templateClasses: t.templateClasses.filter(
								(c: Template["templateClasses"][number]) => c.id !== id,
							),
						}
					: t,
			),
		)
		toast.success("Class deleted")
		router.refresh()
	}

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>Create New Template</CardTitle>
				</CardHeader>
				<CardContent>
					<Form {...createTemplateForm}>
						<form
							onSubmit={createTemplateForm.handleSubmit(onCreateTemplate)}
							className="space-y-4"
						>
							<FormField
								control={createTemplateForm.control}
								name="name"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Name</FormLabel>
										<FormControl>
											<Input {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={createTemplateForm.control}
								name="classCatalogId"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Class Catalog</FormLabel>
										<Select
											onValueChange={field.onChange}
											value={field.value ?? ""}
										>
											<SelectTrigger>
												<SelectValue placeholder="Select a class catalog" />
											</SelectTrigger>
											<SelectContent>
												{classCatalog.map((catalog) => (
													<SelectItem key={catalog.id} value={catalog.id}>
														{catalog.name}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={createTemplateForm.control}
								name="locationId"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Location</FormLabel>
										<Select
											onValueChange={field.onChange}
											value={field.value ?? ""}
										>
											<SelectTrigger>
												<SelectValue placeholder="Select a location" />
											</SelectTrigger>
											<SelectContent>
												{locations.map((location) => (
													<SelectItem key={location.id} value={location.id}>
														{location.name}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
										<FormMessage />
									</FormItem>
								)}
							/>
							<Button type="submit" disabled={creatingTemplate}>
								Create
							</Button>
						</form>
					</Form>
				</CardContent>
			</Card>

			{/* List of templates */}
			{templates.map((template) => (
				<div
					key={template.id}
					className="flex items-center justify-between p-4 border-b"
				>
					<Link
						href={{
							pathname: `/admin/teams/schedule-templates/${template.id}`,
						}}
					>
						<span className="font-medium">{template.name}</span>
					</Link>
					<div>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => {
								setEditingTemplateId(template.id)
								updateTemplateForm.setValue("name", template.name)
							}}
						>
							<Edit className="h-4 w-4" />
						</Button>
						<Dialog
							open={templateToDelete === template.id}
							onOpenChange={(open) => {
								if (!open) setTemplateToDelete(null)
							}}
						>
							<DialogTrigger asChild>
								<Button
									variant="ghost"
									size="sm"
									onClick={() => setTemplateToDelete(template.id)}
									disabled={deletingTemplates.has(template.id)}
								>
									<Trash2 className="h-4 w-4" />
								</Button>
							</DialogTrigger>
							<DialogContent>
								<DialogHeader>
									<DialogTitle>Delete Schedule Template</DialogTitle>
									<DialogDescription>
										Are you sure you want to delete the template{" "}
										<strong>{template.name}</strong>? This will also delete all
										associated classes and cannot be undone.
									</DialogDescription>
								</DialogHeader>
								<DialogFooter>
									<Button
										variant="outline"
										onClick={() => setTemplateToDelete(null)}
									>
										Cancel
									</Button>
									<Button
										variant="destructive"
										onClick={handleConfirmedDeleteTemplate}
										disabled={deletingTemplates.has(template.id)}
									>
										{deletingTemplates.has(template.id)
											? "Deleting..."
											: "Delete"}
									</Button>
								</DialogFooter>
							</DialogContent>
						</Dialog>
					</div>
				</div>
			))}
		</div>
	)
}

export default ScheduleTemplates
