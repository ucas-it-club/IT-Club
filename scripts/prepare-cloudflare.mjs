import { copyFile, writeFile, access } from "node:fs/promises";

const root = new URL("../dist/client/", import.meta.url);

await access(new URL("_shell.html", root));

await copyFile(new URL("_shell.html", root), new URL("index.html", root));

await writeFile(new URL("_redirects", root), "/* /index.html 200\n");

console.log("Cloudflare Pages output ready: dist/client");
