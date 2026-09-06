import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { build as esbuild } from "esbuild";
import { rm } from "node:fs/promises";

globalThis.require = createRequire(import.meta.url);

const artifactDir = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(artifactDir, "dist-test");

// Bundle and run the no-network AI-video prompt/pipeline smoke test.
async function run() {
  await rm(path.join(outDir, "render-smoke.mjs"), { force: true });
  await esbuild({
    entryPoints: [path.resolve(artifactDir, "test/render-smoke.ts")],
    platform: "node",
    bundle: true,
    format: "esm",
    outdir: outDir,
    outExtension: { ".js": ".mjs" },
    logLevel: "warning",
    external: ["*.node", "@google/*", "firebase-admin", "playwright", "pg-native", "pino", "pino-http", "pino-pretty"],
    sourcemap: "inline",
    banner: {
      js: "import { createRequire as __cr } from 'node:module'; globalThis.require = __cr(import.meta.url);",
    },
  });
  const child = spawn(process.execPath, [path.join(outDir, "render-smoke.mjs")], { stdio: "inherit" });
  child.on("exit", (code) => process.exit(code ?? 1));
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
