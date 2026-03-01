import { standardSchemaResolver } from "@hookform/resolvers/standard-schema"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { ArrowLeft } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { trackEvent } from "@/lib/posthog"
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
import { MOVEMENT_TYPE_VALUES } from "@/db/schemas/workouts"
import { createMovementFn } from "@/server-fns/movement-fns"

export const Route = createFileRoute("/_protected/movements/new/")({
	component: CreateMovementPage,
})

const createMovementSchema = z.object({
	name: z.string().min(1, "Name is required"),
	type: z.enum(MOVEMENT_TYPE_VALUES, {
		message: "Please select a movement type",
	}),
})

type CreateMovementFormData = z.infer<typeof createMovementSchema>

function CreateMovementPage() {
	const navigate = useNavigate()
	const [isSubmitting, setIsSubmitting] = useState(false)
	const createMovement = useServerFn(createMovementFn)

	const form = useForm<CreateMovementFormData>({
		resolver: standardSchemaResolver(createMovementSchema),
		defaultValues: {
			name: "",
			type: undefined,
		},
	})

	const handleSubmit = async (data: CreateMovementFormData) => {
		setIsSubmitting(true)

		try {
			const result = await createMovement({ data })
			trackEvent("movement_created", {
				movement_id: result.movement.id,
				movement_name: data.name,
				movement_type: data.type,
			})
			navigate({ to: "/movements", search: { q: "", type: "" } })
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "An unknown error occurred."
			trackEvent("movement_created_failed", {
				error_message: message,
			})
			console.error("Failed to create movement:", error)
			form.setError("root", { message })
		} finally {
			setIsSubmitting(false)
		}
	}

	return (
		<div>
			<div className="mb-6 flex items-center justify-between">
				<div className="flex items-center gap-2">
					<Button asChild variant="outline" size="icon">
						<Link to="/movements" search={{ q: "", type: "" }}>
							<ArrowLeft className="h-5 w-5" />
						</Link>
					</Button>
					<h1 className="text-xl font-semibold">CREATE MOVEMENT</h1>
				</div>
			</div>

			<Form {...form}>
				<form
					className="mx-auto max-w-md border-2 border-black p-6 dark:border-white"
					onSubmit={form.handleSubmit(handleSubmit)}
				>
					<div className="space-y-6">
						<FormField
							control={form.control}
							name="name"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Movement Name</FormLabel>
									<FormControl>
										<Input
											placeholder="e.g., Back Squat, Thruster, Burpee"
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="type"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Movement Type</FormLabel>
									<Select
										onValueChange={field.onChange}
										defaultValue={field.value}
									>
										<FormControl>
											<SelectTrigger>
												<SelectValue placeholder="Select a type" />
											</SelectTrigger>
										</FormControl>
										<SelectContent>
											{MOVEMENT_TYPE_VALUES.map((movementType) => (
												<SelectItem key={movementType} value={movementType}>
													{movementType.charAt(0).toUpperCase() +
														movementType.slice(1)}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									<FormMessage />
								</FormItem>
							)}
						/>

						{form.formState.errors.root && (
							<p className="text-sm text-destructive">
								{form.formState.errors.root.message}
							</p>
						)}

						<Button type="submit" disabled={isSubmitting} className="w-full">
							{isSubmitting ? "Creating..." : "Create Movement"}
						</Button>
					</div>
				</form>
			</Form>
		</div>
	)
}
