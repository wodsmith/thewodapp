import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

type Props = {
	params: Promise<{ slug: string }>
	children: React.ReactNode
}

export default async function MyScheduleLayout({ params, children }: Props) {
	const { slug } = await params

	return (
		<div className="min-h-screen bg-background">
			<div className="border-b">
				<div className="container mx-auto px-4 py-4">
					<Button variant="ghost" size="sm" asChild>
						<Link href={`/compete/${slug}`}>
							<ArrowLeft className="mr-2 h-4 w-4" />
							Back to Competition
						</Link>
					</Button>
				</div>
			</div>
			{children}
		</div>
	)
}
