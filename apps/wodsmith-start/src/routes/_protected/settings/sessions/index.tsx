import { createFileRoute, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { formatDistanceToNow } from "date-fns"
import { Loader2 } from "lucide-react"
import { useState } from "react"
import { capitalize } from "remeda"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import {
	getUserSessionsFn,
	revokeSessionFn,
	type SessionWithMeta,
} from "@/server-fns/session-fns"

const regionNames = new Intl.DisplayNames(["en"], { type: "region" })

/**
 * Safely get region display name, returning undefined for invalid codes
 */
function getRegionName(countryCode: string | null): string | undefined {
	if (!countryCode) return undefined
	try {
		return regionNames.of(countryCode)
	} catch {
		return undefined
	}
}

export const Route = createFileRoute("/_protected/settings/sessions/")({
	component: SessionsPage,
	pendingComponent: SessionsPageSkeleton,
	loader: async () => {
		const sessions = await getUserSessionsFn()
		return { sessions }
	},
})

function SessionsPageSkeleton() {
	return (
		<div className="container mx-auto px-4 py-8">
			<div className="mb-6">
				<h1 className="text-4xl font-bold">SESSIONS</h1>
				<p className="text-muted-foreground mt-2">
					Manage your active sessions across devices
				</p>
			</div>
			<div className="space-y-4">
				{[1, 2, 3].map((i) => (
					<Skeleton key={i} className="h-[100px] w-full" />
				))}
			</div>
		</div>
	)
}

function SessionsPage() {
	const { sessions } = Route.useLoaderData()

	return (
		<div className="container mx-auto px-4 py-8">
			<div className="mb-6">
				<h1 className="text-4xl font-bold">SESSIONS</h1>
				<p className="text-muted-foreground mt-2">
					Manage your active sessions across devices
				</p>
			</div>
			<SessionsList sessions={sessions} />
		</div>
	)
}

function SessionsList({ sessions }: { sessions: SessionWithMeta[] }) {
	const router = useRouter()
	const revokeSession = useServerFn(revokeSessionFn)
	const [revokingSessionId, setRevokingSessionId] = useState<string | null>(
		null,
	)
	const [openDialogId, setOpenDialogId] = useState<string | null>(null)

	const handleRevokeSession = async (sessionId: string) => {
		setRevokingSessionId(sessionId)
		try {
			await revokeSession({ data: { sessionId } })
			toast.success("Session deleted")
			setOpenDialogId(null)
			router.invalidate()
		} catch {
			toast.error("Failed to delete session")
		} finally {
			setRevokingSessionId(null)
		}
	}

	if (sessions.length === 0) {
		return (
			<div className="text-center py-16 border-2 border-dashed border-muted rounded-lg bg-muted/50">
				<p className="text-muted-foreground text-lg">
					No active sessions found
				</p>
			</div>
		)
	}

	return (
		<div className="space-y-4">
			{sessions.map((session) => (
				<Card
					key={session.id}
					className={cn(
						!session.isCurrentSession
							? "bg-card/40"
							: "border-2 border-primary/20 shadow-lg bg-secondary/30",
					)}
				>
					<CardHeader>
						<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
							<div className="space-y-2">
								<div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
									<CardTitle className="flex flex-wrap items-center gap-2 text-base">
										{session.city && session.country
											? `${session.city}, ${getRegionName(session.country) ?? session.country}`
											: session.country
												? (getRegionName(session.country) ?? session.country)
												: "Unknown location"}
										{session.isCurrentSession && <Badge>Current Session</Badge>}
									</CardTitle>
									{session?.authenticationType && (
										<Badge variant="outline">
											Authenticated with{" "}
											{capitalize(
												session?.authenticationType ?? "password",
											)?.replace("-", " ")}
										</Badge>
									)}
									<div className="text-sm text-muted-foreground whitespace-nowrap">
										&nbsp;·&nbsp;{formatDistanceToNow(session.createdAt)} ago
									</div>
								</div>
								<CardDescription className="text-sm">
									{session.parsedUserAgent?.browser.name ?? "Unknown browser"}{" "}
									{session.parsedUserAgent?.browser.major ?? "Unknown version"}{" "}
									on{" "}
									{session.parsedUserAgent?.device.vendor ?? "Unknown device"}{" "}
									{session.parsedUserAgent?.device.model ?? "Unknown model"}{" "}
									{session.parsedUserAgent?.device.type ?? "Unknown type"} (
									{session.parsedUserAgent?.os.name ?? "Unknown OS"}{" "}
									{session.parsedUserAgent?.os.version ?? "Unknown version"})
								</CardDescription>
							</div>
							<div>
								{!session?.isCurrentSession && (
									<Dialog
										open={openDialogId === session.id}
										onOpenChange={(open) =>
											setOpenDialogId(open ? session.id : null)
										}
									>
										<DialogTrigger asChild>
											<Button
												size="sm"
												variant="destructive"
												className="w-full sm:w-auto"
											>
												Delete session
											</Button>
										</DialogTrigger>
										<DialogContent>
											<DialogHeader>
												<DialogTitle>Delete session?</DialogTitle>
												<DialogDescription>
													This will sign out this device. This action cannot be
													undone.
												</DialogDescription>
											</DialogHeader>
											<DialogFooter className="mt-6 sm:mt-0">
												<Button
													variant="outline"
													onClick={() => setOpenDialogId(null)}
												>
													Cancel
												</Button>
												<Button
													variant="destructive"
													className="mb-4 sm:mb-0"
													disabled={revokingSessionId === session.id}
													onClick={() => handleRevokeSession(session.id)}
												>
													{revokingSessionId === session.id && (
														<Loader2 className="mr-2 h-4 w-4 animate-spin" />
													)}
													Delete session
												</Button>
											</DialogFooter>
										</DialogContent>
									</Dialog>
								)}
							</div>
						</div>
					</CardHeader>
				</Card>
			))}
		</div>
	)
}
