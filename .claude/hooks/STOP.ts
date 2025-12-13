import type { HookJSONOutput } from "@anthropic-ai/claude-agent-sdk";

const output: HookJSONOutput = {
  decision: "approve",
  reason: "If you feel confident about the task completed, commit your changes and associate the commit sha with any planning doc that's used to keep track of the task. ",
};

console.log(JSON.stringify(output));