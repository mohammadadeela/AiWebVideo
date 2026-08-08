import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { build as esbuild } from "esbuild";
import { rm, readdir } from "node:fs/promises";

globalThis.require = createRequire(import.meta.url);

const artifactDir = path.dirname(fileURLToPath(import.meta.url));
const testSrcDir = path.resolve(artifactDir, "test");
const outDir = path.resolve(artifactDir, "dist-test");

// Bundle the TypeScript test files with the same platform assumptions as the
// production build, then run them with the built-in node:test runner.
async function run() {
  await rm(outDir, { recursive: true, force: true });
  const entryPoints = (await readdir(testSrcDir))
    .filter((name) => name.endsWith(".test.ts"))
    .map((name) => path.resolve(testSrcDir, name));
  if (entryPoints.length === 0) {
    console.error("No test files found in test/.");
    process.exit(1);
  }

  await esbuild({
    entryPoints,
    platform: "node",
    bundle: true,
    format: "esm",
    outdir: outDir,
    outExtension: { ".js": ".mjs" },
    logLevel: "warning",
    external: ["*.node", "@google/*", "firebase-admin", "playwright", "pg-native", "pino", "pino-http", "pino-pretty"],
    sourcemap: "inline",
  });

  const files = (await readdir(outDir)).filter((name) => name.endsWith(".test.mjs")).map((name) => path.join(outDir, name));
  const child = spawn(process.execPath, ["--test", ...files], { stdio: "inherit" });
  child.on("exit", (code) => process.exit(code ?? 1));
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
