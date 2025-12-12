"use client"

import { useState } from "react"
import { debugUserSessionAction } from "~/actions/debug-actions"
import { Button } from "~/components/ui/button"

interface SessionData {
	userId: string
	userEmail: string | null
	teams: Array<{
		id: string
		name: string
		slug: string
		role: {
			id: string
			name: string
			isSystemRole: boolean
		}
		permissions: string[]
	}>
	error?: string
}

export function DebugSessionInfo() {
	const [sessionData, setSessionData] = useState<SessionData | null>(null)
	const [loading, setLoading] = useState(false)

	const handleDebug = async () => {
		setLoading(true)
		try {
			const [result, error] = await debugUserSessionAction()
			if (error) {
				console.error("Debug error:", error)
				setSessionData({
					error: error.message,
					userId: "",
					userEmail: "",
					teams: [],
				})
			} else {
				setSessionData(result)
				console.log("Session Debug Data:", result)
			}
		} catch (error) {
			console.error("Debug error:", error)
			setSessionData({
				error: error instanceof Error ? error.message : "Unknown error",
				userId: "",
				userEmail: "",
				teams: [],
			})
		} finally {
			setLoading(false)
		}
	}

	return (
		<div className="p-4 border-2 border-red-500 bg-red-50 rounded-lg">
			<h3 className="font-bold text-red-800 mb-2">DEBUG: Session Info</h3>
			<Button onClick={handleDebug} disabled={loading} className="mb-4">
				{loading ? "Loading..." : "Debug Session"}
			</Button>

			{sessionData && (
				<div className="bg-white p-4 rounded border">
					<pre className="text-xs overflow-auto">
						{JSON.stringify(sessionData, null, 2)}
					</pre>
				</div>
			)}
		</div>
	)
}
