import { inviteUserAction } from "@/actions/team-membership-actions"
import type React from "react"
import { useState } from "react"
import { useServerAction } from "zsa-react"

interface InviteMemberProps {
	teamId: string
	userRole: string
}

export function InviteMember({ teamId, userRole }: InviteMemberProps) {
	const [email, setEmail] = useState("")
	const [success, setSuccess] = useState(false)
	const { execute, isPending, error } = useServerAction(inviteUserAction, {
		onSuccess: () => {
			setSuccess(true)
			setEmail("")
			setTimeout(() => setSuccess(false), 2000)
		},
	})

	if (userRole !== "owner") return null

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault()
		execute({ teamId, email, roleId: "member", isSystemRole: true })
	}

	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			<div>
				<label htmlFor="email-invite">Email</label>
				<input
					id="email-invite"
					type="email"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					className="input"
					required
				/>
			</div>
			<button type="submit" disabled={isPending} className="btn">
				Invite
			</button>
			{error && <div className="text-red-500">Error: {error.message}</div>}
			{success && <div className="text-green-500">Invitation sent!</div>}
		</form>
	)
}
