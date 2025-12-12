/**
 * Browser-safe stub for vinxi/http
 * These functions throw errors because they should only be called on the server.
 * The actual vinxi/http module is used in the SSR build.
 */

export function headers(): never {
	throw new Error("vinxi/http headers() cannot be called in the browser")
}

export function getCookie(_name: string): never {
	throw new Error("vinxi/http getCookie() cannot be called in the browser")
}

export function setCookie(_name: string, _value: string, _options?: unknown): never {
	throw new Error("vinxi/http setCookie() cannot be called in the browser")
}

export function deleteCookie(_name: string, _options?: unknown): never {
	throw new Error("vinxi/http deleteCookie() cannot be called in the browser")
}

export function getHeader(_name: string): never {
	throw new Error("vinxi/http getHeader() cannot be called in the browser")
}

export function setHeader(_name: string, _value: string): never {
	throw new Error("vinxi/http setHeader() cannot be called in the browser")
}

export function getRequestEvent(): never {
	throw new Error("vinxi/http getRequestEvent() cannot be called in the browser")
}
