//------------------------------------------------------------------------------
export interface MailgrailConfig {
  sourceDir: string; // path relative to your project's folder
  outputDir: string; // path, relative to your project's folder
  previewPort: number; //
  typescript: boolean; // wether to export as typescript
  templatingEngine: "EJS" | "Handlebars" | "Mustache"; // default is "EJS"
  hideAppName: boolean; // default is false
  hideAppDescription: boolean; // default is false
  hideAppLogo: boolean; // default is false
}

//------------------------------------------------------------------------------
export interface MailgrailUserConfig extends Partial<MailgrailConfig> {}

//------------------------------------------------------------------------------
export interface MailgrailResolvedConfig extends MailgrailConfig {
  baseDir: string;
  configPath: string;
}
