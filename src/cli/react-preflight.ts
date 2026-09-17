import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

//------------------------------------------------------------------------------
// React comes from the project, not from mailgrail.
//
// Both the build and the preview render the project's own templates, so the
// React that renders them has to be the React those templates were written
// against -- and there has to be exactly one of it. When that is not true the
// symptoms are terrible: elements from one copy are silently rejected by the
// other's renderer, and a preview shows nothing at all with no error worth
// reading. Everything here fails loudly instead, before anything renders.
//------------------------------------------------------------------------------
export type ReactPackage = {
  version: string;
  /** Real path of the resolved package.json, for identity comparison. */
  file: string;
};

//------------------------------------------------------------------------------
export type ReactPair = {
  react: ReactPackage;
  reactDom: ReactPackage;
};

//------------------------------------------------------------------------------
const SUPPORTED_MAJORS = [18, 19];

//------------------------------------------------------------------------------
function majorOf(version: string): number {
  return Number.parseInt(version.split(".")[0] ?? "", 10);
}

//------------------------------------------------------------------------------
function resolvePackage(from: string, name: string): ReactPackage | null {
  // `from` need not exist: createRequire only uses it as the directory to
  // resolve from.
  const requireFrom = createRequire(path.join(from, "package.json"));

  try {
    const file = fs.realpathSync(requireFrom.resolve(`${name}/package.json`));
    const version = JSON.parse(fs.readFileSync(file, "utf8")).version as string;

    return { version, file };
  } catch {
    return null;
  }
}

//------------------------------------------------------------------------------
export function assertReactPair(
  baseDir: string,
  libraryDir: string,
): ReactPair {
  const react = resolvePackage(baseDir, "react");
  const reactDom = resolvePackage(baseDir, "react-dom");

  if (!react) {
    throw new Error(
      `react is not installed in this project.\n` +
        `Your templates import it, and mailgrail renders them with your copy, ` +
        `so install it with:\n\n  npm install react react-dom\n`,
    );
  }

  if (!reactDom) {
    throw new Error(
      `react-dom is not installed in this project.\n` +
        `Rendering a template to MJML goes through react-dom/server, so ` +
        `install it alongside react:\n\n` +
        `  npm install react-dom@^${majorOf(react.version)}\n`,
    );
  }

  if (majorOf(react.version) !== majorOf(reactDom.version)) {
    throw new Error(
      `react ${react.version} and react-dom ${reactDom.version} are different ` +
        `major versions.\n` +
        `They share internals, so a template rendered by one is rejected by ` +
        `the other. Install both at the same major.\n`,
    );
  }

  if (!SUPPORTED_MAJORS.includes(majorOf(react.version))) {
    throw new Error(
      `react ${react.version} is not supported: mailgrail supports React ` +
        `${SUPPORTED_MAJORS.join(" and ")}.\n`,
    );
  }

  // The preview app is served from inside mailgrail's own directory, so it
  // resolves React from there while the templates resolve it from the project.
  // Those have to land on the same copy -- npm hoisting normally sees to that,
  // but a global install, an `npx` with no local install, or unusual monorepo
  // layouts can leave two.
  const fromLibrary = resolvePackage(libraryDir, "react");

  if (fromLibrary && fromLibrary.file !== react.file) {
    throw new Error(
      `Two copies of React are reachable, and templates rendered by one are ` +
        `rejected by the other:\n\n` +
        `  your project: ${react.file} (${react.version})\n` +
        `  mailgrail:    ${fromLibrary.file} (${fromLibrary.version})\n\n` +
        `Install mailgrail in the same project as react, rather than globally ` +
        `or through npx without a local install.\n`,
    );
  }

  return { react, reactDom };
}
