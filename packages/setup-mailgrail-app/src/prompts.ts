import { text, select, isCancel } from "@clack/prompts";
import fs from "fs";
import path from "path";

//------------------------------------------------------------------------------
export type ScaffoldOptions = {
  projectDir: string;
  typescript: boolean;
  sourceDir: string;
  outputDir: string;
};

//------------------------------------------------------------------------------
export async function collectPrompts(): Promise<ScaffoldOptions | null> {
  const projectDir = await text({
    message: "Project directory?",
    placeholder: ".",
    defaultValue: ".",
    validate(value: string) {
      const dir = path.resolve(process.cwd(), value);
      if (!fs.existsSync(dir)) {
        return `Directory not found: ${value}`;
      }
      if (!fs.existsSync(path.join(dir, "package.json"))) {
        return `No package.json found in ${value} — run this inside an existing project.`;
      }
    },
  });
  if (isCancel(projectDir)) return null;

  const typescript = await select({
    message: "Language?",
    options: [
      { value: true, label: "TypeScript", hint: "recommended" },
      { value: false, label: "JavaScript" },
    ],
  });
  if (isCancel(typescript)) return null;

  const sourceDir = await text({
    message: "Email source directory?",
    defaultValue: "emails",
    placeholder: "emails",
  });
  if (isCancel(sourceDir)) return null;

  const outputDir = await text({
    message: "Build output directory?",
    defaultValue: "dist/emails",
    placeholder: "dist/emails",
  });
  if (isCancel(outputDir)) return null;

  return {
    projectDir: path.resolve(process.cwd(), projectDir as string),
    typescript: typescript as boolean,
    sourceDir: sourceDir as string,
    outputDir: outputDir as string,
  };
}
