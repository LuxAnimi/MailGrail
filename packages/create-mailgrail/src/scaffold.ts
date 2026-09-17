import fs from "fs";
import path from "path";
import { getTemplates } from "./templates.js";
import type { ScaffoldOptions } from "./prompts.js";

//------------------------------------------------------------------------------
type PackageJson = {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  [key: string]: unknown;
};

//------------------------------------------------------------------------------
export type PackageAdditions = {
  scripts: Record<string, string>;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
};

//------------------------------------------------------------------------------
// Every package.json change the scaffolder makes, as data rather than as a
// sequence of assignments.
//
// The docs site documents this exact set on its "setting up by hand" page, and
// reads it from here at docs-generation time -- so a version bump or a new
// dependency cannot drift away from the page telling people to install it.
// Keep it a pure function of its arguments: docgen calls it outside any project.
//------------------------------------------------------------------------------
export function packageAdditions(
  ts: boolean,
  sourceDir: string,
  reactMajor: ReactMajor = 19,
): PackageAdditions {
  return {
    scripts: {
      "preview-emails": "mailgrail preview",
      "build-emails": "mailgrail build",
      // mailgrail loads templates through esbuild, which strips types without
      // checking them, so this is the only thing that ever runs tsc over them.
      // It uses the tsconfig.json scaffolded into the source directory.
      ...(ts
        ? {
            "typecheck-emails": `tsc -p ${/\s/.test(sourceDir) ? JSON.stringify(sourceDir) : sourceDir}`,
          }
        : {}),
    },

    // MailGrail's peer dependencies: the user's template files import these
    // directly, and MailGrail resolves them from the project's node_modules.
    // `ejs` is different again -- it is imported by the *compiled output*, which
    // is why it is a real dependency rather than a dev one.
    dependencies: {
      "@faire/mjml-react": "^4.0.0",
      react: `^${reactMajor}.0.0`,
      // react-dom is not optional: rendering a template to MJML goes through
      // react-dom/server, and it was previously left to arrive as somebody
      // else's peer dependency, at whatever major npm felt like.
      "react-dom": `^${reactMajor}.0.0`,
      ejs: "^5.0.2",
    },

    devDependencies: {
      "@luxanimi/mailgrail": "latest",
      ...(ts
        ? { "@types/react": `^${reactMajor}.0.0`, typescript: "^6.0.0" }
        : {}),
    },
  };
}

//------------------------------------------------------------------------------
// MailGrail supports React 18 and 19. A project that already has one keeps it:
// bumping someone's React major to scaffold an email template would be a rude
// thing for a scaffolder to do, and 19 is only the default for a project that
// has no opinion yet.
//------------------------------------------------------------------------------
export type ReactMajor = 18 | 19;

export function detectReactMajor(projectDir: string): ReactMajor {
  const pkgPath = path.join(projectDir, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8")) as PackageJson;

  const range =
    pkg.dependencies?.["react"] ??
    pkg.devDependencies?.["react"] ??
    (pkg["peerDependencies"] as Record<string, string> | undefined)?.["react"];

  // Any of "^18.2.0", "18.x", ">=18 <19", "~18.0.0" -- the first number is the
  // major in every spelling that matters here.
  const major = Number.parseInt(String(range ?? "").replace(/^[^0-9]*/, ""), 10);

  return major === 18 ? 18 : 19;
}

//------------------------------------------------------------------------------
function updatePackageJson(
  projectDir: string,
  ts: boolean,
  sourceDir: string,
): void {
  const pkgPath = path.join(projectDir, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8")) as PackageJson;

  const additions = packageAdditions(
    ts,
    sourceDir,
    detectReactMajor(projectDir),
  );

  for (const section of ["scripts", "dependencies", "devDependencies"] as const) {
    const existing = (pkg[section] ??= {});
    for (const [name, value] of Object.entries(additions[section])) {
      // `??=` throughout: an existing pin or script always wins. The scaffolder
      // adds to a project, it never overwrites a decision already made there.
      existing[name] ??= value;
    }
  }

  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf-8");
}

//------------------------------------------------------------------------------
export function scaffold(opts: ScaffoldOptions): void {
  const { projectDir } = opts;

  updatePackageJson(projectDir, opts.typescript, opts.sourceDir);

  const templates = getTemplates(opts);

  for (const [filePath, content] of Object.entries(templates)) {
    const fullPath = path.join(projectDir, filePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    if (!fs.existsSync(fullPath)) {
      fs.writeFileSync(fullPath, content, "utf-8");
    }
  }
}
