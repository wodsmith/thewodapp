import {SeverityNumber} from '@opentelemetry/api-logs'

/**
 * PostHog OpenTelemetry Logger for Cloudflare Workers
 *
 * SERVERLESS ENVIRONMENT NOTES:
 * - This module uses module-level state to cache configuration (PostHog token, endpoint).
 * - Configuration is initialized once and assumed to remain stable throughout the module's lifetime.
 * - In Cloudflare Workers, modules are cached across requests, so environment variables
 *   must remain consistent between deployments.
 * - If environment variables change between deployments, restart the worker to pick up new values.
 *
 * PREVENTING LOG LOSS:
 * - Call setWaitUntil() at the start of each request with ctx.waitUntil from your Cloudflare context
 * - This ensures logs complete even after the response is sent
 */

export interface LogParams {
  message: string
  attributes?: Record<string, unknown>
  error?: unknown
  severityNumber?: SeverityNumber
  severityText?: string
}

export interface PostHogConfig {
  /** PostHog API key */
  apiKey: string
  /** PostHog logs endpoint (defaults to US endpoint) */
  endpoint?: string
  /** Service name for logs (defaults to "app") */
  serviceName?: string
  /** Service namespace (defaults to "web") */
  serviceNamespace?: string
  /** Deployment environment (defaults to "development") */
  environment?: string
  /** Whether to log to console in addition to PostHog */
  consoleLogging?: boolean
}

const DEFAULT_ENDPOINT = 'https://us.i.posthog.com/i/v1/logs'

let isPostHogEnabled = false
let posthogToken: string | undefined
let endpoint: string = DEFAULT_ENDPOINT
let serviceName: string = 'app'
let serviceNamespace: string = 'web'
let environment: string = 'development'
let consoleLogging: boolean = true

// Request-scoped waitUntil function for preventing log loss
let currentWaitUntil: ((promise: Promise<unknown>) => void) | undefined

/**
 * Configure the PostHog logger. Call this once at application startup.
 */
export function configurePostHog(config: PostHogConfig): void {
  posthogToken = config.apiKey
  endpoint = config.endpoint ?? DEFAULT_ENDPOINT
  serviceName = config.serviceName ?? 'app'
  serviceNamespace = config.serviceNamespace ?? 'web'
  environment = config.environment ?? 'development'
  consoleLogging = config.consoleLogging ?? true
  isPostHogEnabled = !!posthogToken
}

/**
 * Set the waitUntil function for the current request context.
 * Call this at the start of each request with ctx.waitUntil from your Cloudflare context.
 * This ensures logs complete even after the response is sent.
 *
 * @example
 * // In TanStack Start middleware or server function
 * import { setWaitUntil } from '@repo/posthog'
 *
 * setWaitUntil(ctx.waitUntil.bind(ctx))
 */
export function setWaitUntil(
  waitUntil: (promise: Promise<unknown>) => void,
): void {
  currentWaitUntil = waitUntil
}

/**
 * Clear the waitUntil function (call at end of request if needed)
 */
export function clearWaitUntil(): void {
  currentWaitUntil = undefined
}

/**
 * Send log directly to PostHog using fetch (Cloudflare Workers compatible)
 * Uses OTLP JSON format: https://opentelemetry.io/docs/specs/otlp/#json-protobuf-encoding
 */
function sendLogToPostHog(params: {
  message: string
  severityNumber: SeverityNumber
  severityText: string
  attributes: Record<string, unknown>
}) {
  if (!isPostHogEnabled || !posthogToken) return

  const now = Date.now()
  const body = {
    resourceLogs: [
      {
        resource: {
          attributes: [
            {key: 'service.name', value: {stringValue: serviceName}},
            {
              key: 'service.namespace',
              value: {stringValue: serviceNamespace},
            },
            {
              key: 'deployment.environment.name',
              value: {stringValue: environment},
            },
          ],
        },
        scopeLogs: [
          {
            scope: {name: 'posthog-otel-logger', version: '1.0.0'},
            logRecords: [
              {
                timeUnixNano: String(now * 1_000_000),
                severityNumber: params.severityNumber,
                severityText: params.severityText,
                body: {stringValue: params.message},
                attributes: Object.entries(params.attributes).map(
                  ([key, value]) => ({
                    key,
                    value: formatAttributeValue(value),
                  }),
                ),
              },
            ],
          },
        ],
      },
    ],
  }

  // Create the async fetch operation
  const fetchPromise = (async () => {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${posthogToken}`,
        },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        console.error(
          '[posthog-otel] Failed to send log:',
          response.status,
          await response.text(),
        )
      }
    } catch (_err) {
      console.error('[posthog-otel] Error sending log:', _err)
    }
  })()

  // Use waitUntil if available to prevent log loss
  if (currentWaitUntil) {
    try {
      currentWaitUntil(fetchPromise)
    } catch (_err) {
      // waitUntil failed, log will still be attempted
    }
  }
}

function formatAttributeValue(value: unknown): Record<string, unknown> {
  if (typeof value === 'string') {
    return {stringValue: value}
  }
  if (typeof value === 'number') {
    return Number.isInteger(value)
      ? {intValue: String(value)}
      : {doubleValue: value}
  }
  if (typeof value === 'boolean') {
    return {boolValue: value}
  }
  if (Array.isArray(value)) {
    return {
      arrayValue: {
        values: value.map((v) => formatAttributeValue(v)),
      },
    }
  }
  if (value !== null && typeof value === 'object') {
    return {stringValue: JSON.stringify(value)}
  }
  return {stringValue: String(value)}
}

function enrichAttributes({
  attributes,
  error,
  severityText,
}: Pick<LogParams, 'attributes' | 'error' | 'severityText'>) {
  if (!error) {
    return {...attributes, severity_text: severityText}
  }

  const errorValue =
    error instanceof Error
      ? {message: error.message, stack: error.stack}
      : {message: String(error)}

  return {
    ...attributes,
    severity_text: severityText,
    error: errorValue,
  }
}

/**
 * Emit to console as fallback when PostHog is disabled or console logging is enabled.
 */
function emitToConsole(
  severityText: string,
  message: string,
  attributes?: Record<string, unknown>,
  error?: unknown,
) {
  if (!consoleLogging && isPostHogEnabled) return

  const logData = attributes ? {...attributes} : {}
  if (error) {
    logData.error =
      error instanceof Error
        ? {message: error.message, stack: error.stack}
        : String(error)
  }

  const hasLogData = Object.keys(logData).length > 0

  switch (severityText) {
    case 'ERROR':
      if (hasLogData) {
        console.error(`[ERROR] ${message}`, logData)
      } else {
        console.error(`[ERROR] ${message}`)
      }
      break
    case 'WARN':
      if (hasLogData) {
        console.warn(`[WARN] ${message}`, logData)
      } else {
        console.warn(`[WARN] ${message}`)
      }
      break
    default:
      if (hasLogData) {
        console.info(`[INFO] ${message}`, logData)
      } else {
        console.info(`[INFO] ${message}`)
      }
  }
}

export function logInfo(params: LogParams) {
  const severityNumber = params.severityNumber ?? SeverityNumber.INFO
  const severityText = params.severityText ?? 'INFO'

  sendLogToPostHog({
    message: params.message,
    severityNumber,
    severityText,
    attributes: enrichAttributes({
      attributes: params.attributes,
      error: params.error,
      severityText,
    }),
  })

  emitToConsole(severityText, params.message, params.attributes, params.error)
}

export function logWarning(params: LogParams) {
  const severityText = params.severityText ?? 'WARN'
  const severityNumber = params.severityNumber ?? SeverityNumber.WARN

  sendLogToPostHog({
    message: params.message,
    severityNumber,
    severityText,
    attributes: enrichAttributes({
      attributes: params.attributes,
      error: params.error,
      severityText,
    }),
  })

  emitToConsole(severityText, params.message, params.attributes, params.error)
}

export function logError(params: LogParams) {
  const severityText = params.severityText ?? 'ERROR'
  const severityNumber = params.severityNumber ?? SeverityNumber.ERROR

  sendLogToPostHog({
    message: params.message,
    severityNumber,
    severityText,
    attributes: enrichAttributes({
      attributes: params.attributes,
      error: params.error,
      severityText,
    }),
  })

  emitToConsole(severityText, params.message, params.attributes, params.error)
}

/**
 * Debug logging - only emitted to console, never sent to PostHog.
 * Use this for temporary debugging statements.
 */
export function logDebug(
  params: Omit<LogParams, 'severityNumber' | 'severityText'>,
) {
  if (!consoleLogging) return

  const logData = params.attributes ? {...params.attributes} : {}
  if (params.error) {
    logData.error =
      params.error instanceof Error
        ? {message: params.error.message, stack: params.error.stack}
        : String(params.error)
  }

  const hasLogData = Object.keys(logData).length > 0
  if (hasLogData) {
    console.debug(`[DEBUG] ${params.message}`, logData)
  } else {
    console.debug(`[DEBUG] ${params.message}`)
  }
}

/**
 * Flush all pending logs. Call this before process shutdown.
 * No-op with fetch-based implementation since logs are sent immediately.
 */
export async function flushLogs(): Promise<void> {
  // No-op - logs are sent immediately with fetch
}
