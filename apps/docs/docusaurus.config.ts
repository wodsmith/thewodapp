import { themes as prismThemes } from "prism-react-renderer";
import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

const config: Config = {
	title: "WodSmith Docs",
	tagline: "Documentation for WodSmith - Workout Management for CrossFit Gyms",
	favicon: "img/favicon.ico",

	future: {
		v4: true,
	},

	url: "https://docs.wadsmith.com",
	baseUrl: "/",

	organizationName: "wodsmith",
	projectName: "thewodapp",

	onBrokenLinks: "throw",

	i18n: {
		defaultLocale: "en",
		locales: ["en"],
	},

	presets: [
		[
			"classic",
			{
				docs: {
					sidebarPath: "./sidebars.ts",
					editUrl: "https://github.com/wodsmith/thewodapp/tree/main/apps/docs/",
					routeBasePath: "/",
				},
				blog: false,
				theme: {
					customCss: "./src/css/custom.css",
				},
			} satisfies Preset.Options,
		],
	],

	themeConfig: {
		image: "img/wodsmith-social-card.jpg",
		colorMode: {
			defaultMode: "dark",
			respectPrefersColorScheme: true,
		},
		navbar: {
			title: "WodSmith",
			logo: {
				alt: "WodSmith Logo",
				src: "img/logo.svg",
			},
			items: [
				{
					type: "docSidebar",
					sidebarId: "docsSidebar",
					position: "left",
					label: "Documentation",
				},
				{
					href: "https://app.wadsmith.com",
					label: "App",
					position: "right",
				},
				{
					href: "https://github.com/wodsmith/thewodapp",
					label: "GitHub",
					position: "right",
				},
			],
		},
		footer: {
			style: "dark",
			links: [
				{
					title: "Learn",
					items: [
						{
							label: "Tutorials",
							to: "/category/tutorials",
						},
						{
							label: "How-to Guides",
							to: "/category/how-to-guides",
						},
					],
				},
				{
					title: "Understand",
					items: [
						{
							label: "Concepts",
							to: "/category/concepts",
						},
						{
							label: "Reference",
							to: "/category/reference",
						},
					],
				},
				{
					title: "Product",
					items: [
						{
							label: "WodSmith App",
							href: "https://app.wadsmith.com",
						},
						{
							label: "GitHub",
							href: "https://github.com/wodsmith/thewodapp",
						},
					],
				},
			],
			copyright: `Copyright © ${new Date().getFullYear()} WodSmith. Built with Docusaurus.`,
		},
		prism: {
			theme: prismThemes.github,
			darkTheme: prismThemes.dracula,
			additionalLanguages: ["bash", "typescript", "json"],
		},
	} satisfies Preset.ThemeConfig,
};

export default config;
