import { standardSchemaResolver } from "@hookform/resolvers/standard-schema"
import {
  createFileRoute,
  Link,
  redirect,
  useRouter,
  useSearch,
} from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { UserPlus } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { Captcha } from "@/components/captcha"
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
import { type SignUpInput, signUpFn, signUpSchema } from "@/server-fns/auth-fns"
import { getCrewAuthStateFn } from "@/server-fns/crew-auth-fns"

export const Route = createFileRoute("/sign-up")({
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
  component: SignUpPage,
})

function SignUpPage() {
  const router = useRouter()
  const search = useSearch({ strict: false }) as { redirect?: unknown }
  const redirectPath = sanitizeCrewAuthRedirect(
    typeof search.redirect === "string" ? search.redirect : undefined,
    CREW_AUTH_FALLBACK_PATH,
  )
  const signUp = useServerFn(signUpFn)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [needsVerification, setNeedsVerification] = useState(false)
  const form = useForm<SignUpInput>({
    resolver: standardSchemaResolver(signUpSchema),
    defaultValues: {
      email: "",
      firstName: "",
      lastName: "",
      password: "",
    },
  })

  async function onSubmit(data: SignUpInput) {
    try {
      setIsLoading(true)
      setError(null)

      const result = await signUp({ data })
      if (result.requiresVerification) {
        setNeedsVerification(true)
        return
      }

      await router.invalidate()
      await router.navigate({ to: redirectPath })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-up failed")
    } finally {
      setIsLoading(false)
    }
  }

  if (needsVerification) {
    return (
      <main className="flex min-h-[90vh] items-center justify-center bg-background px-4 py-10">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Check your email</CardTitle>
            <CardDescription>
              Verify your email address, then come back to sign in to Crew.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link to="/sign-in" search={{ redirect: redirectPath }}>
                Go to sign in
              </Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    )
  }

  return (
    <main className="flex min-h-[90vh] items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Create a Crew account</CardTitle>
          <CardDescription>
            Already have an account?{" "}
            <Link
              to="/sign-in"
              search={{ redirect: redirectPath }}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Sign in
            </Link>
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
                        placeholder="you@example.com"
                        disabled={isLoading}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Jane"
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
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Smith"
                          disabled={isLoading}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="At least 8 characters"
                        disabled={isLoading}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-4 pt-2">
                <Captcha
                  onSuccess={(token: string) =>
                    form.setValue("captchaToken", token)
                  }
                  validationError={form.formState.errors.captchaToken?.message}
                />

                <Button type="submit" className="w-full" disabled={isLoading}>
                  <UserPlus />
                  {isLoading ? "Creating account..." : "Create account"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </main>
  )
}
