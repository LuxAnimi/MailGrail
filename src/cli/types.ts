import type { ReactElement } from "react";

//------------------------------------------------------------------------------
import type { Infer, Schema } from "@/dsl/types.js";

//------------------------------------------------------------------------------
//------------------------------------------------------------------------------
export type TemplateParams = unknown;

//------------------------------------------------------------------------------
// export type FormatParams<TemplateParams> = <K extends keyof TemplateParams>(
//   key: K,
// ) => string;

// export type FormatParams<T> = {
//   <K extends keyof T>(key: K): string;
//   (key: string): string;
// };

export type ParamFormatter = (key: string) => string;

export type FormatParams<T> = ParamFormatter & {
  <K extends keyof T & string>(key: K): string;
};

//------------------------------------------------------------------------------
export type InferParams<T extends Record<string, string>> = {
  [K in keyof T]: string;
};

//------------------------------------------------------------------------------
export interface TemplateDefinition<S extends Schema<any>> {
  name: string;
  subjectTemplate: (params: Infer<S>) => string;
  textTemplate: (params: Infer<S>) => string;
  htmlTemplate: (params: FormatParams<Infer<S>>) => ReactElement;
  sender?: string;
  params: S;
}
