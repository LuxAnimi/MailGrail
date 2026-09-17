//------------------------------------------------------------------------------
export interface MailgrailConfig {
  sourceDir: string; // path relative to your project's folder
  outputDir: string; // path, relative to your project's folder
  previewPort: number; //
  typescript: boolean; // wether to export as typescript
  templatingEngine: "EJS" | "Handlebars" | "Mustache"; // default is "EJS"
  moduleFormat: "esm" | "cjs"; // default is "esm"
  hideAppName: boolean; // default is false
  hideAppDescription: boolean; // default is false
  hideAppLogo: boolean; // default is false
}

//------------------------------------------------------------------------------
// The consumer project's own name and description, shown in the preview.
export interface ProjectInfo {
  name: string | null;
  description: string | null;
}

//------------------------------------------------------------------------------
export interface MailgrailResolvedConfig extends MailgrailConfig {
  baseDir: string;
  configPath: string;
}
