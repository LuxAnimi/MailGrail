import { intro, outro, spinner, cancel, note } from "@clack/prompts";
import { collectPrompts } from "./prompts.js";
import { scaffold } from "./scaffold.js";
import { install, detectPackageManager } from "./install.js";
import { printHandoff } from "./handoff.js";

//------------------------------------------------------------------------------
const [major] = process.versions.node.split(".").map(Number) as [number, ...number[]];
if (major < 18) {
  console.error("setup-mailgrail-app requires Node.js 18 or higher.");
  process.exit(1);
}

//------------------------------------------------------------------------------
async function main() {
  console.log();
  intro("  setup-mailgrail-app  ");

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
  printHandoff();
  outro("Happy emailing!");
}

//------------------------------------------------------------------------------
main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
