import withBundleAnalyzer from "@next/bundle-analyzer"
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare"

// added by create cloudflare to enable calling `getCloudflareContext()` in `next dev`
initOpenNextCloudflareForDev()

// TODO cache-control headers don't work for static files
/** @type {import('next').NextConfig} */
const nextConfig = {
	turbopack: {
		rules: {
			"*.md": {
				loaders: ["raw-loader"],
				as: "*.js",
			},
		},
	},
	webpack: (config) => {
		config.module.rules.push({
			test: /\.md$/,
			type: "asset/source",
		})
		return config
	},
	images: {
		remotePatterns: [
			{
				protocol: "https",
				hostname: "pub-14c651314867492fa9637e830cc729a3.r2.dev",
			},
		],
	},
	experimental: {
		typedRoutes: true,
	},
	eslint: {
		ignoreDuringBuilds: process.env.SKIP_LINTER === "true",
	},
	typescript: {
		ignoreBuildErrors: process.env.SKIP_LINTER === "true",
	},
}

export default process.env.ANALYZE === "true"
	? withBundleAnalyzer()(nextConfig)
	: nextConfig
