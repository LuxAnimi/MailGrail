import path from "path";

//------------------------------------------------------------------------------
import type {
  MailgrailConfig,
  MailgrailResolvedConfig,
  PreviewDevice,
  PreviewDeviceType,
  ResolvedPreviewDevice,
} from "./types.js";
import {
  assertTimeZone,
  canonicalizeLocale,
  canonicalizeLocales,
} from "../i18n/locale.js";

//------------------------------------------------------------------------------
//------------------------------------------------------------------------------
export function resolveConfig(
  userConfig: Partial<MailgrailConfig>,
  configPath: string,
  baseDir: string,
): MailgrailResolvedConfig {
  const sourceDir = path.resolve(baseDir, userConfig.sourceDir ?? "./emails-src");
  const { locales, defaultLocale } = resolveLocales(userConfig);

  const resolvedConf: MailgrailResolvedConfig = {
    ...userConfig,
    baseDir: baseDir,
    sourceDir,
    outputDir: path.resolve(baseDir, userConfig.outputDir ?? "./emails-dist"),
    configPath: configPath,
    previewPort: userConfig.previewPort ?? 7777,
    templatingEngine: userConfig.templatingEngine ?? "EJS",
    moduleFormat: userConfig.moduleFormat ?? "esm",
    typescript: userConfig.typescript ?? true,
    hideAppLogo: userConfig.hideAppLogo ?? false,
    hideAppName: userConfig.hideAppName ?? false,
    hideAppDescription: userConfig.hideAppDescription ?? false,
    // null means "use the project's package.json", see readProjectInfo.
    appName: userConfig.appName ?? null,
    appDescription: userConfig.appDescription ?? null,
    locales,
    defaultLocale,
    localesDir: userConfig.localesDir
      ? path.resolve(baseDir, userConfig.localesDir)
      : path.join(sourceDir, "locales"),
    strictLocales: userConfig.strictLocales ?? false,
    timeZone: assertTimeZone(userConfig.timeZone ?? "UTC"),
    previewDevices: resolvePreviewDevices(userConfig.previewDevices),
  };

  return resolvedConf;
}

//------------------------------------------------------------------------------
// Tags are canonicalized here, once, so every later comparison -- catalog file
// names, the fallback chain, the emitted `Locale` union -- is between canonical
// forms.
//------------------------------------------------------------------------------
function resolveLocales(userConfig: Partial<MailgrailConfig>): {
  locales: string[];
  defaultLocale: string | null;
} {
  const locales = canonicalizeLocales(userConfig.locales ?? []);

  if (locales.length === 0) {
    if (userConfig.defaultLocale !== undefined) {
      throw new Error(
        `defaultLocale is set but locales is empty. List the locales to ` +
          `build, e.g. locales: [${JSON.stringify(userConfig.defaultLocale)}].`,
      );
    }
    return { locales, defaultLocale: null };
  }

  const defaultLocale =
    userConfig.defaultLocale === undefined
      ? locales[0]!
      : canonicalizeLocale(userConfig.defaultLocale, "defaultLocale");

  if (!locales.includes(defaultLocale)) {
    throw new Error(
      `defaultLocale ${JSON.stringify(defaultLocale)} is not one of locales ` +
        `(${locales.map((l) => JSON.stringify(l)).join(", ")}).`,
    );
  }

  return { locales, defaultLocale };
}

//------------------------------------------------------------------------------
// Generic sizes: a small phone and a portrait tablet, the two widths most
// responsive email layouts break at.
//------------------------------------------------------------------------------
const DEFAULT_PREVIEW_DEVICES: PreviewDevice[] = [
  { type: "desktop" },
  { type: "tablet", width: 768 },
  { type: "mobile", width: 375 },
];

const DEVICE_LABELS: Record<PreviewDeviceType, string> = {
  desktop: "Desktop",
  tablet: "Tablet",
  mobile: "Mobile",
};

//------------------------------------------------------------------------------
// The config is plain JavaScript as often as TypeScript, so every device is
// checked here rather than trusted to its type.
//------------------------------------------------------------------------------
function resolvePreviewDevices(
  devices: PreviewDevice[] | undefined,
): ResolvedPreviewDevice[] {
  if (devices === undefined) devices = DEFAULT_PREVIEW_DEVICES;

  if (!Array.isArray(devices) || devices.length === 0) {
    throw new Error(
      `previewDevices must list at least one device, e.g. ` +
        `[{ type: "desktop" }, { type: "mobile", width: 375 }]. ` +
        `Leave it unset for the defaults.`,
    );
  }

  return devices.map((device, i) => {
    const where = `previewDevices[${i}]`;
    const type = (device as { type?: unknown } | null)?.type;

    if (typeof type !== "string" || !(type in DEVICE_LABELS)) {
      throw new Error(
        `${where}.type must be one of ` +
          `${Object.keys(DEVICE_LABELS).map((t) => JSON.stringify(t)).join(", ")}, ` +
          `got ${JSON.stringify(type)}.`,
      );
    }

    const label = device.label ?? DEVICE_LABELS[device.type];
    if (typeof label !== "string" || label.trim() === "") {
      throw new Error(`${where}.label must be a non-empty string.`);
    }

    // A desktop fills the preview, so a width on one would be silently
    // ignored; saying so beats leaving the author wondering why it has none.
    if (device.type === "desktop") {
      if ("width" in device) {
        throw new Error(
          `${where} is a desktop, which fills the preview and takes no width. ` +
            `Use type "tablet" or "mobile" for a fixed width.`,
        );
      }
      return { type: device.type, label, width: null };
    }

    const { width } = device;
    if (typeof width !== "number" || !Number.isInteger(width) || width <= 0) {
      throw new Error(
        `${where}.width must be a positive whole number of pixels, ` +
          `got ${JSON.stringify(width)}.`,
      );
    }
    return { type: device.type, label, width };
  });
}
