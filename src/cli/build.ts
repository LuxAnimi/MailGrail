import { parseArgs } from "node:util";

//------------------------------------------------------------------------------
import { buildTemplates } from "./build-templates.js";
import { loadMailgrailConfig } from "../config/loadConfig.js";

//------------------------------------------------------------------------------
//------------------------------------------------------------------------------
function parseBuildArgs(argv: string[]) {
  const { values } = parseArgs({
    args: argv,
    options: {
      configPath: { type: "string" },
    },
  });

  return {
    configPath: values.configPath,
  };
}

//------------------------------------------------------------------------------
export async function runBuild(argv: string[]) {
  const values = parseBuildArgs(argv);

  const config = await loadMailgrailConfig(values.configPath);

  console.log("Building emails to", config.outputDir);

  // Awaited so failures reach the CLI's error handler instead of surfacing as
  // an unhandled rejection, and so the command does not report before it is done.
  const warnings = await buildTemplates(config);

  console.log("Done.");

  // After "Done.", because none of these stopped the build: they are things
  // about the output directory that only its owner can settle.
  for (const warning of warnings) {
    console.warn(`\n${warning}`);
  }
}
