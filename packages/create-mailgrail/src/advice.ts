import fs from "fs";
import path from "path";
import type { ScaffoldOptions } from "./prompts.js";

//------------------------------------------------------------------------------
// What an existing project needs doing by hand.
//
// The scaffolder adds to a project and never overwrites a decision already made
// there, so it does not touch a tsconfig or an eslint config it finds. But both
// of those will have opinions about the directory it just created, and finding
// that out through a wall of errors later is worse than being told now.
//
// Pure and read-only: it looks at file names and, for the tsconfig, whether the
// source directory is already mentioned. It never parses or edits either file.
//------------------------------------------------------------------------------
export type Advice = {
  title: string;
  lines: string[];
};

//------------------------------------------------------------------------------
type FsLike = Pick<typeof fs, "existsSync" | "readFileSync">;

//------------------------------------------------------------------------------
const ESLINT_CONFIGS = [
  "eslint.config.js",
  "eslint.config.mjs",
  "eslint.config.cjs",
  "eslint.config.ts",
  ".eslintrc",
  ".eslintrc.js",
  ".eslintrc.cjs",
  ".eslintrc.json",
  ".eslintrc.yml",
  ".eslintrc.yaml",
];

//------------------------------------------------------------------------------
export function existingProjectAdvice(
  opts: ScaffoldOptions,
  fsImpl: FsLike = fs,
): Advice[] {
  const { projectDir, sourceDir, typescript } = opts;
  const advice: Advice[] = [];

  const tsconfig = path.join(projectDir, "tsconfig.json");

  if (typescript && fsImpl.existsSync(tsconfig)) {
    let text = "";
    try {
      text = fsImpl.readFileSync(tsconfig, "utf-8") as string;
    } catch {
      // Unreadable is the same as not mentioning it.
    }

    // Already named in there, one way or another -- include, exclude, paths.
    // Whatever the intent, it is not this scaffolder's to second-guess.
    if (!text.includes(sourceDir)) {
      advice.push({
        title: "Your tsconfig.json",
        lines: [
          `  ${sourceDir}/ has its own tsconfig.json, which typecheck-emails`,
          `  uses. If your root config also covers that directory, the`,
          `  templates get checked with its settings instead — which is how`,
          `  JSX in an email template ends up failing your app's build.`,
          ``,
          `    "exclude": ["${sourceDir}"]`,
          ``,
          `  Nothing here changed it for you.`,
        ],
      });
    }
  }

  const eslintConfig = ESLINT_CONFIGS.find((file) =>
    fsImpl.existsSync(path.join(projectDir, file)),
  );

  if (eslintConfig) {
    advice.push({
      title: `Your ${eslintConfig}`,
      lines: [
        `  The templates are JSX that renders to email, not to a browser, so`,
        `  your app's rules will have opinions about them. Either ignore the`,
        `  directory:`,
        ``,
        `    ignores: ["${sourceDir}"]`,
        ``,
        `  or give it a block of its own.`,
      ],
    });
  }

  return advice;
}
