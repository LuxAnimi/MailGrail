//------------------------------------------------------------------------------
// How much of the work MailGrail does is paid at build time rather than per send.
//
// Two renders of the same template, measured against each other:
//
//   compiled   the emitted module, which is what a server actually runs --
//              one engine call against a template string baked in at build
//              time, measured once per engine so the choice is visible
//   authoring  React + MJML, which is the work the build does once, timed as
//              though a server were doing it for every message
//
// Not part of the site build. Timings are machine- and load-dependent, so
// regenerating them on every build would make docs:check fail constantly and
// mean nothing anyway. It writes its result to website/src/data/, which is
// committed and quoted with the machine it was taken on:
//
//     npm run bench:render
//------------------------------------------------------------------------------
import os from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import * as esbuild from "esbuild";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

globalThis.React = await import("react");
const { buildTemplates } = await import(path.join(REPO, "lib/src/cli/build-templates.js"));
const { loadMailgrailConfig } = await import(path.join(REPO, "lib/src/config/loadConfig.js"));
const { renderToStaticMarkup } = await import("react-dom/server");
const mjml2html = (await import("mjml")).default;

const params = { username: "Ada", email: "ada@example.com", isPro: true,
                 referralCode: "MG-1042", plan: "pro" };

// Inside the repo, not /tmp: the emitted module imports its engine by bare
// specifier, and from /tmp Node has no node_modules to resolve it from -- which
// is itself the point being measured.
const ENGINES = [
  { id: "EJS", module: "ejs" },
  { id: "Handlebars", module: "handlebars" },
  { id: "Mustache", module: "mustache" },
];

// Inside the repo, not /tmp: the emitted module imports its engine by bare
// specifier, and from /tmp Node has no node_modules to resolve it from -- which
// is itself the point being measured.
const dir = await mkdtemp(path.join(REPO, ".bench-"));
const config = await loadMailgrailConfig(path.join(REPO, "example/mailgrail.config.ts"));

function bench(label, fn, n) {
  for (let i = 0; i < Math.min(20, n); i++) fn();
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < n; i++) fn();
  const per = Number(process.hrtime.bigint() - t0) / 1e6 / n;
  console.log(`  ${label.padEnd(30)} ${per.toFixed(3)} ms/render  (${n} runs)`);
  return per;
}

const RUNS = { compiled: 20000, authoring: 400 };

// --- what ships, once per engine ------------------------------------------
const results = [];
for (const engine of ENGINES) {
  const out = path.join(dir, engine.module);
  await buildTemplates({ ...config, outputDir: out, templatingEngine: engine.id });
  const mod = await import(pathToFileURL(path.join(out, "welcome.js")).href);
  const ms = bench(engine.id, () => mod.renderWelcome(params), RUNS.compiled);
  results.push({ ...engine, compiledMs: Number(ms.toFixed(3)) });
}

// --- what authoring would cost, if it ran per send -------------------------
const bundle = path.join(dir, "_templates.mjs");
await esbuild.build({
  entryPoints: [path.join(config.sourceDir, "index.ts")],
  outfile: bundle, bundle: true, format: "esm", platform: "node",
  packages: "external", jsx: "transform", jsxFactory: "React.createElement",
  jsxFragment: "React.Fragment",
});
const { templates } = await import(pathToFileURL(bundle).href);
const welcome = templates.find((t) => t.name === "welcome");

const ctx = (v) => ({
  render: (k) => String(k.split(".").reduce((a, s) => a?.[s], v)),
  when: (k, a, b) => (k.split(".").reduce((x, s) => x?.[s], v) ? a() : b?.()),
  unless: (k, a) => (!k.split(".").reduce((x, s) => x?.[s], v) ? a() : null),
  each: (k, f) => (k.split(".").reduce((x, s) => x?.[s], v) ?? []).map((it, i) => f(ctx(it), i)),
  with: (k, f) => f(ctx(k.split(".").reduce((x, s) => x?.[s], v))),
});

const authoringMs = bench("React + MJML", () =>
  mjml2html(renderToStaticMarkup(welcome.htmlTemplate(ctx(params))), { validationLevel: "skip" }),
  RUNS.authoring);

for (const r of results) r.ratio = Math.round(authoringMs / r.compiledMs);
results.sort((a, b) => a.compiledMs - b.compiledMs);
const best = results[0];

console.log(`\n  fastest ${best.id} at ${best.ratio}x   node ${process.version}`);

const outDir = path.join(REPO, "website/src/data");
await mkdir(outDir, { recursive: true });
await writeFile(
  path.join(outDir, "render-benchmark.json"),
  JSON.stringify(
    {
      template: "welcome",
      authoringMs: Number(authoringMs.toFixed(3)),
      runs: RUNS,
      engines: results,
      best: best.id,
      node: process.version,
      platform: `${os.type()} ${os.arch()}`,
      measuredAt: new Date().toISOString().slice(0, 10),
    },
    null,
    2,
  ) + "\n",
);
console.log("  wrote website/src/data/render-benchmark.json");

await rm(dir, { recursive: true, force: true });
