"use client"

import { LogOut } from "lucide-react"
import useSignOut from "~/hooks/useSignOut"

export default function LogoutButton() {
	const { signOut } = useSignOut("/compete")

	return (
		<button type="button" className="font-bold" onClick={signOut}>
			<LogOut className="h-5 w-5" />
		</button>
	)
}
