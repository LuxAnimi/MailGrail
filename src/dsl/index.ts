import {
  boolean,
  number,
  string,
  date,
  object,
  array,
  optional,
  defaulted,
} from "./schemas.js";

//------------------------------------------------------------------------------
// The public api for the DSL
//------------------------------------------------------------------------------
export const t = {
  boolean,
  number,
  string,
  date,
  object,
  array,
  optional,
  default: defaulted,
};

export type { Infer, Schema } from "./schemas.js";
