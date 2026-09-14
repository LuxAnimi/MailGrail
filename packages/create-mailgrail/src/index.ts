import { intro, outro, spinner, cancel, note } from "@clack/prompts";
import { collectPrompts } from "./prompts.js";
import { scaffold, projectIsEsm } from "./scaffold.js";
import { install, detectPackageManager } from "./install.js";
import { printHandoff } from "./handoff.js";

//------------------------------------------------------------------------------
// Keep this in step with `engines` here and in mailgrail itself. The guard used
// to stop only below 18, which let 18.x and early 20.x through -- far enough to
// scaffold the project and then fail during the install of a package those
// versions cannot run. Failing here says why.
const [major, minor] = process.versions.node
  .split(".")
  .map(Number) as [number, number, ...number[]];

const supported = (major === 20 && minor >= 19) || (major === 22 && minor >= 12) || major > 22;

if (!supported) {
  console.error(
    `create-mailgrail requires Node.js ^20.19.0 || >=22.12.0 (found ${process.versions.node}).`,
  );
  process.exit(1);
}

//------------------------------------------------------------------------------
async function main() {
  console.log();
  intro("  create-mailgrail  ");

  const opts = await collectPrompts();

  if (!opts) {
    cancel("Setup cancelled.");
    process.exit(0);
  }

  // opts is guaranteed non-null after the exit above
  const options = opts!;

  scaffold(options);

  const pm = detectPackageManager();

  const s = spinner();
  s.start("Installing dependencies");
  const installed = install(options.projectDir);
  if (installed) {
    s.stop("Dependencies installed");
  } else {
    s.stop(
      `Dependency installation failed — run \`${pm} install\` manually to finish setup.`,
    );
  }

  // `pnpm build-emails`, not `pnpm run build-emails` -- and never `npm run` for
  // someone who invoked this with another package manager.
  const run = pm === "npm" ? "npm run" : pm;

  // The scaffolder always wires EJS and never asks, so say EJS rather than
  // implying a choice was made. Types are only emitted for a TypeScript project.
  const built = options.typescript
    ? "compile templates to EJS, with TypeScript types"
    : "compile templates to EJS";

  const nextSteps = [
    `  ${run} preview-emails    — start the live preview server`,
    `  ${run} build-emails      — ${built}`,
    "",
    `  Templates:  ${options.sourceDir}/`,
    `  Output:     ${options.outputDir}/`,
  ].join("\n");

  note(nextSteps, "Next steps");

  if (!projectIsEsm(options.projectDir)) {
    note(
      [
        '  Your package.json has no "type": "module", and the compiled',
        "  templates are ESM. Importing them from CommonJS fails with",
        '  "Cannot use import statement outside a module".',
        "",
        '  Set "type": "module", or reach the output with a dynamic',
        "  import(). Nothing here changed it for you \u2014 flipping it can",
        "  break existing CommonJS code.",
      ].join("\n"),
      "One thing to know",
    );
  }

  printHandoff();
  outro("Happy emailing!");
}

//------------------------------------------------------------------------------
main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
