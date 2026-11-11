// Production start for a non-Docker deployment.
//
// `next.config.ts` uses `output: "standalone"`, so the server bundle lives in
// `.next/standalone/server.js`. Next warns (and will eventually refuse) when
// `next start` is used against a standalone build, so this wrapper starts the
// standalone server directly.
//
// The standalone output intentionally omits `public/` and `.next/static/`
// because the Docker image copies them in explicitly; for a local production
// run we mirror them in first so CSS, JS and fonts resolve.

import { cpSync, existsSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import nextEnv from "@next/env";

const root = process.cwd();

// The standalone bundle does not contain `.env*` files, and Next only loads env
// from its own directory. Load the project's env the same way `next build` does
// so a non-Docker production start behaves like the build did.
process.env.NODE_ENV = "production";
nextEnv.loadEnvConfig(root, false);

const standalone = path.join(root, ".next", "standalone");
const serverEntry = path.join(standalone, "server.js");

if (!existsSync(serverEntry)) {
  console.error(
    "[start] No standalone build found at .next/standalone/server.js. Run `npm run build` first.",
  );
  process.exit(1);
}

const assets = [
  [path.join(root, "public"), path.join(standalone, "public")],
  [path.join(root, ".next", "static"), path.join(standalone, ".next", "static")],
];

for (const [from, to] of assets) {
  if (existsSync(from)) cpSync(from, to, { recursive: true });
}

const child = spawn(process.execPath, [serverEntry], {
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_ENV: "production",
    PORT: process.env.PORT ?? "3000",
    HOSTNAME: process.env.HOSTNAME ?? "0.0.0.0",
  },
});

child.on("exit", (code) => process.exit(code ?? 0));
child.on("error", (error) => {
  console.error("[start] failed to launch standalone server", error);
  process.exit(1);
});
