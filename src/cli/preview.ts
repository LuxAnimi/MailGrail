import { parseArgs } from "node:util";

//------------------------------------------------------------------------------
import { previewTemplates } from "./preview-templates.js";
import { loadMailgrailConfig } from "../config/loadConfig.js";

//------------------------------------------------------------------------------
//------------------------------------------------------------------------------
function parsePreviewArgs(argv: string[]) {
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
export async function runPreview(argv: string[]) {
  const values = parsePreviewArgs(argv);

  const config = await loadMailgrailConfig(values.configPath);

  // Awaited so a failure to start the server reaches the CLI's error handler
  // rather than becoming an unhandled rejection.
  await previewTemplates(config);
}
