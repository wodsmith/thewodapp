/**
 * OAuth consent page for the WODsmith MCP server.
 *
 * Reached when an MCP client redirects the user to /oauth/authorize?... — the
 * full URL is parsed by `@cloudflare/workers-oauth-provider` via the helper
 * server functions in `@/server-fns/oauth-fns`.
 *
 * Flow:
 * 1. Anonymous user → redirect to /sign-in with `?redirect=` back here.
 * 2. Logged-in user → render the requested client + scope checklist.
 * 3. On Approve → call `completeAuthorizeFn` and follow the returned redirect
 *    back to the client's `redirect_uri` with a code attached.
 * 4. On Deny → redirect back to the client with `error=access_denied`.
 */

import { createFileRoute, redirect, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { useState } from "react"
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
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { type McpScope, SCOPE_DESCRIPTIONS } from "@/mcp/scopes"
import { getSessionFn } from "@/server-fns/auth-fns"
import {
  type AuthorizeConsentInfo,
  completeAuthorizeFn,
  getAuthorizeConsentInfoFn,
} from "@/server-fns/oauth-fns"

interface AuthorizeSearch {
  response_type?: string
  client_id?: string
  redirect_uri?: string
  scope?: string
  state?: string
  code_challenge?: string
  code_challenge_method?: string
}

export const Route = createFileRoute("/oauth/authorize")({
  validateSearch: (search: Record<string, unknown>): AuthorizeSearch => ({
    response_type: (search.response_type as string) || undefined,
    client_id: (search.client_id as string) || undefined,
    redirect_uri: (search.redirect_uri as string) || undefined,
    scope: (search.scope as string) || undefined,
    state: (search.state as string) || undefined,
    code_challenge: (search.code_challenge as string) || undefined,
    code_challenge_method:
      (search.code_challenge_method as string) || undefined,
  }),
  beforeLoad: async ({ location }) => {
    const session = await getSessionFn()
    if (!session) {
      throw redirect({
        to: "/sign-in",
        search: { redirect: `${location.pathname}${location.searchStr}` },
      })
    }
  },
  loader: async ({
    location,
  }): Promise<{ consent: AuthorizeConsentInfo; authorizeUrl: string }> => {
    // The auth provider needs the raw URL to parse OAuth params; the easiest
    // way to reconstruct it is to combine the route path with the original
    // search string preserved by TanStack Router.
    const authorizeUrl = `https://placeholder${location.pathname}${location.searchStr}`
    const consent = await getAuthorizeConsentInfoFn({ data: { authorizeUrl } })
    return { consent, authorizeUrl }
  },
  component: AuthorizePage,
})

function AuthorizePage() {
  const data = Route.useLoaderData() as {
    consent: AuthorizeConsentInfo
    authorizeUrl: string
  }
  const { consent, authorizeUrl } = data
  const search = Route.useSearch() as {
    redirect_uri?: string
    state?: string
  }
  const router = useRouter()
  const completeAuthorize = useServerFn(completeAuthorizeFn)

  const [selected, setSelected] = useState<McpScope[]>(
    consent.defaultGrantedScopes,
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggle = (scope: McpScope, checked: boolean) => {
    setSelected((prev) =>
      checked
        ? [...new Set([...prev, scope])]
        : prev.filter((s) => s !== scope),
    )
  }

  const onApprove = async () => {
    setError(null)
    setIsSubmitting(true)
    try {
      const { redirectTo } = await completeAuthorize({
        data: { authorizeUrl, grantedScopes: selected },
      })
      window.location.href = redirectTo
    } catch (e) {
      setError(e instanceof Error ? e.message : "Authorization failed")
      setIsSubmitting(false)
    }
  }

  const onDeny = () => {
    const redirectUri = search.redirect_uri
    if (!redirectUri) {
      router.navigate({ to: "/" })
      return
    }
    let url: URL
    try {
      url = new URL(redirectUri)
    } catch {
      router.navigate({ to: "/" })
      return
    }
    if (!consent.client.redirectUris.includes(redirectUri)) {
      router.navigate({ to: "/" })
      return
    }
    url.searchParams.set("error", "access_denied")
    if (search.state) url.searchParams.set("state", search.state)
    window.location.href = url.toString()
  }

  const supportedSet = new Set<string>(consent.supportedScopes)
  const unknownScopes = consent.requestedScopes.filter(
    (s: string) => !supportedSet.has(s),
  )

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Authorize {consent.client.clientName}</CardTitle>
          <CardDescription>
            {consent.client.clientName} is requesting access to your WODsmith
            competitions. Choose what to share.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {consent.client.clientUri && (
            <p className="text-xs text-muted-foreground">
              Client URL:{" "}
              <a
                href={consent.client.clientUri}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                {consent.client.clientUri}
              </a>
            </p>
          )}

          <div className="space-y-3">
            <p className="text-sm font-medium">Requested permissions</p>
            {consent.supportedScopes.map((scope) => {
              const requested = consent.requestedScopes.includes(scope)
              const checkboxId = `scope-${scope.replace(":", "-")}`
              return (
                <div
                  key={scope}
                  className="flex items-start gap-3 rounded-md border p-3"
                >
                  <Checkbox
                    id={checkboxId}
                    checked={selected.includes(scope)}
                    onCheckedChange={(checked) =>
                      toggle(scope, checked === true)
                    }
                    disabled={!requested}
                  />
                  <div className="space-y-1">
                    <Label htmlFor={checkboxId} className="font-mono text-xs">
                      {scope}
                    </Label>
                    <p className="text-sm">{SCOPE_DESCRIPTIONS[scope]}</p>
                    {!requested && (
                      <p className="text-xs text-muted-foreground">
                        Not requested by this client.
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {unknownScopes.length > 0 && (
            <Alert variant="default">
              <AlertDescription>
                The client requested unknown scopes which will be ignored:{" "}
                <span className="font-mono">{unknownScopes.join(", ")}</span>
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
        <CardFooter className="flex justify-end gap-2">
          <Button variant="outline" onClick={onDeny} disabled={isSubmitting}>
            Deny
          </Button>
          <Button
            onClick={onApprove}
            disabled={isSubmitting || selected.length === 0}
          >
            {isSubmitting ? "Authorizing…" : "Approve"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
