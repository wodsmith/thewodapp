import { redirect } from "next/navigation"
import { Suspense } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { getSessionFromCookie } from "@/utils/auth"
import { SettingsForm } from "../settings-form"

function SettingsFormSkeleton() {
	return (
		<Card>
			<CardHeader>
				<div className="space-y-2">
					<Skeleton className="h-8 w-[200px]" />
					<Skeleton className="h-4 w-[300px]" />
				</div>
			</CardHeader>
			<CardContent>
				<div className="space-y-6">
					<div className="grid gap-6 sm:grid-cols-2">
						<div className="space-y-2">
							<Skeleton className="h-4 w-[100px]" />
							<Skeleton className="h-10 w-full" />
						</div>
						<div className="space-y-2">
							<Skeleton className="h-4 w-[100px]" />
							<Skeleton className="h-10 w-full" />
						</div>
					</div>

					<div className="space-y-2">
						<Skeleton className="h-4 w-[100px]" />
						<Skeleton className="h-10 w-full" />
						<Skeleton className="h-4 w-[200px]" />
					</div>

					<div className="flex justify-end">
						<Skeleton className="h-10 w-[100px]" />
					</div>
				</div>
			</CardContent>
		</Card>
	)
}

export default async function SettingsPage() {
	const session = await getSessionFromCookie()

	if (!session) {
		return redirect("/sign-in")
	}

	return (
		<div className="grid gap-4">
			<Suspense fallback={<SettingsFormSkeleton />}>
				<SettingsForm />
			</Suspense>
		</div>
	)
}
