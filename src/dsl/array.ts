//------------------------------------------------------------------------------
import type { Schema, Infer } from "./types.ts";

//------------------------------------------------------------------------------
//------------------------------------------------------------------------------
export interface ArraySchema<S extends Schema<any>> extends Schema<Infer<S>[]> {
  kind: "array";
  element: S;
}

//------------------------------------------------------------------------------
export const array = <S extends Schema<any>>(element: S): ArraySchema<S> => ({
  kind: "array",
  element,
});
