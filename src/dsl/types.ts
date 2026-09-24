//------------------------------------------------------------------------------
import type {
  StringSchema,
  NumberSchema,
  BooleanSchema,
  DateSchema,
  ArraySchema,
  ObjectSchema,
  OptionalSchema,
  DefaultedSchema,
} from "./schemas.js";

//------------------------------------------------------------------------------
export type AnySchema =
  | StringSchema
  | NumberSchema
  | BooleanSchema
  | DateSchema
  | ArraySchema<any>
  | ObjectSchema<any>
  | OptionalSchema<any>
  | DefaultedSchema<any>;

//------------------------------------------------------------------------------
export type {
  StringSchema,
  NumberSchema,
  BooleanSchema,
  DateSchema,
  ArraySchema,
  ObjectSchema,
  OptionalSchema,
  DefaultedSchema,
} from "./schemas.js";
