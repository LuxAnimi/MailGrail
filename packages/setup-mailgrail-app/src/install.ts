import { spawnSync } from "child_process";

//------------------------------------------------------------------------------
function detectPackageManager(): string {
  const ua = process.env["npm_config_user_agent"] ?? "";
  if (ua.startsWith("pnpm")) return "pnpm";
  if (ua.startsWith("yarn")) return "yarn";
  if (ua.startsWith("bun")) return "bun";
  return "npm";
}

//------------------------------------------------------------------------------
export function install(projectDir: string): boolean {
  const pm = detectPackageManager();
  const result = spawnSync(pm, ["install"], {
    cwd: projectDir,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  return result.status === 0;
}
