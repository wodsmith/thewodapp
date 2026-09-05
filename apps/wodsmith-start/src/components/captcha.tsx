"use client"

import { Turnstile } from "@marsidev/react-turnstile"
import { useServerFn } from "@tanstack/react-start"
import { type ComponentProps, useEffect, useState } from "react"
import { getTurnstileConfigFn } from "@/lib/env"
import { FormMessage } from "./ui/form"

type Props = Omit<ComponentProps<typeof Turnstile>, "siteKey"> & {
  validationError?: string
  onReadyChange?: (ready: boolean) => void
}

export function Captcha({ validationError, onReadyChange, ...props }: Props) {
  const loadConfig = useServerFn(getTurnstileConfigFn)
  const [config, setConfig] = useState<{ enabled: boolean; siteKey: string }>()
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    loadConfig().then(
      (value) => {
        if (active) setConfig(value)
      },
      () => {
        if (active) setFailed(true)
      },
    )
    return () => {
      active = false
    }
  }, [loadConfig])

  useEffect(() => {
    onReadyChange?.(config?.enabled === false)
  }, [config?.enabled, onReadyChange])

  if (failed || (config?.enabled && !config.siteKey)) {
    return (
      <p role="alert">
        Security check unavailable. Please reload and try again.
      </p>
    )
  }
  if (!config) return <output>Loading security check…</output>
  if (!config.enabled) return null

  return (
    <>
      <Turnstile
        options={{
          size: "flexible",
          language: "auto",
        }}
        {...props}
        siteKey={config.siteKey}
        onSuccess={(token) => {
          onReadyChange?.(true)
          props.onSuccess?.(token)
        }}
        onExpire={(token) => {
          onReadyChange?.(false)
          props.onExpire?.(token)
        }}
        onError={(error) => {
          onReadyChange?.(false)
          return props.onError?.(error)
        }}
        onTimeout={() => {
          onReadyChange?.(false)
          props.onTimeout?.()
        }}
      />

      {validationError && (
        <FormMessage className="text-red-500 mt-2">
          {validationError}
        </FormMessage>
      )}
    </>
  )
}
