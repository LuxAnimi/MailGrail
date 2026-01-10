import { runPreview } from "./preview.js";
import { runBuild } from "./build.js";

//------------------------------------------------------------------------------
//------------------------------------------------------------------------------
export async function run() {
  const [command, ...args] = process.argv.slice(2);

  switch (command) {
    case "preview":
      return runPreview(args);

    case "build":
      return runBuild(args);

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

Commands:
  preview   Start email preview server
  build     Build email templates for production
`);
}
