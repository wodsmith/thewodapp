/** Local-only, synthetic-fixture smoke harness. Never route/export from the app Worker. */
import { inferWorkoutImport } from "../src/server/workout-import/inference"
import { awaitImportResult, IMPORT_LIMITS, readBoundedBody } from "../src/server/workout-import/limits"

export default {
  async fetch(request: Request, env: { AI: Ai; SMOKE_GATEWAY: string }) {
    if (new URL(request.url).hostname !== "127.0.0.1" || request.method !== "POST" || request.headers.has("origin")) return new Response("Local smoke only", {status:403})
    const payload = JSON.parse(new TextDecoder().decode(await readBoundedBody(request.body, 2_000_000))) as { text: string; imageBase64?: string }
    const controller = new AbortController()
    const timer = setTimeout(()=>controller.abort("timeout"),IMPORT_LIMITS.timeoutMs)
    let dispatches=0
    let usage: unknown
    const provider: unknown[] = []
    const ai = { run: async (...args: Parameters<Ai["run"]>) => {
      try {
        const response = await env.AI.run(...args)
        if (response instanceof Response) provider.push({status:response.status,contentType:response.headers.get("content-type"),...(!response.ok?{error:await response.clone().text()}: {})})
        return response
      } catch(error) { provider.push({error:error instanceof Error?error.message:"binding failed"});throw error }
    } } as Pick<Ai,"run">
    const started=Date.now()
    try {
      const proposal = await awaitImportResult(inferWorkoutImport({ai,gatewayId:env.SMOKE_GATEWAY,text:payload.text,imageBase64:payload.imageBase64,signal:controller,beforeDispatch:async()=>{dispatches++},checkAccess:async()=>{},movements:[],onUsage:value=>{usage=value}}),controller)
      return Response.json({proposal,dispatches,usage,provider,durationMs:Date.now()-started,liveModel:true})
    } catch(error) {
      return Response.json({error:error instanceof Error?error.message:"failed",provider,dispatches,durationMs:Date.now()-started,liveModel:true},{status:502})
    } finally { clearTimeout(timer) }
  },
}
