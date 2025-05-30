import { parseWranglerConfig } from './utils/parse-wrangler.mjs';

try {
  const config = parseWranglerConfig();
  const kvId = config.kv_namespaces?.[0]?.id;

  if (!kvId) {
    console.error('KV namespace ID not found in wrangler.jsonc');
    process.exit(1);
  }

  console.log(kvId);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
