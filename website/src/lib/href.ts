//----------------------------------------------------------------------------
// Base-path-safe link helper.
//
// The site is served from https://luxanimi.github.io/MailGrail/, so a literal
// href="/docs/dsl" resolves to /docs/dsl in production -- off the deployment
// entirely -- while working perfectly in `astro dev` at the root. That mismatch
// is the most common way a GitHub Pages site breaks, and it fails silently.
//
// Route every internal link through href().
//
//   href("/docs/dsl")  ->  "/MailGrail/docs/dsl"
//   href("docs/dsl")   ->  "/MailGrail/docs/dsl"
//   href("/")          ->  "/MailGrail/"
//
// External URLs and fragments pass through untouched, so href() is safe to
// apply uniformly rather than having to decide at each call site.
//----------------------------------------------------------------------------
const BASE = import.meta.env.BASE_URL ?? "/";

const isExternal = (path: string) =>
  /^[a-z][a-z0-9+.-]*:/i.test(path) || path.startsWith("//");

export function href(path: string): string {
  if (!path) return BASE;
  if (isExternal(path) || path.startsWith("#") || path.startsWith("?")) {
    return path;
  }

  const base = BASE.endsWith("/") ? BASE.slice(0, -1) : BASE;
  const rest = path.startsWith("/") ? path : `/${path}`;

  // "/" must keep its trailing slash so the landing page URL stays canonical.
  return rest === "/" ? `${base}/` : `${base}${rest}`;
}

/** True when `current` (a pathname) is at or beneath `path`. */
export function isActive(current: string, path: string): boolean {
  const target = href(path).replace(/\/$/, "");
  const here = current.replace(/\/$/, "");
  return here === target || here.startsWith(`${target}/`);
}
