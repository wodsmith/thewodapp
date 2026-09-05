"use client"

import { useRouter } from "@tanstack/react-router"
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react"

import {
  capturePageleave,
  capturePageview,
  getPostHog,
  initPostHog,
  type posthog,
} from "./client"

interface PostHogContextValue {
  posthog: typeof posthog
}

const PostHogContext = createContext<PostHogContextValue | null>(null)

interface PostHogProviderProps {
  children: ReactNode
}

/**
 * PostHog Provider for TanStack Start applications.
 *
 * Handles:
 * - Client-side PostHog initialization
 * - Automatic pageview tracking on route changes
 * - Cleanup on unmount
 *
 * @example
 * ```tsx
 * // In __root.tsx RootDocument
 * <PostHogProvider>
 *   {children}
 * </PostHogProvider>
 * ```
 */
export function PostHogProvider({ children }: PostHogProviderProps) {
  const router = useRouter()
  const previousPathRef = useRef<string>("")

  // PostHog exception autocapture inserts a script into the document. Defer
  // initialization until the streamed document has loaded and React has had an
  // idle turn to hydrate lazy boundaries before third-party code mutates it.
  useEffect(() => {
    let idleCallbackId: number | undefined
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    let cancelled = false

    previousPathRef.current = window.location.pathname

    const initialize = () => {
      if (cancelled) return

      initPostHog()
      capturePageview()
    }

    const scheduleInitialization = () => {
      if ("requestIdleCallback" in window) {
        idleCallbackId = window.requestIdleCallback(initialize, {
          timeout: 2_000,
        })
      } else {
        timeoutId = setTimeout(initialize, 0)
      }
    }

    if (document.readyState === "complete") {
      scheduleInitialization()
    } else {
      window.addEventListener("load", scheduleInitialization, { once: true })
    }

    return () => {
      cancelled = true
      window.removeEventListener("load", scheduleInitialization)

      if (idleCallbackId !== undefined) {
        window.cancelIdleCallback(idleCallbackId)
      }
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId)
      }
    }
  }, [])

  // Track route changes
  useEffect(() => {
    const unsubscribe = router.subscribe("onResolved", (event) => {
      const newPath = event.toLocation.pathname

      // Only capture if path actually changed (avoid duplicate events)
      if (newPath !== previousPathRef.current) {
        capturePageview(event.toLocation.href)
        previousPathRef.current = newPath
      }
    })

    return () => {
      unsubscribe()
    }
  }, [router])

  // Capture page leave on unmount
  useEffect(() => {
    return () => {
      capturePageleave()
    }
  }, [])

  const value = useMemo<PostHogContextValue>(
    () => ({
      posthog: getPostHog(),
    }),
    [],
  )

  return (
    <PostHogContext.Provider value={value}>{children}</PostHogContext.Provider>
  )
}

/**
 * Hook to access the PostHog instance from context.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { posthog } = usePostHog()
 *
 *   const handleClick = () => {
 *     posthog.capture('button_clicked', { button: 'signup' })
 *   }
 *
 *   return <button onClick={handleClick}>Sign up</button>
 * }
 * ```
 */
export function usePostHog(): PostHogContextValue {
  const context = useContext(PostHogContext)

  if (!context) {
    throw new Error("usePostHog must be used within a PostHogProvider")
  }

  return context
}
