import {getHeaders} from '@tanstack/react-start/server'

/**
 * Get client IP address from request headers
 * Works with Cloudflare and standard proxy headers
 */
export async function getIP(): Promise<string | null> {
  try {
    const headers = getHeaders()

    const ip =
      headers.get('cf-connecting-ip') ||
      headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      headers.get('x-real-ip') ||
      headers.get('true-client-ip') ||
      headers.get('x-client-ip') ||
      headers.get('x-cluster-client-ip') ||
      null

    return ip
  } catch {
    // Headers may not be available in all contexts
    return null
  }
}
