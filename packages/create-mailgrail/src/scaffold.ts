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
// Keep it a pure function of `ts`: docgen calls it outside any project.
//------------------------------------------------------------------------------
export function packageAdditions(ts: boolean): PackageAdditions {
  return {
    scripts: {
      "preview-emails": "mailgrail preview",
      "build-emails": "mailgrail build",
    },

    // MailGrail's peer dependencies: the user's template files import these
    // directly, and MailGrail resolves them from the project's node_modules.
    // `ejs` is different again -- it is imported by the *compiled output*, which
    // is why it is a real dependency rather than a dev one.
    dependencies: {
      "@faire/mjml-react": "^4.0.0",
      react: "^19.0.0",
      ejs: "^5.0.2",
    },

    devDependencies: {
      "@luxanimi/mailgrail": "latest",
      ...(ts ? { "@types/react": "^19.0.0" } : {}),
    },
  };
}

//------------------------------------------------------------------------------
function updatePackageJson(projectDir: string, ts: boolean): void {
  const pkgPath = path.join(projectDir, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8")) as PackageJson;

  const additions = packageAdditions(ts);

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
// Whether the target project can import the compiled templates directly.
//
// `mailgrail build` emits ESM, so a project left on CommonJS -- which is what
// `npm init -y` produces -- fails with "Cannot use import statement outside a
// module" the first time it uses the output. The scaffolder reports this rather
// than fixing it: flipping "type" on a project that already has CommonJS source
// in it would break that code, and it is not a call a scaffolder can make.
export function projectIsEsm(projectDir: string): boolean {
  const pkgPath = path.join(projectDir, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8")) as PackageJson;
  return pkg["type"] === "module";
}

//------------------------------------------------------------------------------
export function scaffold(opts: ScaffoldOptions): void {
  const { projectDir } = opts;

  updatePackageJson(projectDir, opts.typescript);

  const templates = getTemplates(opts);

  for (const [filePath, content] of Object.entries(templates)) {
    const fullPath = path.join(projectDir, filePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    if (!fs.existsSync(fullPath)) {
      fs.writeFileSync(fullPath, content, "utf-8");
    }
  }
}
