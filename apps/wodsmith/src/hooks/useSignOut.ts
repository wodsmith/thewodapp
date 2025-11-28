import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { signOutAction } from "@/actions/sign-out.action"
import { useSessionStore } from "@/state/session"

const useSignOut = (redirectTo?: string) => {
	const { clearSession } = useSessionStore()
	const router = useRouter()

	const signOut = async () => {
		toast.loading("Signing out...")
		await signOutAction()
		clearSession()
		await new Promise((resolve) => setTimeout(resolve, 200))
		toast.dismiss()
		toast.success("Signed out successfully")
		if (redirectTo) {
			router.push(redirectTo)
		}
	}

	return { signOut }
}

export default useSignOut
