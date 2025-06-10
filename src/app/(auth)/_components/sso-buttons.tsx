import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import Google from "@/icons/google"
import { useConfigStore } from "@/state/config"
import Link from "next/link"

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
				<Button className="w-full" asChild size="lg">
					<Link href="/sso/google">
						<Google className="w-[22px] h-[22px] mr-1" />
						{isSignIn ? "Sign in with Google" : "Sign up with Google"}
					</Link>
				</Button>
			)}
		</>
	)
}
