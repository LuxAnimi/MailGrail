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
function updatePackageJson(projectDir: string, ts: boolean): void {
  const pkgPath = path.join(projectDir, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8")) as PackageJson;

  pkg.scripts ??= {};
  pkg.scripts["preview-emails"] ??= "mailgrail preview";
  pkg.scripts["build-emails"] ??= "mailgrail build";

  // mailgrail's peer dependencies: the user's template files import these
  // directly, and mailgrail resolves them from the project's node_modules.
  pkg.dependencies ??= {};
  pkg.dependencies["@faire/mjml-react"] ??= "^4.0.0";
  pkg.dependencies["react"] ??= "^19.0.0";
  // The compiled output imports its templating engine at runtime.
  pkg.dependencies["ejs"] ??= "^5.0.2";

  pkg.devDependencies ??= {};
  pkg.devDependencies["mailgrail"] ??= "latest";
  if (ts) {
    pkg.devDependencies["@types/react"] ??= "^19.0.0";
  }

  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf-8");
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
