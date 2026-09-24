//------------------------------------------------------------------------------
// The CLI reference.
//
// `--help` is captured by running the real binary, so the page cannot claim a
// command that no longer exists. The flag table stays hand-written here: the
// built-in help does not mention --configPath at all (see cli/build.ts, where
// it is parsed), so generating from help alone would document less than the CLI
// actually accepts.
//------------------------------------------------------------------------------
import { execFileSync } from "node:child_process";
import path from "node:path";

import { emitJson } from "../util/json.mjs";

const COMMANDS = [
  {
    id: "preview",
    usage: "mailgrail preview [options]",
    summary: "Start the live preview server.",
    description:
      "Renders every template with placeholder data generated from its schema, " +
      "and reloads on save.",
    flags: [
      {
        flag: "--configPath <path>",
        default: "./mailgrail.config.ts",
        summary: "Path to your config file.",
      },
    ],
  },
  {
    id: "build",
    usage: "mailgrail build [options]",
    summary: "Compile every template for production.",
    description:
      "Writes a template file, a render function and its type declarations to " +
      "`outputDir`, then verifies the configured engine is installed.",
    flags: [
      {
        flag: "--configPath <path>",
        default: "./mailgrail.config.ts",
        summary: "Path to your config file.",
      },
    ],
  },
  {
    id: "extract",
    usage: "mailgrail extract [--prune] [options]",
    summary: "Bring the translation catalogs in line with the source messages.",
    description:
      "Writes `<localesDir>/<locale>.json` for every locale in the config. A " +
      "new message is added to each translation catalog as an empty string, to " +
      "be translated; an existing translation is never touched. Needs `locales` " +
      "in the config.",
    flags: [
      {
        flag: "--prune",
        default: "false",
        summary:
          "Also remove entries whose message no longer exists. Off by default, " +
          "so renaming a key in code cannot silently throw its translations away.",
      },
      {
        flag: "--configPath <path>",
        default: "./mailgrail.config.ts",
        summary: "Path to your config file.",
      },
    ],
  },
];

export async function emitCli({ repo, out, check }) {
  const problems = [];
  let help = "";

  try {
    help = execFileSync(
      process.execPath,
      [path.join(repo, "lib/bin/mailgrail.js"), "--help"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    ).trim();
  } catch (err) {
    problems.push(`CLI: could not run \`mailgrail --help\`: ${err.message}`);
  }

  // Every documented command must appear in the real help output.
  for (const cmd of COMMANDS) {
    if (help && !new RegExp(`\\b${cmd.id}\\b`).test(help)) {
      problems.push(
        `CLI: "${cmd.id}" is documented but absent from \`mailgrail --help\``,
      );
    }
  }

  const diff = emitJson(
    path.join(out, "cli.json"),
    { help, commands: COMMANDS },
    { check },
  );

  return { problems, diffs: diff ? [{ file: "cli.json", diff }] : [] };
}
