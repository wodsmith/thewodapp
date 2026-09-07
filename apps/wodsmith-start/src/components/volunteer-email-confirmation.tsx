import { useServerFn } from "@tanstack/react-start"
import { useEffect, useRef, useState } from "react"
import { confirmVolunteerSignupFn } from "@/server-fns/volunteer-fns"

export function VolunteerEmailConfirmation({ code }: { code: string }) {
  const confirm = useServerFn(confirmVolunteerSignupFn)
  const request = useRef<{
    code: string
    promise: ReturnType<typeof confirm>
  } | null>(null)
  const [result, setResult] = useState<{ returnPath: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    // StrictMode's second effect subscribes to the same single-use redemption.
    if (request.current?.code !== code) {
      request.current = { code, promise: confirm({ data: { code } }) }
    }
    request.current.promise.then(
      (response) => {
        if (active) setResult(response)
      },
      (failure: unknown) => {
        if (active)
          setError(
            failure instanceof Error
              ? failure.message
              : "Unable to confirm application",
          )
      },
    )
    return () => {
      active = false
    }
  }, [code, confirm])

  return (
    <div
      className="mx-auto max-w-lg space-y-4 rounded-lg border bg-card p-6 my-12"
      aria-live="polite"
    >
      <h1 className="text-2xl font-bold">
        {result
          ? "Volunteer application confirmed"
          : error
            ? "Unable to confirm application"
            : "Confirming your application…"}
      </h1>
      {result ? (
        <>
          <p>
            Your application has been submitted and you are signed in. The
            organizers will review your details and contact you with next steps.
          </p>
          <a className="underline" href={result.returnPath}>
            Return to competition
          </a>
        </>
      ) : error ? (
        <>
          <p role="alert">{error}</p>
          <p>
            If this link has already been used, your application may already be
            saved. Sign in to check it, or request a new confirmation from the
            competition volunteer form.
          </p>
        </>
      ) : (
        <p>
          Your saved answers and waiver agreements are being submitted. There is
          nothing to enter again.
        </p>
      )}
    </div>
  )
}
