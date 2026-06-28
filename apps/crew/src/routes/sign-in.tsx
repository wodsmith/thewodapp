import { standardSchemaResolver } from "@hookform/resolvers/standard-schema"
import {
  createFileRoute,
  Link,
  redirect,
  useRouter,
  useSearch,
} from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { LogIn } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { Alert, AlertDescription } from "@/components/ui/alert"
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
import {
  CREW_AUTH_FALLBACK_PATH,
  sanitizeCrewAuthRedirect,
} from "@/lib/crew/auth-redirect"
import { type SignInInput, signInFn, signInSchema } from "@/server-fns/auth-fns"
import { getCrewAuthStateFn } from "@/server-fns/crew-auth-fns"

export const Route = createFileRoute("/sign-in")({
  beforeLoad: async ({ search }) => {
    const { session } = await getCrewAuthStateFn()
    const redirectSearch = search as { redirect?: unknown }

    if (session) {
      throw redirect({
        to: sanitizeCrewAuthRedirect(
          typeof redirectSearch.redirect === "string"
            ? redirectSearch.redirect
            : undefined,
          CREW_AUTH_FALLBACK_PATH,
        ),
      })
    }
  },
  component: SignInPage,
})

function SignInPage() {
  const router = useRouter()
  const search = useSearch({ strict: false }) as { redirect?: unknown }
  const redirectPath = sanitizeCrewAuthRedirect(
    typeof search.redirect === "string" ? search.redirect : undefined,
    CREW_AUTH_FALLBACK_PATH,
  )
  const signIn = useServerFn(signInFn)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const form = useForm<SignInInput>({
    resolver: standardSchemaResolver(signInSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  })

  async function onSubmit(data: SignInInput) {
    try {
      setIsLoading(true)
      setError(null)

      await signIn({ data })
      await router.invalidate()
      await router.navigate({ to: redirectPath })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="flex min-h-[90vh] items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Sign in to Crew</CardTitle>
          <CardDescription>
            Use your WODsmith account to manage Crew event operations.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
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

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Enter your password"
                        disabled={isLoading}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full" disabled={isLoading}>
                <LogIn />
                {isLoading ? "Signing in..." : "Sign in"}
              </Button>
            </form>
          </Form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Need access?{" "}
            <Link
              to="/sign-up"
              search={{ redirect: redirectPath }}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Create a Crew account
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  )
}
