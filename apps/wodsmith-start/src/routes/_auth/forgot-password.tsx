import { standardSchemaResolver } from "@hookform/resolvers/standard-schema"
import { createFileRoute, Link, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { forgotPasswordFn } from "@/server-fns/auth-fns"

// Define schema here to match server-side validation
const forgotPasswordSchema = z.object({
	email: z.string().email("Please enter a valid email address"),
})

type ForgotPasswordSchema = z.infer<typeof forgotPasswordSchema>

export const Route = createFileRoute("/_auth/forgot-password")({
	component: ForgotPasswordPage,
})

function ForgotPasswordPage() {
	const router = useRouter()
	const [isSuccess, setIsSuccess] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [isLoading, setIsLoading] = useState(false)

	// Use the server function hook for client-side calls
	const forgotPassword = useServerFn(forgotPasswordFn)

	const form = useForm<ForgotPasswordSchema>({
		resolver: standardSchemaResolver(forgotPasswordSchema),
		defaultValues: {
			email: "",
		},
	})

	const onSubmit = async (data: ForgotPasswordSchema) => {
		try {
			setIsLoading(true)
			setError(null)

			await forgotPassword({ data })

			// Always show success (prevents email enumeration)
			setIsSuccess(true)
		} catch (err) {
			// This shouldn't normally happen since server always returns success
			const errorMessage =
				err instanceof Error
					? err.message
					: "An error occurred. Please try again."
			setError(errorMessage)
			console.error("Forgot password error:", err)
		} finally {
			setIsLoading(false)
		}
	}

	// Success state
	if (isSuccess) {
		return (
			<div className="container mx-auto px-4 flex items-center justify-center min-h-screen">
				<Card className="w-full max-w-md border-4 border-black dark:border-primary shadow-[8px_8px_0px_0px] dark:shadow-primary">
					<CardHeader>
						<CardTitle className="font-mono uppercase">
							Check your email
						</CardTitle>
						<CardDescription className="font-mono">
							If an account exists with that email, we&apos;ve sent you
							instructions to reset your password.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Button
							variant="outline"
							className="w-full font-mono uppercase"
							onClick={() =>
								router.navigate({
									to: "/sign-in",
									search: { redirect: "/dashboard" },
								})
							}
						>
							Back to login
						</Button>
					</CardContent>
				</Card>
			</div>
		)
	}

	return (
		<div className="container mx-auto px-4 flex flex-col items-center justify-center min-h-screen">
			<Card className="w-full max-w-md border-4 border-black dark:border-primary shadow-[8px_8px_0px_0px] dark:shadow-primary">
				<CardHeader>
					<CardTitle className="font-mono uppercase">Forgot Password</CardTitle>
					<CardDescription className="font-mono">
						Enter your email address and we&apos;ll send you instructions to
						reset your password.
					</CardDescription>
				</CardHeader>
				<CardContent>
					{error && (
						<div className="mb-4 p-4 bg-red-500/10 border-2 border-red-500 text-red-500 font-mono text-sm">
							{error}
						</div>
					)}

					<Form {...form}>
						<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
							<FormField
								control={form.control}
								name="email"
								render={({ field }) => (
									<FormItem>
										<FormLabel className="font-mono uppercase">Email</FormLabel>
										<FormControl>
											<Input
												type="email"
												placeholder="name@example.com"
												disabled={isLoading}
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							{/* TODO: Add Turnstile captcha integration */}

							<Button
								type="submit"
								className="w-full font-mono uppercase"
								disabled={isLoading}
							>
								{isLoading ? "Sending..." : "Send Reset Instructions"}
							</Button>
						</form>
					</Form>
				</CardContent>
			</Card>

			<div className="mt-4 w-full max-w-md">
				<Link
					to="/sign-in"
					search={{ redirect: "/dashboard" }}
					className="block w-full text-center font-mono uppercase text-sm text-primary underline hover:no-underline"
				>
					Back to login
				</Link>
			</div>
		</div>
	)
}
