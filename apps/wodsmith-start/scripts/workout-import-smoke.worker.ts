/** Local-only, synthetic-fixture smoke harness. Never route/export from the app Worker. */
import { inferWorkoutImport } from "../src/server/workout-import/inference"
import { awaitImportResult, IMPORT_LIMITS, readBoundedBody, WorkoutImportRuntimeError } from "../src/server/workout-import/limits"

export default {
  async fetch(request: Request, env: { AI: Ai; SMOKE_GATEWAY: string }) {
    if (new URL(request.url).hostname !== "127.0.0.1" || request.method !== "POST" || request.headers.has("origin")) return new Response("Local smoke only", {status:403})
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
      const payload = JSON.parse(new TextDecoder().decode(await readBoundedBody(request.body, 2_000_000))) as { text: string; imageBase64?: string }
      if (!payload || typeof payload.text !== "string" || (payload.imageBase64 !== undefined && typeof payload.imageBase64 !== "string")) throw new WorkoutImportRuntimeError("invalid_source", 400)
      const proposal = await awaitImportResult(inferWorkoutImport({ai,gatewayId:env.SMOKE_GATEWAY,text:payload.text,imageBase64:payload.imageBase64,signal:controller,beforeDispatch:async()=>{dispatches++},checkAccess:async()=>{},movements:[],onUsage:value=>{usage=value}}),controller)
      return Response.json({proposal,dispatches,usage,provider,durationMs:Date.now()-started,liveModel:true})
    } catch(error) {
      const failure = error instanceof WorkoutImportRuntimeError ? error : new WorkoutImportRuntimeError(error instanceof SyntaxError ? "invalid_source" : "provider_error", error instanceof SyntaxError ? 400 : 502)
      return Response.json({error:failure.code,provider,dispatches,durationMs:Date.now()-started,liveModel:dispatches > 0},{status:failure.status})
    } finally { clearTimeout(timer) }
  },
}
