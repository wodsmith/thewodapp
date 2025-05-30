import { parseWranglerConfig } from './utils/parse-wrangler.mjs';

try {
  const config = parseWranglerConfig();
  const dbId = config.d1_databases?.[0]?.database_id;

  if (!dbId) {
    console.error('Database ID not found in wrangler.jsonc');
    process.exit(1);
  }

  console.log(dbId);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
