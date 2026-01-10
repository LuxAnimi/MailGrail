//------------------------------------------------------------------------------
import type { Schema, Infer } from "./types.ts";

//------------------------------------------------------------------------------
//------------------------------------------------------------------------------
export interface OptionalSchema<S extends Schema<any>>
  extends Schema<Infer<S> | undefined> {
  kind: "optional";
  inner: S;
}

//------------------------------------------------------------------------------
export const optional = <S extends Schema<any>>(
  schema: S,
): OptionalSchema<S> => ({
  kind: "optional",
  inner: schema,
});
