import "server-only"

import { Google } from "arctic"
import { SITE_URL } from "@/constants"

export const getGoogleSSOClient = () => {
	return new Google(
		process.env.GOOGLE_CLIENT_ID ?? "",
		process.env.GOOGLE_CLIENT_SECRET ?? "",
		`${SITE_URL}/sso/google/callback`,
	)
}
