//------------------------------------------------------------------------------
// mailgrail docs generator
//
//   node website/docgen/index.mjs            regenerate website/src/generated
//   node website/docgen/index.mjs --check    verify, change nothing
//   node website/docgen/index.mjs --only=dsl,config
//
// The generated JSON is committed. That is what keeps the Astro build light:
// it reads only the committed files, so it needs neither lib/, nor mjml, nor
// the three templating engines, and a broken generator cannot take the deploy
// down with it. `--check` is what keeps the committed copy honest, and it does
// two separate jobs:
//
//   1. byte equality  -- the committed JSON matches what the source produces
//   2. coverage       -- the docs still describe everything the source exports
//
// The second is the one that matters. Byte equality only proves the file
// matches itself; coverage is what fails CI when someone adds `t.date()` and
// forgets the page.
//------------------------------------------------------------------------------
import path from "node:path";
import { fileURLToPath } from "node:url";

import { preflight } from "./preflight.mjs";
import { emitDsl } from "./emit/dsl.mjs";
import { emitConfig } from "./emit/config.mjs";
import { emitCli } from "./emit/cli.mjs";
import { emitContext } from "./emit/context.mjs";
import { emitSnippets } from "./emit/snippets.mjs";
import { emitMeta } from "./emit/meta.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(here, "../..");
const OUT = path.join(REPO, "website/src/generated");
const LIB = path.join(REPO, "lib");

const GENERATORS = {
  meta: emitMeta,
  config: emitConfig,
  cli: emitCli,
  dsl: emitDsl,
  context: emitContext,
  snippets: emitSnippets,
};

//------------------------------------------------------------------------------
async function main(argv) {
  const check = argv.includes("--check");

  const onlyArg = argv.find((a) => a.startsWith("--only="));
  const only = onlyArg ? onlyArg.slice("--only=".length).split(",") : null;

  if (only) {
    const unknown = only.filter((n) => !(n in GENERATORS));
    if (unknown.length) {
      fail(`unknown generator(s): ${unknown.join(", ")}`, Object.keys(GENERATORS));
    }
  }

  preflight(REPO);

  const names = only ?? Object.keys(GENERATORS);
  const problems = [];
  const diffs = [];

  for (const name of names) {
    const result = await GENERATORS[name]({
      repo: REPO,
      out: OUT,
      lib: LIB,
      check,
    });

    problems.push(...(result.problems ?? []));
    diffs.push(...(result.diffs ?? []));
  }

  //----------------------------------------------------------------------------
  if (!check) {
    if (problems.length) {
      console.error("\nwrote the files, but the docs are incomplete:\n");
      for (const p of problems) console.error(`  - ${p}`);
      console.error("");
      process.exit(1);
    }

    console.log(`docgen: wrote ${names.length} generator(s) to website/src/generated`);
    return;
  }

  //----------------------------------------------------------------------------
  if (!problems.length && !diffs.length) {
    console.log(`docgen --check: ${names.length} generator(s) in sync`);
    return;
  }

  if (diffs.length) {
    console.error("\nthe committed docs data is stale:\n");
    for (const d of diffs) console.error(`  ${d.file}: ${d.diff}`);
    console.error("\n  run: npm run docs:generate\n");
  }

  if (problems.length) {
    console.error("\nthe docs no longer cover the source:\n");
    for (const p of problems) console.error(`  - ${p}`);
    console.error("");
  }

  process.exit(1);
}

//------------------------------------------------------------------------------
function fail(message, hint) {
  console.error(`docgen: ${message}`);
  if (hint) console.error(`  available: ${hint.join(", ")}`);
  process.exit(1);
}

//------------------------------------------------------------------------------
main(process.argv.slice(2)).catch((err) => {
  console.error(`\ndocgen failed:\n\n${err.message}\n`);
  process.exit(1);
});
