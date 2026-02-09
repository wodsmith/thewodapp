import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { Lock } from "lucide-react"
import { useState } from "react"
import { checkAuthFn, loginFn } from "@/server-fns/auth"

export const Route = createFileRoute("/")({
	loader: async () => {
		const isAuthenticated = await checkAuthFn()
		return { isAuthenticated }
	},
	component: LoginPage,
})

function LoginPage() {
	const { isAuthenticated } = Route.useLoaderData()
	const navigate = useNavigate()
	const login = useServerFn(loginFn)
	const [password, setPassword] = useState("")
	const [error, setError] = useState("")
	const [loading, setLoading] = useState(false)

	// Redirect if already authenticated
	if (isAuthenticated) {
		navigate({ to: "/documents" })
		return null
	}

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		setError("")
		setLoading(true)

		try {
			const result = await login({ data: { password } })
			if (result.success) {
				navigate({ to: "/documents" })
			} else {
				setError(result.error)
			}
		} catch {
			setError("Something went wrong")
		} finally {
			setLoading(false)
		}
	}

	return (
		<div className="flex min-h-screen items-center justify-center bg-background">
			<div className="w-full max-w-sm space-y-6 p-8">
				<div className="flex flex-col items-center space-y-2 text-center">
					<div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
						<Lock className="h-6 w-6 text-primary" />
					</div>
					<h1 className="text-2xl font-bold tracking-tight">Ledger</h1>
					<p className="text-sm text-muted-foreground">
						Enter your password to access documents
					</p>
				</div>

				<form onSubmit={handleSubmit} className="space-y-4">
					<div className="space-y-2">
						<label
							htmlFor="password"
							className="text-sm font-medium leading-none"
						>
							Password
						</label>
						<input
							id="password"
							type="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							placeholder="Enter password"
							className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
							required
						/>
					</div>

					{error && (
						<p className="text-sm text-destructive">{error}</p>
					)}

					<button
						type="submit"
						disabled={loading}
						className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground ring-offset-background transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
					>
						{loading ? "Signing in..." : "Sign in"}
					</button>
				</form>
			</div>
		</div>
	)
}
