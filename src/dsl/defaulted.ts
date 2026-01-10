//------------------------------------------------------------------------------
import type { Schema, Infer } from "./types.ts";

//------------------------------------------------------------------------------
//------------------------------------------------------------------------------
export interface DefaultedSchema<S extends Schema<any>>
  extends Schema<Exclude<Infer<S>, undefined>> {
  kind: "default";
  inner: S;
  value: Exclude<Infer<S>, undefined>;
}

//------------------------------------------------------------------------------
export const defaulted = <S extends Schema<any>>(
  schema: S,
  value: Exclude<Infer<S>, undefined>,
): DefaultedSchema<S> => ({
  kind: "default",
  inner: schema,
  value,
});
