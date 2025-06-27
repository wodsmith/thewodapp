import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import Google from "@/icons/google"
import { useConfigStore } from "@/state/config"

export default function SSOButtons({
	isSignIn = false,
}: {
	isSignIn?: boolean
}) {
	const { isGoogleSSOEnabled } = useConfigStore()

	if (isGoogleSSOEnabled === null) {
		return <Skeleton className="w-full h-[44px]" />
	}

	return (
		<>
			{isGoogleSSOEnabled && (
				<Button
					className="w-full bg-secondary border-4 border-primary text-primary hover:bg-orange hover:text-white shadow-[4px_4px_0px_0px] shadow-primary transition-all font-mono font-bold uppercase"
					asChild
					size="lg"
				>
					<Link href="/sso/google">
						<Google className="w-[22px] h-[22px] mr-2" />
						{isSignIn ? "SIGN IN WITH GOOGLE" : "SIGN UP WITH GOOGLE"}
					</Link>
				</Button>
			)}
		</>
	)
}
