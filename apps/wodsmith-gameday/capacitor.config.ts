import type { CapacitorConfig } from "@capacitor/cli"

const config: CapacitorConfig = {
  appId: "com.wodsmith.gameday",
  appName: "WODsmith Gameday",
  webDir: "dist",
  server: {
    // In dev, point at the Vite dev server instead of bundled assets
    ...(process.env.NODE_ENV === "development"
      ? { url: "http://localhost:3001" }
      : {}),
  },
}

export default config
