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

  buildTemplates(config);

  console.log("Building emails to", config.outputDir);
}
