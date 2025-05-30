import { useSessionStore } from "@/state/session";
import { signOutAction } from "@/actions/sign-out.action";
import { toast } from "sonner";
const useSignOut = () => {
  const { clearSession } = useSessionStore();

  const signOut = async () => {
    toast.loading("Signing out...")
    await signOutAction();
    clearSession();
    await new Promise((resolve) => setTimeout(resolve, 200));
    toast.dismiss()
    toast.success("Signed out successfully")
  }

  return { signOut }
}

export default useSignOut;
