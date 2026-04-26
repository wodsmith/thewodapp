import { standardSchemaResolver } from "@hookform/resolvers/standard-schema"
import {
  createFileRoute,
  Link,
  redirect,
  useRouter,
} from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { Captcha } from "@/components/captcha"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
import { REDIRECT_AFTER_SIGN_IN } from "@/constants"
import { useIdentifyUser, useTrackEvent } from "@/lib/posthog/hooks"
import {
  getSessionFn,
  type SignUpInput,
  signUpFn,
  signUpSchema,
  validateClaimTokenFn,
} from "@/server-fns/auth-fns"

export const Route = createFileRoute("/_auth/sign-up")({
  component: SignUpPage,
  validateSearch: (
    search: Record<string, unknown>,
  ): {
    redirect: string
    claim?: string
    invite?: string
    email?: string
  } => ({
    redirect: (search.redirect as string) || REDIRECT_AFTER_SIGN_IN,
    claim: (search.claim as string) || undefined,
    invite: (search.invite as string) || undefined,
    email: (search.email as string) || undefined,
  }),
  beforeLoad: async ({ search }) => {
    const session = await getSessionFn()
    const redirectPath =
      (search as { redirect?: string }).redirect || REDIRECT_AFTER_SIGN_IN

    if (session) {
      throw redirect({ to: redirectPath })
    }

    const claim = (search as { claim?: string }).claim
    if (claim) {
      const result = await validateClaimTokenFn({ data: { token: claim } })
      if (result.valid) {
        return {
          claimValid: true as const,
          claimEmail: result.email,
          claimFirstName: result.firstName,
          claimLastName: result.lastName,
        }
      }
      return {
        claimValid: false as const,
        claimError: result.error,
      }
    }

    return {}
  },
})

function SignUpPage() {
  const router = useRouter()
  const {
    redirect: redirectPath,
    claim,
    invite,
    email: inviteEmailParam,
  } = Route.useSearch()
  const routeData = Route.useRouteContext()
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [needsVerification, setNeedsVerification] = useState(false)

  // PostHog tracking hooks
  const trackEvent = useTrackEvent()
  const identifyUser = useIdentifyUser()

  // Use useServerFn for client-side calls
  const signUp = useServerFn(signUpFn)

  const claimValid =
    "claimValid" in routeData ? routeData.claimValid : undefined
  const claimEmail =
    "claimEmail" in routeData ? (routeData.claimEmail as string | null) : null
  const claimFirstName =
    "claimFirstName" in routeData
      ? (routeData.claimFirstName as string | null)
      : null
  const claimLastName =
    "claimLastName" in routeData
      ? (routeData.claimLastName as string | null)
      : null
  const claimError =
    "claimError" in routeData ? (routeData.claimError as string) : undefined

  // Invite flow only locks the email field when both an invite token and
  // an email are present. A bare `?invite=` would otherwise disable the
  // field with an empty value and stop sign-up cold.
  const inviteFlow = !!invite && !!inviteEmailParam

  const form = useForm<SignUpInput>({
    resolver: standardSchemaResolver(signUpSchema),
    defaultValues: {
      email: inviteFlow ? (inviteEmailParam ?? "") : "",
      firstName: "",
      lastName: "",
      password: "",
    },
  })

  // Pre-fill form when claim token is valid
  useEffect(() => {
    if (claimValid && claimEmail) {
      form.setValue("email", claimEmail)
    }
    if (claimValid && claimFirstName) {
      form.setValue("firstName", claimFirstName)
    }
    if (claimValid && claimLastName) {
      form.setValue("lastName", claimLastName)
    }
  }, [claimValid, claimEmail, claimFirstName, claimLastName, form])

  const onSubmit = async (data: SignUpInput) => {
    try {
      setIsLoading(true)
      setError(null)

      const result = await signUp({
        data: {
          ...data,
          claimToken: claim,
        },
      })

      // Check if email verification is required
      if (result.requiresVerification) {
        setNeedsVerification(true)
        trackEvent("user_signed_up", {
          auth_method: "email_password",
          requires_verification: true,
        })
        return
      }

      // Identify user and track successful sign-up
      identifyUser(result.userId, {
        email: data.email,
        first_name: data.firstName,
        last_name: data.lastName,
      })
      trackEvent("user_signed_up", { auth_method: "email_password" })

      // Redirect to the intended destination
      router.navigate({ to: redirectPath })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Sign-up failed"
      setError(errorMessage)
      console.error("Sign-up error:", err)

      // Track failed sign-up attempt
      trackEvent("user_signed_up_failed", { error_message: errorMessage })
    } finally {
      setIsLoading(false)
    }
  }

  // Show "check your email" state after signup without claim token
  if (needsVerification) {
    return (
      <div className="min-h-[90vh] flex items-center px-4 justify-center bg-background my-6 md:my-10">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Check Your Email</CardTitle>
            <CardDescription>
              We&apos;ve sent a verification email to your address. Please click
              the link in the email to verify your account before signing in.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              to="/sign-in"
              search={{ redirect: redirectPath }}
              className="w-full block"
            >
              <Button variant="outline" className="w-full">
                Go to Sign In
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Show error if claim token is invalid/expired
  if (claim && claimValid === false) {
    return (
      <div className="min-h-[90vh] flex items-center px-4 justify-center bg-background my-6 md:my-10">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Invalid Link</CardTitle>
            <CardDescription>
              {claimError || "This claim link is invalid or has expired."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground text-center">
              You can still create your account by signing up with your email
              address. You&apos;ll need to verify your email before signing in.
            </p>
            <Link to="/sign-up" search={{ redirect: redirectPath }}>
              <Button variant="outline" className="w-full">
                Sign Up Without Link
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-[90vh] flex items-center px-4 justify-center bg-background my-6 md:my-10">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">
            {claim && claimValid ? "Claim Your Account" : "Create Account"}
          </CardTitle>
          <CardDescription>
            {claim && claimValid ? (
              "Set your password to complete your account setup."
            ) : (
              <>
                Already have an account?{" "}
                <Link
                  to="/sign-in"
                  search={{ redirect: redirectPath }}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  Sign in
                </Link>
              </>
            )}
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
                        disabled={
                          isLoading ||
                          (claim != null && claimValid === true) ||
                          inviteFlow
                        }
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="John"
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
                    <FormLabel>Last Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Doe"
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

              <div className="flex flex-col justify-center items-center space-y-4 pt-2">
                <Captcha
                  onSuccess={(token: string) =>
                    form.setValue("captchaToken", token)
                  }
                  validationError={form.formState.errors.captchaToken?.message}
                />

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading
                    ? "Creating account..."
                    : claim && claimValid
                      ? "Claim Account"
                      : "Create Account"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>

        <CardFooter>
          <p className="text-xs text-center text-muted-foreground w-full">
            By signing up, you agree to our{" "}
            {/* TODO: Add terms and privacy routes */}
            <a
              href="/terms"
              className="text-primary underline-offset-4 hover:underline"
            >
              Terms of Service
            </a>{" "}
            and{" "}
            <a
              href="/privacy"
              className="text-primary underline-offset-4 hover:underline"
            >
              Privacy Policy
            </a>
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
