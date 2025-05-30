import { getSessionFromCookie } from "@/utils/auth"
import { NextResponse } from "next/server"
import { tryCatch } from "@/lib/try-catch"
import { getConfig } from "@/flags"

export async function GET() {
  const { data: session, error } = await tryCatch(getSessionFromCookie())
  const config = await getConfig()

  const headers = new Headers()
  headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0")
  headers.set("Pragma", "no-cache")
  headers.set("Expires", "0")

  if (error) {
    return NextResponse.json({
      session: null,
      config,
    }, {
      headers
    })
  }

  return NextResponse.json({
    session,
    config,
  }, {
    headers
  })
}
