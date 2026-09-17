import type { Plugin } from "vite";

//------------------------------------------------------------------------------
import type { MailgrailResolvedConfig } from "../config/types.js";
import { readProjectInfo } from "../cli/project-info.js";

//------------------------------------------------------------------------------
const escapeHtml = (text: string): string =>
  text.replace(
    /[&<>"]/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char] ?? char,
  );

//------------------------------------------------------------------------------
//------------------------------------------------------------------------------
export function MailgrailConfigPlugin(config: MailgrailResolvedConfig): Plugin {
  // Read once, when the server starts. A config change restarts it anyway.
  const project = readProjectInfo(config.baseDir);

  return {
    name: "mailgrail:config",

    resolveId(id) {
      if (id === "virtual:mailgrailconfig") {
        return id;
      }
    },

    load(id) {
      if (id === "virtual:mailgrailconfig") {
        return `
          export const config = ${JSON.stringify(config)};
          export const project = ${JSON.stringify(project)};
          export default config;
        `;
      }
    },

    // The tab title comes from the server rather than the app: it is right on
    // first paint, and two previews open at once stop being two identical tabs.
    transformIndexHtml(html) {
      const name = config.hideAppName ? null : project.name;

      const title = name
        ? `${escapeHtml(name)} · MailGrail`
        : "MailGrail Preview";

      return html.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`);
    },
  };
}
