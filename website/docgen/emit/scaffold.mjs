//------------------------------------------------------------------------------
// Everything `npm create @luxanimi/mailgrail` puts in a project, as data.
//
// The site's "setting up by hand" page has to reach the *identical* end state as
// the scaffolder, and the only way that stays true is to stop transcribing it.
// So this reads the scaffolder's own source -- `getTemplates()` and
// `packageAdditions()` are both pure functions -- and the page renders what
// comes back. Rename a starter file, bump a dependency or add a script, and
// `docs:check` fails until the page is regenerated.
//
// Same inversion as meta.mjs: the source of truth stays in the package, and the
// site derives from it rather than describing it.
//------------------------------------------------------------------------------
import path from "node:path";

import { loadManifest } from "../load.mjs";
import { emitJson, compareCoverage } from "../util/json.mjs";

// The defaults the docs quote. `prompts.ts` offers these as the placeholder for
// every path question, so a reader who pressed Enter four times gets exactly
// this tree -- which is what makes the page's file listings copy-pasteable.
const DOCUMENTED = {
  projectDir: ".",
  sourceDir: "emails-src",
  outputDir: "emails-dist",
  typescript: true,
  // Enter on the languages question: a single-language project.
  locales: [],
};

const PKG = "packages/create-mailgrail";

export async function emitScaffold({ repo, out, check }) {
  const templates = await loadManifest(path.join(repo, PKG, "src/templates.ts"));
  const scaffold = await loadManifest(path.join(repo, PKG, "src/scaffold.ts"));

  const files = templates.getTemplates(DOCUMENTED);
  const additions = scaffold.packageAdditions(DOCUMENTED.typescript, DOCUMENTED.sourceDir);

  // The JavaScript variant differs in more than the extension -- index and the
  // template lose their type imports -- so capture the filenames for it too.
  // The page needs to be honest about what a JS project ends up with.
  const jsFiles = templates.getTemplates({ ...DOCUMENTED, typescript: false });

  const value = {
    defaults: DOCUMENTED,
    files,
    javascriptFiles: Object.keys(jsFiles).sort(),
    packageJson: additions,
  };

  const problems = [];

  // A starter file that is written but has no home on the page is the exact
  // drift this generator exists to catch, so assert the shape we expect rather
  // than silently emitting whatever turns up.
  problems.push(
    ...compareCoverage(
      "scaffolded files",
      Object.keys(files),
      [
        "mailgrail.config.ts",
        `${DOCUMENTED.sourceDir}/index.ts`,
        `${DOCUMENTED.sourceDir}/WelcomeEmail.tsx`,
        `${DOCUMENTED.sourceDir}/components/BaseLayout.tsx`,
        `${DOCUMENTED.sourceDir}/components/theme.ts`,
        `${DOCUMENTED.sourceDir}/tsconfig.json`,
      ],
    ),
  );

  const diff = emitJson(path.join(out, "scaffold.json"), value, { check });

  return {
    problems,
    diffs: diff ? [{ file: "scaffold.json", diff }] : [],
  };
}
