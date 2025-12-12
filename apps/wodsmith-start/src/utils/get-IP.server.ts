import { headers } from "vinxi/http"

export async function getIP() {
	const headersList = await headers()

	const ip =
		headersList.get("cf-connecting-ip") ||
		headersList.get("x-forwarded-for") ||
		headersList.get("x-real-ip") ||
		headersList.get("true-client-ip") ||
		headersList.get("x-client-ip") ||
		headersList.get("x-cluster-client-ip") ||
		null

	if (!ip) {
		return null
	}

	return ip
}
