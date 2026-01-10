//------------------------------------------------------------------------------
import type { StringSchema } from "./string.js";
import type { NumberSchema } from "./number.js";
import type { ArraySchema } from "./array.js";
import type { ObjectSchema } from "./object.js";
import type { OptionalSchema } from "./optional.js";
import type { DefaultedSchema } from "./defaulted.js";

//------------------------------------------------------------------------------
export interface Schema<T> {
  readonly _type?: T;
  kind: string;
}

//------------------------------------------------------------------------------
export type Infer<S extends Schema<any>> =
  S extends Schema<infer T> ? T : never;

//------------------------------------------------------------------------------
export type AnySchema =
  | StringSchema
  | NumberSchema
  | OptionalSchema<any>
  | DefaultedSchema<any>
  | ArraySchema<any>
  | ObjectSchema<any>;

//------------------------------------------------------------------------------
export type { StringSchema } from "./string.js";
export type { NumberSchema } from "./number.js";
export type { ArraySchema } from "./array.js";
export type { ObjectSchema } from "./object.js";
export type { OptionalSchema } from "./optional.js";
export type { DefaultedSchema } from "./defaulted.js";
