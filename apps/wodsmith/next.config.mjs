import withBundleAnalyzer from "@next/bundle-analyzer"
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare"

// added by create cloudflare to enable calling `getCloudflareContext()` in `next dev`
initOpenNextCloudflareForDev()

// TODO cache-control headers don't work for static files
/** @type {import('next').NextConfig} */
const nextConfig = {
	turbopack: {
		rules: {
		  '*.md': {
			loaders: ['raw-loader'],
			as: '*.js',
		  },
		},
	  },
	webpack: (config) => {
		config.module.rules.push({
			test: /\.md$/,
			type: 'asset/source',
		});
		return config;
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
