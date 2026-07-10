import { standardSchemaResolver } from "@hookform/resolvers/standard-schema"
import { AuthEntry } from "@repo/ui/auth-entry"
import {
  createFileRoute,
  Link,
  redirect,
  useRouter,
} from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { REDIRECT_AFTER_SIGN_IN } from "@/constants"
import { useIdentifyUser, useTrackEvent } from "@/lib/posthog/hooks"
import {
  getSessionFn,
  type SignInInput,
  signInFn,
  signInSchema,
} from "@/server-fns/auth-fns"

export const Route = createFileRoute("/_auth/sign-in")({
  component: SignInPage,
  validateSearch: (
    search: Record<string, unknown>,
  ): { redirect: string; email?: string; invite?: string } => {
    return {
      redirect: (search.redirect as string) || REDIRECT_AFTER_SIGN_IN,
      email: (search.email as string) || undefined,
      invite: (search.invite as string) || undefined,
    }
  },
  beforeLoad: async ({ search }) => {
    const session = await getSessionFn()
    const redirectPath =
      (search as { redirect?: string }).redirect || REDIRECT_AFTER_SIGN_IN

    if (session) {
      throw redirect({ to: redirectPath })
    }
  },
})

function SignInPage() {
  const router = useRouter()
  const {
    redirect: redirectPath,
    email: inviteEmailParam,
    invite,
  } = Route.useSearch()
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // PostHog tracking hooks
  const trackEvent = useTrackEvent()
  const identifyUser = useIdentifyUser()

  // Use useServerFn for client-side calls
  const signIn = useServerFn(signInFn)

  // Invite flow only locks the email field when both an invite token and
  // an email are present. A bare `?invite=` would otherwise disable the
  // field with an empty value and stop sign-in cold.
  const inviteFlow = !!invite && !!inviteEmailParam

  const form = useForm<SignInInput>({
    resolver: standardSchemaResolver(signInSchema),
    defaultValues: {
      email: inviteFlow ? (inviteEmailParam ?? "") : "",
      password: "",
    },
  })

  const onSubmit = async (data: SignInInput) => {
    try {
      setIsLoading(true)
      setError(null)

      const result = await signIn({ data })

      // Identify user and track successful sign-in
      identifyUser(result.userId, { email: data.email })
      trackEvent("user_signed_in", { auth_method: "email_password" })

      // Redirect to the intended destination
      router.navigate({ to: redirectPath })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Sign-in failed"
      setError(errorMessage)
      console.error("Sign-in error:", err)

      // Track failed sign-in attempt
      trackEvent("user_signed_in_failed", { error_message: errorMessage })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthEntry.Root>
      <AuthEntry.Card>
        <AuthEntry.Header>
          <AuthEntry.Title>Sign in</AuthEntry.Title>
          <AuthEntry.Description>
            Or{" "}
            <Link
              to="/sign-up"
              search={{ redirect: redirectPath }}
              className="text-primary underline-offset-4 hover:underline"
            >
              create an account
            </Link>
          </AuthEntry.Description>
        </AuthEntry.Header>

        <AuthEntry.Content>
          {/* TODO: Add Passkey authentication when WebAuthn is implemented */}

          {error && (
            <Alert id="sign-in-error" variant="destructive" className="mb-6">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-4"
              aria-describedby={error ? "sign-in-error" : undefined}
            >
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="name@example.com"
                        type="email"
                        autoComplete="email"
                        spellCheck={false}
                        disabled={isLoading || inviteFlow}
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
                        autoComplete="current-password"
                        spellCheck={false}
                        disabled={isLoading}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Signing in..." : "Sign in"}
              </Button>
            </form>
          </Form>
        </AuthEntry.Content>

        <AuthEntry.Footer className="justify-center">
          <Link
            to="/forgot-password"
            className="text-sm text-muted-foreground hover:text-primary underline-offset-4 hover:underline"
          >
            Forgot password?
          </Link>
        </AuthEntry.Footer>
      </AuthEntry.Card>
    </AuthEntry.Root>
  )
}
