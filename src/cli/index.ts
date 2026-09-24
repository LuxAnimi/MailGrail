import { runPreview } from "./preview.js";
import { runBuild } from "./build.js";
import { runExtract } from "./extract.js";

//------------------------------------------------------------------------------
//------------------------------------------------------------------------------
export async function run() {
  const [command, ...args] = process.argv.slice(2);

  switch (command) {
    case "preview":
      return runPreview(args);

    case "build":
      return runBuild(args);

    case "extract":
      return runExtract(args);

    case "-h":
    case "--help":
    case undefined:
      return printHelp();

    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

//------------------------------------------------------------------------------
function printHelp() {
  console.log(`
Usage:
  mailgrail preview [options]
  mailgrail build [options]
  mailgrail extract [--prune] [options]

Commands:
  preview   Start email preview server
  build     Build email templates for production
  extract   Update the translation catalogs from the source messages
`);
}
