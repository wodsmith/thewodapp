export function getAuthorizationServerUrl(request: Request, env: Env): string {
  if (env.WODSMITH_AUTHORIZATION_SERVER_URL) {
    return env.WODSMITH_AUTHORIZATION_SERVER_URL.replace(/\/$/, "")
  }

  const url = new URL(request.url)
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
    return "http://localhost:3000"
  }

  return "https://wodsmith.com"
}

export function protectedResourceMetadata(
  request: Request,
  env: Env,
): Response {
  const resource = new URL(request.url).origin
  return Response.json(
    {
      resource,
      authorization_servers: [getAuthorizationServerUrl(request, env)],
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  )
}
