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
  appName: string; // preview title, default is package.json's name
  appDescription: string; // preview subtitle, default is package.json's description
  locales: string[]; // BCP 47 tags to build; unset builds one unlocalized set
  defaultLocale: string; // default is locales[0]
  localesDir: string; // path relative to your project's folder, default is <sourceDir>/locales
  strictLocales: boolean; // incomplete translations fail the build, default is false
  timeZone: string; // IANA zone dates are formatted in, default is "UTC"
  previewDevices: PreviewDevice[]; // preview's device picker, default is desktop, tablet and mobile
}

//------------------------------------------------------------------------------
// A size the preview can frame an email at. A desktop takes all the room the
// preview has, so it has no width; the others are framed at theirs.
export type PreviewDeviceType = "desktop" | "tablet" | "mobile";

export type PreviewDevice =
  | { type: "desktop"; label?: string }
  | { type: "tablet" | "mobile"; width: number; label?: string };

export interface ResolvedPreviewDevice {
  type: PreviewDeviceType;
  label: string;
  width: number | null; // null for a desktop
}

//------------------------------------------------------------------------------
// The consumer project's own name and description, shown in the preview.
export interface ProjectInfo {
  name: string | null;
  description: string | null;
}

//------------------------------------------------------------------------------
// With no `locales`, localization is off: `locales` is empty and
// `defaultLocale` null, and the build emits exactly what it did before.
export interface MailgrailResolvedConfig
  extends Omit<
    MailgrailConfig,
    "defaultLocale" | "appName" | "appDescription" | "previewDevices"
  > {
  baseDir: string;
  configPath: string;
  defaultLocale: string | null;
  appName: string | null;
  appDescription: string | null;
  previewDevices: ResolvedPreviewDevice[];
}
