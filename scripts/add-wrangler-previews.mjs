import { readFile, writeFile } from "node:fs/promises";

// Cloudflare's non-production builds run `wrangler preview`, which needs a `previews` block.
const file = new URL("../.output/server/wrangler.json", import.meta.url);
const config = JSON.parse(await readFile(file, "utf8"));
config.previews ??= {};
await writeFile(file, `${JSON.stringify(config, null, 2)}\n`);
