"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useServerAction } from "zsa-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { Checkbox } from "@/components/ui/checkbox"
import { Edit, Trash2 } from "lucide-react"
import type { inferServerActionReturnData } from "zsa"
import {
	createScheduleTemplateClass,
	updateScheduleTemplateClass,
	deleteScheduleTemplateClass,
	type getScheduleTemplateById,
} from "@/actions/schedule-template-actions"
import type {
	getClassCatalogByTeam,
	getLocationsByTeam,
	getSkillsByTeam,
} from "@/actions/gym-setup-actions"

type BaseClassType = NonNullable<
	inferServerActionReturnData<typeof createScheduleTemplateClass>
>
interface ExtendedClassType extends BaseClassType {
	requiredSkills: {
		skillId: string
		templateClassId: string
		skill: { id: string; name: string }
	}[]
}
// Assume Skill type
interface Skill {
	id: string
	name: string
}

const createClassSchema = z.object({
	classCatalogId: z.string().min(1),
	locationId: z.string().min(1),
	dayOfWeek: z.coerce.number().min(0).max(6),
	startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
	endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
	requiredCoaches: z.coerce.number().min(1).optional(),
})

type CreateClassData = z.infer<typeof createClassSchema>

const bulkCreateSchema = z.object({
	classCatalogId: z.string().min(1),
	locationId: z.string().min(1),
	cronExpressions: z.string(),
	duration: z.coerce.number().min(1).default(60),
	requiredCoaches: z.coerce.number().min(1).optional(),
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

export default function ScheduleTemplateDetails({
	template,
	classCatalog,
	locations,
	availableSkills,
	teamId,
}: {
	template: inferServerActionReturnData<typeof getScheduleTemplateById>
	classCatalog: inferServerActionReturnData<
		typeof getClassCatalogByTeam
	>["data"]
	locations: inferServerActionReturnData<typeof getLocationsByTeam>["data"]
	availableSkills: inferServerActionReturnData<typeof getSkillsByTeam>["data"]
	teamId: string
}) {
	const [classes, setClasses] = useState<ExtendedClassType[]>(
		template.templateClasses || [],
	)
	const [editingClassId, setEditingClassId] = useState<string | null>(null)
	const [selectedSkills, setSelectedSkills] = useState<string[]>([])

	const createClassForm = useForm<CreateClassData>({
		resolver: zodResolver(createClassSchema),
		defaultValues: {
			classCatalogId: "",
			locationId: "",
			dayOfWeek: 1,
			startTime: "09:00",
			endTime: "10:00",
			requiredCoaches: 1,
		},
	})

	const updateClassForm = useForm<CreateClassData>({
		resolver: zodResolver(createClassSchema),
	})

	const bulkForm = useForm<BulkCreateData>({
		resolver: zodResolver(bulkCreateSchema),
		defaultValues: {
			classCatalogId: "",
			locationId: "",
			cronExpressions: "",
			duration: 60,
			requiredCoaches: 1,
		},
	})

	const { execute: createClassExec } = useServerAction(
		createScheduleTemplateClass,
	)
	const { execute: updateClassExec } = useServerAction(
		updateScheduleTemplateClass,
	)
	const { execute: deleteClassExec } = useServerAction(
		deleteScheduleTemplateClass,
	)
	const { execute: bulkExec } = useServerAction(
		bulkCreateScheduleTemplateClasses,
	)

	const onCreateClass = async (data: CreateClassData) => {
		const [res, err] = await createClassExec({
			templateId: template.id,
			...data,
			requiredSkillIds: selectedSkills,
		})
		if (err) return toast.error("Error adding class")
		const newClass: ExtendedClassType = {
			...res,
			requiredSkills: selectedSkills.map((skillId: string) => ({
				skillId,
				templateClassId: res.id,
				skill: {
					id: skillId,
					name:
						availableSkills.find((s: Skill) => s.id === skillId)?.name || "",
				},
			})),
		}
		setClasses([...classes, newClass])
		createClassForm.reset()
		setSelectedSkills([])
		toast.success("Class added")
	}

	const onUpdateClass = async (data: CreateClassData) => {
		if (!editingClassId) return
		const [res, err] = await updateClassExec({
			id: editingClassId,
			templateId: template.id,
			...data,
			requiredSkillIds: selectedSkills,
		})
		if (err) return toast.error("Error updating class")
		setClasses(
			classes.map((c: ExtendedClassType) =>
				c.id === editingClassId
					? {
							...c,
							...res,
							requiredSkills: selectedSkills.map((skillId: string) => ({
								skillId,
								templateClassId: res.id,
								skill: {
									id: skillId,
									name:
										availableSkills.find((s: Skill) => s.id === skillId)
											?.name || "",
								},
							})),
						}
					: c,
			),
		)
		setEditingClassId(null)
		setSelectedSkills([])
		toast.success("Class updated")
	}

	const onDeleteClass = async (id: string) => {
		const [res, err] = await deleteClassExec({ id, templateId: template.id })
		if (err) return toast.error("Error deleting class")
		setClasses(classes.filter((c: ExtendedClassType) => c.id !== id))
		toast.success("Class deleted")
	}

	const onBulkCreate = async (data: BulkCreateData) => {
		const cronExpressions = data.cronExpressions
			.split("\n")
			.map((s) => s.trim())
			.filter(Boolean)
		const [res, err] = await bulkExec({
			templateId: template.id,
			...data,
			cronExpressions,
			requiredSkillIds: selectedSkills,
		})
		if (err) return toast.error("Error bulk adding classes")
		const newClasses = res.map(
			(cls: BaseClassType) =>
				({
					...cls,
					requiredSkills: selectedSkills.map((skillId: string) => ({
						skillId,
						templateClassId: cls.id,
						skill: {
							id: skillId,
							name:
								availableSkills.find((s: Skill) => s.id === skillId)?.name ||
								"",
						},
					})),
				}) as ExtendedClassType,
		)
		setClasses([...classes, ...newClasses])
		bulkForm.reset()
		setSelectedSkills([])
		toast.success("Classes added")
	}

	const startEditingClass = (cls: ExtendedClassType) => {
		setEditingClassId(cls.id)
		updateClassForm.setValue("classCatalogId", template.classCatalogId)
		updateClassForm.setValue("locationId", template.locationId)
		updateClassForm.setValue("dayOfWeek", cls.dayOfWeek)
		updateClassForm.setValue("startTime", cls.startTime)
		updateClassForm.setValue("endTime", cls.endTime)
		updateClassForm.setValue("requiredCoaches", cls.requiredCoaches ?? 1)
		setSelectedSkills(
			cls.requiredSkills.map((rs: { skillId: string }) => rs.skillId),
		)
	}

	return (
		<div className="space-y-6">
			<h1 className="text-2xl font-bold">{template.name} - Classes</h1>
			{/* List classes */}
			{classes.map((cls: ExtendedClassType) => (
				<div
					key={cls.id}
					className="flex items-center justify-between p-2 border-b"
				>
					<div>
						<p>
							{dayNames[cls.dayOfWeek]} {cls.startTime} - {cls.endTime}
						</p>
						<p>
							Class:{" "}
							{classCatalog.find((c) => c.id === cls.classCatalogId)?.name}
						</p>
						<p>
							Location: {locations.find((l) => l.id === cls.locationId)?.name}
						</p>
						<p>Coaches: {cls.requiredCoaches}</p>
						<div>
							{cls.requiredSkills.map(
								(rs: ExtendedClassType["requiredSkills"][number]) => (
									<Badge key={rs.skillId}>{rs.skill.name}</Badge>
								),
							)}
						</div>
					</div>
					<div>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => startEditingClass(cls)}
						>
							<Edit className="h-4 w-4" />
						</Button>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => onDeleteClass(cls.id)}
						>
							<Trash2 className="h-4 w-4" />
						</Button>
					</div>
				</div>
			))}

			{/* Add/Edit class form */}
			<Form {...(editingClassId ? updateClassForm : createClassForm)}>
				<form
					onSubmit={
						editingClassId
							? updateClassForm.handleSubmit(onUpdateClass)
							: createClassForm.handleSubmit(onCreateClass)
					}
					className="space-y-4 mt-4"
				>
					<FormField
						control={
							editingClassId ? updateClassForm.control : createClassForm.control
						}
						name="classCatalogId"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Class Type</FormLabel>
								<Select onValueChange={field.onChange} value={field.value}>
									<FormControl>
										<SelectTrigger>
											<SelectValue placeholder="Select class type" />
										</SelectTrigger>
									</FormControl>
									<SelectContent>
										{classCatalog.map((cls) => (
											<SelectItem key={cls.id} value={cls.id}>
												{cls.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<FormMessage />
							</FormItem>
						)}
					/>
					{/* Similar for other fields: locationId, dayOfWeek, startTime, endTime, requiredCoaches */}
					<FormField
						control={
							editingClassId ? updateClassForm.control : createClassForm.control
						}
						name="locationId"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Location</FormLabel>
								<Select onValueChange={field.onChange} value={field.value}>
									<FormControl>
										<SelectTrigger>
											<SelectValue placeholder="Select location" />
										</SelectTrigger>
									</FormControl>
									<SelectContent>
										{locations.map((loc) => (
											<SelectItem key={loc.id} value={loc.id}>
												{loc.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<FormMessage />
							</FormItem>
						)}
					/>
					<FormField
						control={
							editingClassId ? updateClassForm.control : createClassForm.control
						}
						name="dayOfWeek"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Day of Week</FormLabel>
								<Select
									onValueChange={field.onChange}
									value={String(field.value)}
								>
									<FormControl>
										<SelectTrigger>
											<SelectValue placeholder="Select day" />
										</SelectTrigger>
									</FormControl>
									<SelectContent>
										{dayNames.map((day, index) => (
											<SelectItem key={day} value={String(index)}>
												{day}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<FormMessage />
							</FormItem>
						)}
					/>
					<FormField
						control={
							editingClassId ? updateClassForm.control : createClassForm.control
						}
						name="startTime"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Start Time</FormLabel>
								<FormControl>
									<Input type="time" {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
					<FormField
						control={
							editingClassId ? updateClassForm.control : createClassForm.control
						}
						name="endTime"
						render={({ field }) => (
							<FormItem>
								<FormLabel>End Time</FormLabel>
								<FormControl>
									<Input type="time" {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
					<FormField
						control={
							editingClassId ? updateClassForm.control : createClassForm.control
						}
						name="requiredCoaches"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Required Coaches</FormLabel>
								<FormControl>
									<Input type="number" min={1} {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
					<FormItem>
						<FormLabel>Required Skills</FormLabel>
						<div className="space-y-2">
							{availableSkills.map((skill: Skill) => (
								<div key={skill.id} className="flex items-center space-x-2">
									<Checkbox
										id={skill.id}
										checked={selectedSkills.includes(skill.id)}
										onCheckedChange={(checked: boolean) => {
											setSelectedSkills((prev) =>
												checked
													? [...prev, skill.id]
													: prev.filter((id: string) => id !== skill.id),
											)
										}}
									/>
									<label htmlFor={skill.id}>{skill.name}</label>
								</div>
							))}
						</div>
						<FormMessage />
					</FormItem>
					<Button type="submit">
						{editingClassId ? "Update Class" : "Add Class"}
					</Button>
					{editingClassId && (
						<Button variant="secondary" onClick={() => setEditingClassId(null)}>
							Cancel
						</Button>
					)}
				</form>
			</Form>

			{/* Bulk form */}
			<Form {...bulkForm}>
				<form
					onSubmit={bulkForm.handleSubmit(onBulkCreate)}
					className="space-y-4 mt-4"
				>
					<FormField
						control={bulkForm.control}
						name="cronExpressions"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Cron Expressions (one per line)</FormLabel>
								<FormControl>
									<Textarea {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
					{/* Similar for other bulk fields */}
					<FormField
						control={bulkForm.control}
						name="classCatalogId"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Class Type</FormLabel>
								<Select onValueChange={field.onChange} value={field.value}>
									<FormControl>
										<SelectTrigger>
											<SelectValue placeholder="Select class type" />
										</SelectTrigger>
									</FormControl>
									<SelectContent>
										{classCatalog.map((cls) => (
											<SelectItem key={cls.id} value={cls.id}>
												{cls.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<FormMessage />
							</FormItem>
						)}
					/>
					<FormField
						control={bulkForm.control}
						name="locationId"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Location</FormLabel>
								<Select onValueChange={field.onChange} value={field.value}>
									<FormControl>
										<SelectTrigger>
											<SelectValue placeholder="Select location" />
										</SelectTrigger>
									</FormControl>
									<SelectContent>
										{locations.map((loc) => (
											<SelectItem key={loc.id} value={loc.id}>
												{loc.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<FormMessage />
							</FormItem>
						)}
					/>
					<FormField
						control={bulkForm.control}
						name="duration"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Duration (minutes)</FormLabel>
								<FormControl>
									<Input type="number" min={1} {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
					<FormField
						control={bulkForm.control}
						name="requiredCoaches"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Required Coaches</FormLabel>
								<FormControl>
									<Input type="number" min={1} {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
					<FormItem>
						<FormLabel>Required Skills</FormLabel>
						<div className="space-y-2">
							{availableSkills.map((skill: Skill) => (
								<div key={skill.id} className="flex items-center space-x-2">
									<Checkbox
										id={skill.id}
										checked={selectedSkills.includes(skill.id)}
										onCheckedChange={(checked: boolean) => {
											setSelectedSkills((prev) =>
												checked
													? [...prev, skill.id]
													: prev.filter((id: string) => id !== skill.id),
											)
										}}
									/>
									<label htmlFor={skill.id}>{skill.name}</label>
								</div>
							))}
						</div>
						<FormMessage />
					</FormItem>
					<Button type="submit">Bulk Add</Button>
				</form>
			</Form>
		</div>
	)
}
