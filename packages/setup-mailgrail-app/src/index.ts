import { intro, outro, spinner, cancel, note } from "@clack/prompts";
import { collectPrompts } from "./prompts.js";
import { scaffold } from "./scaffold.js";
import { install } from "./install.js";

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
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const options = opts!;

  scaffold(options);

  const s = spinner();
  s.start("Installing dependencies");
  const installed = install(options.projectDir);
  if (installed) {
    s.stop("Dependencies installed");
  } else {
    s.stop(
      "Dependency installation failed — run `npm install` manually to finish setup.",
    );
  }

  const nextSteps = [
    "  npm run preview-emails    — start the live preview server",
    "  npm run build-emails      — compile templates to EJS + TypeScript",
    "",
    `  Templates:  ${options.sourceDir}/`,
    `  Output:     ${options.outputDir}/`,
  ].join("\n");

  note(nextSteps, "Next steps");
  outro("Happy emailing!");
}

//------------------------------------------------------------------------------
main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
