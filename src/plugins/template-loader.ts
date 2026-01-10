import path from "path";

//------------------------------------------------------------------------------
import type { Plugin } from "vite";

//------------------------------------------------------------------------------
//------------------------------------------------------------------------------
export function MailgrailTemplatesPlugin(templatesPath: string): Plugin {
  const resolvedPath = path.resolve(templatesPath);

  return {
    name: "email-templates",

    resolveId(id) {
      if (id === "virtual:mailgrailtemplates") {
        return id;
      }
    },

    load(id) {
      if (id === "virtual:mailgrailtemplates") {
        return `
          import { templates } from ${JSON.stringify(resolvedPath)};
          export { templates };
        `;
      }
    },
  };
}
