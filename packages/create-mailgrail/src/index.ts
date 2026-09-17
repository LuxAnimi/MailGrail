import { intro, outro, spinner, cancel, note } from "@clack/prompts";
import { collectPrompts } from "./prompts.js";
import { scaffold } from "./scaffold.js";
import { install, detectPackageManager } from "./install.js";
import { printHandoff } from "./handoff.js";
import { existingProjectAdvice } from "./advice.js";

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
    ...(options.typescript
      ? [`  ${run} typecheck-emails  — typecheck the templates`]
      : []),
    "",
    `  Templates:  ${options.sourceDir}/`,
    `  Output:     ${options.outputDir}/`,
    "",
    // The one that bites on a clean clone: the emitted .d.ts is an input to
    // tsc, so typechecking before a build fails on imports that are fine.
    `  ${options.outputDir}/ exists only after a build — run`,
    `  ${run} build-emails before tsc on a fresh clone.`,
  ].join("\n");

  note(nextSteps, "Next steps");

  // Neither of these is edited for them: both are decisions the project has
  // already made, and both will otherwise surprise someone later.
  for (const advice of existingProjectAdvice(options)) {
    note(advice.lines.join("\n"), advice.title);
  }

  printHandoff();
  outro("Happy emailing!");
}

//------------------------------------------------------------------------------
main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
