import { cp, mkdir, rm, copyFile } from "node:fs/promises";

// Normalize TanStack/Nitro's Cloudflare output to the layout expected by Sites.
// Sites binds the public files from `client`. Nitro delegates public requests
// to that binding, so duplicating the same assets under `public` is unnecessary
// and would make the deployment archive needlessly large.
await rm("dist", { recursive: true, force: true });
await mkdir("dist/server", { recursive: true });
await cp(".output/server", "dist/server", { recursive: true });
await cp(".output/public", "dist/client", { recursive: true });
await copyFile("dist/server/index.mjs", "dist/server/index.js");
