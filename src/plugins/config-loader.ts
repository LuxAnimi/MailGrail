import type { Plugin } from "vite";

//------------------------------------------------------------------------------
import type { MailgrailResolvedConfig } from "../config/types.js";

//------------------------------------------------------------------------------
//------------------------------------------------------------------------------
export function MailgrailConfigPlugin(config: MailgrailResolvedConfig): Plugin {
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
          export default config;
        `;
      }
    },
  };
}
