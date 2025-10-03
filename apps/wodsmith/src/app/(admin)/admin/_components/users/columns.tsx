"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { format, formatDistanceToNow } from "date-fns"
import { MoreHorizontal } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip"

export type User = {
	id: string
	email: string | null
	name: string | null
	role: string
	status: "active" | "inactive"
	createdAt: Date
}

export const columns: ColumnDef<User>[] = [
	{
		accessorKey: "email",
		header: "Email",
	},
	{
		accessorKey: "name",
		header: "Name",
	},
	{
		accessorKey: "role",
		header: "Role",
		cell: ({ row }) => {
			const role = row.getValue("role") as string
			return (
				<Badge variant={role === "admin" ? "default" : "secondary"}>
					{role}
				</Badge>
			)
		},
	},
	{
		accessorKey: "status",
		header: "Status",
		cell: ({ row }) => {
			const status = row.getValue("status") as string
			return (
				<Badge variant={status === "active" ? "default" : "destructive"}>
					{status}
				</Badge>
			)
		},
	},
	{
		accessorKey: "createdAt",
		header: "Created",
		cell: ({ row }) => {
			const date = row.getValue("createdAt") as Date
			const formattedDate = format(new Date(date), "PPpp")
			return (
				<Tooltip>
					<TooltipTrigger>
						{formatDistanceToNow(new Date(date), { addSuffix: true })}
					</TooltipTrigger>
					<TooltipContent>
						<p>{formattedDate}</p>
					</TooltipContent>
				</Tooltip>
			)
		},
	},
	{
		id: "actions",
		cell: ({ row }) => {
			const user = row.original

			return (
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost" className="h-8 w-8 p-0">
							<span className="sr-only">Open menu</span>
							<MoreHorizontal className="h-4 w-4" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuLabel>Actions</DropdownMenuLabel>
						<DropdownMenuItem
							onClick={() => navigator.clipboard.writeText(user.id)}
						>
							Copy user ID
						</DropdownMenuItem>
						<DropdownMenuItem
							onClick={() => navigator.clipboard.writeText(user.email || "")}
						>
							Copy email
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			)
		},
	},
]
