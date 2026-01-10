import { string } from "./string.js";
import { number } from "./number.js";
import { array } from "./array.js";
import { object } from "./object.js";
import { optional } from "./optional.js";
import { defaulted } from "./defaulted.js";

//------------------------------------------------------------------------------
export const t = {
  string,
  number,
  object,
  array,
  optional,
  default: defaulted,
};
