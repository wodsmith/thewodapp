import handler, { createServerEntry } from "@tanstack/react-start/server-entry"

const startEntry = createServerEntry({
	fetch(request) {
		return handler.fetch(request)
	},
})

export default {
	fetch: startEntry.fetch,
}
