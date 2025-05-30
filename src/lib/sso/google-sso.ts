import "server-only"

import { SITE_URL } from "@/constants";
import { Google } from "arctic";

export const getGoogleSSOClient = () => {
  return new Google(
    process.env.GOOGLE_CLIENT_ID ?? "",
    process.env.GOOGLE_CLIENT_SECRET ?? "",
    `${SITE_URL}/sso/google/callback`
  )
}
