"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useServerAction } from "zsa-react"
import { toast } from "sonner"
import {
	Calendar,
	Clock,
	MapPin,
	Trash2,
	Plus,
	Edit,
	Users,
} from "lucide-react"
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
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
import { Textarea } from "@/components/ui/textarea"
import type { inferServerActionReturnData } from "zsa"
import type { getScheduleTemplatesByTeam } from "@/actions/schedule-template-actions"
import type {
	getClassCatalogByTeam,
	getLocationsByTeam,
	getSkillsByTeam,
} from "@/actions/gym-setup-actions"
import type { getTeamAction } from "@/actions/team-actions"
import {
	createScheduleTemplate,
	updateScheduleTemplate,
	deleteScheduleTemplate,
	createScheduleTemplateClass,
	updateScheduleTemplateClass,
	deleteScheduleTemplateClass,
	bulkCreateScheduleTemplateClasses,
} from "@/actions/schedule-template-actions"
import { Checkbox } from "@/components/ui/checkbox"
import Link from "next/link"

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
	teamSlug: string
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

const bulkCreateSchema = z.object({
	classCatalogId: z.string().min(1),
	locationId: z.string().min(1),
	cronExpressions: z.string(),
	duration: z.coerce.number().min(1).default(60),
	requiredCoaches: z.coerce.number().min(1).optional(),
	requiredSkillIds: z.array(z.string()).optional(),
})

type BulkCreateData = z.infer<typeof bulkCreateSchema>

const dayNames = [
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
	teamSlug,
}: Props) => {
	const router = useRouter()
	const [templates, setTemplates] = useState(initialTemplates)
	const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
		null,
	)
	const [editingTemplateId, setEditingTemplateId] = useState<string | null>(
		null,
	)
	const [editingClassId, setEditingClassId] = useState<string | null>(null)
	const [selectedSkills, setSelectedSkills] = useState<string[]>([])

	// Create template form
	const createTemplateForm = useForm<CreateTemplateData>({
		resolver: zodResolver(createTemplateSchema),
		defaultValues: { name: "", classCatalogId: "", locationId: "" },
	})

	const { execute: createTemplateExec, isPending: creatingTemplate } =
		useServerAction(createScheduleTemplate)

	const onCreateTemplate = async (data: CreateTemplateData) => {
		const [res, err] = await createTemplateExec({ teamId, ...data })
		if (err) return toast.error("Error creating template")
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

	const onUpdateTemplate = async (data: CreateTemplateData) => {
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

	const onDeleteTemplate = async (id: string) => {
		const [res, err] = await deleteTemplateExec({ id, teamId })
		if (err) return toast.error("Error deleting template")
		setTemplates(templates.filter((t) => t.id !== id))
		toast.success("Template deleted")
		router.refresh()
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

	const onCreateClass = async (data: CreateClassData) => {
		if (!selectedTemplateId) return
		const [res, err] = await createClassExec({
			templateId: selectedTemplateId,
			...data,
			requiredSkillIds: selectedSkills,
		})
		if (err) return toast.error("Error adding class")
		const newClass = {
			...res,
			requiredSkills: selectedSkills.map((skillId) => ({
				skillId,
				templateClassId: res.id,
				skill: availableSkills.find((s) => s.id === skillId)!,
			})),
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
	const bulkForm = useForm<BulkCreateData>({
		resolver: zodResolver(bulkCreateSchema),
		defaultValues: {
			classCatalogId: "",
			locationId: "",
			cronExpressions: "",
			duration: 60,
			requiredCoaches: 1,
			requiredSkillIds: [],
		},
	})

	const { execute: bulkExec } = useServerAction(
		bulkCreateScheduleTemplateClasses,
	)

	const onBulkCreate = async (data: BulkCreateData) => {
		if (!selectedTemplateId) return
		const cronExpressions = data.cronExpressions
			.split("\n")
			.map((s) => s.trim())
			.filter(Boolean)
		const [res, err] = await bulkExec({
			templateId: selectedTemplateId,
			...data,
			cronExpressions,
			requiredSkillIds: selectedSkills,
		})
		if (err) return toast.error("Error bulk adding classes")
		const newClasses = res.map((cls) => ({
			...cls,
			requiredSkills: selectedSkills.map((skillId) => ({
				skillId,
				templateClassId: cls.id,
				skill: availableSkills.find((s) => s.id === skillId)!,
			})),
		}))
		setTemplates(
			templates.map((t) =>
				t.id === selectedTemplateId
					? { ...t, templateClasses: [...t.templateClasses, ...newClasses] }
					: t,
			),
		)
		bulkForm.reset()
		setSelectedSkills([])
		toast.success("Classes added")
		router.refresh()
	}

	// Similar for update class and delete class

	// For simplicity, omit update class form here, but implement similarly

	const { execute: deleteClassExec } = useServerAction(
		deleteScheduleTemplateClass,
	)
	const onDeleteClass = async (id: string, templateId: string) => {
		const [res, err] = await deleteClassExec({ id, templateId })
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
											defaultValue={field.value}
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
											defaultValue={field.value}
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
							pathname: `/admin/teams/${teamId}/schedule-templates/${template.id}`,
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
						<Button
							variant="ghost"
							size="sm"
							onClick={() => onDeleteTemplate(template.id)}
						>
							<Trash2 className="h-4 w-4" />
						</Button>
					</div>
				</div>
			))}
		</div>
	)
}

export default ScheduleTemplates
