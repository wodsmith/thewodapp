import {vi} from 'vitest'

// Mock for cloudflare:workers module
// This provides a mock KV store for testing
// The actual mock functions are set up in individual test files

// Create a mutable mock that tests can configure
export const mockKV = {
  get: vi.fn().mockResolvedValue(null),
  put: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(undefined),
}

export const env = {
  KV_SESSION: mockKV,
}
