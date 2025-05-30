export interface JsonResponseOptions {
  status?: number
  headers?: Record<string, string>
}

export function jsonResponse(
  data: Record<string, unknown>,
  options: JsonResponseOptions = {}
) {
  const { status = 200, headers = {} } = options

  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  })
}
