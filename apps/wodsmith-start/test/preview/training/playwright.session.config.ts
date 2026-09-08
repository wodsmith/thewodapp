import { fileURLToPath } from "node:url"
import { defineConfig } from "@playwright/test"
const port = 8778
const baseURL = `http://127.0.0.1:${port}`
export default defineConfig({
 testDir: ".",
 testMatch: "my-session.spec.ts",
 webServer: {command:`pnpm exec vite --config test/preview/training/vite.track.config.ts --port ${port}`, cwd:fileURLToPath(new URL("../../../", import.meta.url)), url:`${baseURL}/training`, reuseExistingServer:false, timeout:60000},
 fullyParallel:false,
 workers:1,
 use:{baseURL,browserName:"chromium",trace:"retain-on-failure"},
 projects:[{name:"desktop",use:{viewport:{width:1440,height:1000}}},{name:"mobile",use:{viewport:{width:390,height:844}}}],
 outputDir:"/private/tmp/session-ux-playwright-results",
})
