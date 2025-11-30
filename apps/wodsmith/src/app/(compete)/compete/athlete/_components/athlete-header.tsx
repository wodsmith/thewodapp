"use client"

import { Edit, Receipt } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import type { AthleteProfileData } from "@/utils/athlete-profile"

type AthleteHeaderProps = {
	user: {
		firstName: string | null
		lastName: string | null
		avatar: string | null
	}
	athleteProfile: AthleteProfileData | null
	gymName: string | null
	age: number | null
}

export function AthleteHeader({
	user,
	athleteProfile,
	gymName,
	age,
}: AthleteHeaderProps) {
	const _handleShare = async () => {
		try {
			await navigator.clipboard.writeText(window.location.href)
			toast.success("Profile link copied to clipboard")
		} catch {
			toast.error("Failed to copy link")
		}
	}

	const fullName = `${user.firstName || ""} ${user.lastName || ""}`.trim()
	const initials = `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase()

	// Use cover image if available, otherwise show a gradient background
	const coverImage = athleteProfile?.coverImageUrl
	const backgroundStyle = coverImage
		? {
			backgroundImage: `url(${coverImage})`,
			backgroundSize: "cover",
			backgroundPosition: "center",
		}
		: {
			background:
				"linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.5) 100%)",
		}

	return (
		<div className="relative">
			{/* Cover Image */}
			<div
				className="h-48 w-full rounded-lg sm:h-64"
				style={backgroundStyle}
			/>

			{/* Content Overlay */}
			<div className="container mx-auto px-4">
				<div className="relative -mt-16 sm:-mt-20">
					{/* Avatar */}
					<Avatar className="border-background h-32 w-32 border-4 sm:h-40 sm:w-40">
						<AvatarImage src={user.avatar || undefined} alt={fullName} />
						<AvatarFallback className="text-2xl sm:text-4xl">
							{initials}
						</AvatarFallback>
					</Avatar>

					{/* Name and Info */}
					<div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
						<div>
							<h1 className="text-3xl font-bold sm:text-4xl">{fullName}</h1>
							{gymName && (
								<p className="text-muted-foreground mt-1 text-lg">{gymName}</p>
							)}
							{age !== null && (
								<p className="text-muted-foreground mt-1">
									{age} years old
								</p>
							)}
						</div>

						<div className="flex gap-2">
							<Button asChild variant="outline" size="sm">
								<Link href="/compete/athlete/invoices">
									<Receipt className="mr-2 h-4 w-4" />
									Invoices
								</Link>
							</Button>
							<Button asChild variant="outline" size="sm">
								<Link href="/compete/athlete/edit">
									<Edit className="mr-2 h-4 w-4" />
									Edit Profile
								</Link>
							</Button>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
