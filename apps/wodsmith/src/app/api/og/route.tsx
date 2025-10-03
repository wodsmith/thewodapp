import { ImageResponse } from "next/og";

export async function GET(request: Request) {
	try {
		const { searchParams } = new URL(request.url);

		// ?title=<title>
		const hasTitle = searchParams.has("title");
		const title = hasTitle
			? searchParams.get("title")?.slice(0, 100)
			: "My default title";

		return new ImageResponse(
			<div
				style={{
					height: "100%",
					width: "100%",
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
					backgroundColor: "black",
					position: "relative",
					borderRadius: "10px",
					border: "2px solid #fff",
				}}
			>
				<h2 tw="flex flex-row text-xl font-bold tracking-tight text-gray-900 text-left items-center absolute bottom-0 left-0">
					{/* @ts-ignore - Satori tw prop not recognized by TypeScript */}
					<img
						alt="spicy-wod"
						height={40}
						src="https://github.com/zacjones93/spicy-wod-3/blob/main/public/wodsmith-logo-no-text.png?raw=true"
						width={40}
						tw="ml-10 mr-2"
					/>
					<span tw="text-white">WODsmith</span>
				</h2>
				<div tw="bg-black flex">
					<div tw="flex flex-col md:flex-row w-full py-12 px-4 md:items-center justify-center p-8">
						<div tw="mt-8 flex md:mt-0 text-white text-4xl">{title}</div>
					</div>
				</div>
			</div>,
			{
				width: 1200,
				height: 630,
			},
		);
	} catch (e: unknown) {
		if (typeof e === "object" && e !== null && "message" in e) {
			console.log(`${(e as { message: string }).message}`);
		} else {
			console.log("Unknown error", e);
		}
		return new Response("Failed to generate the image", {
			status: 500,
		});
	}
}
