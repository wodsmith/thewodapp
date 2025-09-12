"use client"

import { Search } from "lucide-react"
import type { Route } from "next"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import type { Movement, Tag } from "@/types"

interface WorkoutControlsProps {
	allTags: Tag["name"][]
	allMovements: Movement["name"][]
}

export default function WorkoutControls({
	allTags,
	allMovements,
}: WorkoutControlsProps) {
	const router = useRouter()
	const pathname = usePathname()
	const searchParams = useSearchParams()
	const [searchTerm, setSearchTerm] = useState(searchParams.get("search") || "")
	const [selectedTag, setSelectedTag] = useState(searchParams.get("tag") || "")
	const [selectedMovement, setSelectedMovement] = useState(
		searchParams.get("movement") || "",
	)
	const [workoutType, setWorkoutType] = useState(searchParams.get("type") || "")

	useEffect(() => {
		const params = new URLSearchParams(searchParams.toString())
		if (searchTerm) {
			params.set("search", searchTerm)
		} else {
			params.delete("search")
		}

		if (selectedTag) {
			params.set("tag", selectedTag)
		} else {
			params.delete("tag")
		}

		if (selectedMovement) {
			params.set("movement", selectedMovement)
		} else {
			params.delete("movement")
		}

		if (workoutType) {
			params.set("type", workoutType)
		} else {
			params.delete("type")
		}

		router.replace(`${pathname}?${params.toString()}` as Route, {
			scroll: false,
		})
	}, [
		searchTerm,
		selectedTag,
		selectedMovement,
		workoutType,
		router,
		pathname,
		searchParams,
	])

	return (
		<div className="mb-6 flex flex-col gap-4 sm:flex-row">
			<div className="relative flex-1">
				<Search className="-translate-y-1/2 absolute top-1/2 left-3 transform text-gray-500" />
				<Input
					type="text"
					placeholder="Search workouts..."
					className="w-full pl-10"
					value={searchTerm}
					onChange={(e) => setSearchTerm(e.target.value)}
				/>
			</div>
			<div className="flex gap-4">
				<Select
					value={selectedTag}
					onValueChange={(value) =>
						setSelectedTag(value === "all" ? "" : value)
					}
				>
					<SelectTrigger className="w-[180px]">
						<SelectValue placeholder="All Tags" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All Tags</SelectItem>
						{allTags.map((tag) => (
							<SelectItem key={tag} value={tag}>
								{tag}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Select
					value={selectedMovement}
					onValueChange={(value) =>
						setSelectedMovement(value === "all" ? "" : value)
					}
				>
					<SelectTrigger className="w-[180px]">
						<SelectValue placeholder="All Movements" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All Movements</SelectItem>
						{allMovements.map((movement) => (
							<SelectItem key={movement} value={movement}>
								{movement}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Select
					value={workoutType}
					onValueChange={(value) =>
						setWorkoutType(value === "all" ? "" : value)
					}
				>
					<SelectTrigger className="w-[180px]">
						<SelectValue placeholder="All Workouts" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All Workouts</SelectItem>
						<SelectItem value="original">Original Only</SelectItem>
						<SelectItem value="remix">Remixes Only</SelectItem>
					</SelectContent>
				</Select>
			</div>
			{/* The Filter button is currently not used for modal functionality */}
			{/* <button className="btn-outline flex items-center gap-2">
				<Filter className="h-5 w-5" />
				Filter
			</button> */}
		</div>
	)
}
