import type { HtmlTemplateContext } from "../../../src/cli/types";

//------------------------------------------------------------------------------
// What a shared component needs from a template's `mg` to translate its own
// text. Components take no params, so this is `t` alone -- tags only, no
// param paths -- and any template's `mg` can be passed in.
export type Translator = Pick<HtmlTemplateContext<Record<string, never>>, "t">;
