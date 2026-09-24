import { text, select, isCancel } from "@clack/prompts";
import fs from "fs";
import path from "path";

//------------------------------------------------------------------------------
export type ScaffoldOptions = {
  projectDir: string;
  typescript: boolean;
  sourceDir: string;
  outputDir: string;
  // BCP 47 tags, canonical, the first being the language the templates are
  // written in. Empty means a single, unlocalized build.
  locales: string[];
};

//------------------------------------------------------------------------------
// "en, fr-ca es" -> ["en", "fr-CA", "es"]. Canonicalized as MailGrail does it,
// so the config written is exactly what MailGrail will resolve it to.
//------------------------------------------------------------------------------
export function parseLocales(input: string): string[] | string {
  const tags = input.split(/[\s,]+/).filter(Boolean);
  const seen: string[] = [];

  for (const tag of tags) {
    let canonical: string | undefined;
    try {
      [canonical] = Intl.getCanonicalLocales(tag);
    } catch {
      // reported below
    }
    if (!canonical) {
      return `"${tag}" is not a language tag (expected something like en, fr-CA or es).`;
    }
    if (seen.includes(canonical)) return `${canonical} is listed twice.`;
    seen.push(canonical);
  }

  return seen;
}

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
    defaultValue: "emails-src",
    placeholder: "emails-src",
  });
  if (isCancel(sourceDir)) return null;

  const outputDir = await text({
    message: "Build output directory?",
    defaultValue: "emails-dist",
    placeholder: "emails-dist",
  });
  if (isCancel(outputDir)) return null;

  const locales = await text({
    message:
      "Email languages? Comma-separated, the first is the one you write in. " +
      "Leave empty for a single language.",
    placeholder: "en, fr, es",
    defaultValue: "",
    validate(value: string) {
      const parsed = parseLocales(value ?? "");
      if (typeof parsed === "string") return parsed;
    },
  });
  if (isCancel(locales)) return null;

  return {
    projectDir: path.resolve(process.cwd(), projectDir as string),
    typescript: typescript as boolean,
    sourceDir: sourceDir as string,
    outputDir: outputDir as string,
    locales: parseLocales(locales as string) as string[],
  };
}
