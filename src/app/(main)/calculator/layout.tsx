"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { NuqsAdapter } from "nuqs/adapters/next/app"
import { Suspense } from "react"

export default function CalculatorLayout({
	children,
}: {
	children: React.ReactNode
}) {
	const pathname = usePathname()

	return (
		<div className="flex flex-col sm:flex-row">
			<nav className="p-4 text-black dark:text-white">
				<ul className="flex flex-col gap-2">
					<li
						className={`border-2 border-black p-2 dark:border-white ${
							pathname === "/calculator"
								? "bg-black text-white dark:bg-white dark:text-black"
								: ""
						}`}
					>
						<Link href="/calculator" className="">
							Calculator
						</Link>
					</li>
					<li
						className={`border-2 border-black p-2 dark:border-white ${
							pathname === "/calculator/spreadsheet"
								? "bg-black text-white dark:bg-white dark:text-black"
								: ""
						}`}
					>
						<Link href="/calculator/spreadsheet" className="">
							Percentage Spreadsheet
						</Link>
					</li>
				</ul>
			</nav>
			<Suspense fallback={<div>Loading...</div>}>
				<NuqsAdapter>
					<main className="h-full flex-grow p-4">{children}</main>
				</NuqsAdapter>
			</Suspense>
		</div>
	)
}
