/**
 * Integration test setup: polyfills and global mocks for jsdom environment.
 * Import this in integration tests or add to setupFiles.
 */

// Polyfill matchMedia (used by DarkModeToggle, media queries, etc.)
// Uses a plain function (not vi.fn) so it survives vitest mockReset.
if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}

// Polyfill ResizeObserver
if (typeof ResizeObserver === 'undefined') {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof globalThis.ResizeObserver
}

// Polyfill IntersectionObserver
if (typeof IntersectionObserver === 'undefined') {
  global.IntersectionObserver = class IntersectionObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
    readonly root = null
    readonly rootMargin = ''
    readonly thresholds: number[] = []
    takeRecords() {
      return []
    }
  } as unknown as typeof globalThis.IntersectionObserver
}
