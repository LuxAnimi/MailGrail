import {
  defaulted,
  optional,
  object,
  array,
  boolean,
  number,
  string,
} from "./schemas.js";

//------------------------------------------------------------------------------
// The public api for the DSL
//------------------------------------------------------------------------------
export const t = {
  string,
  number,
  boolean,
  object,
  array,
  optional,
  default: defaulted,
};
