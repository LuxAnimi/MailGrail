//------------------------------------------------------------------------------
import type { Schema, Infer } from "./types.ts";

//------------------------------------------------------------------------------
//------------------------------------------------------------------------------
export interface ObjectSchema<Shape extends Record<string, Schema<any>>>
  extends Schema<{
    [K in keyof Shape]: Infer<Shape[K]>;
  }> {
  kind: "object";
  shape: Shape;
}

//------------------------------------------------------------------------------
export const object = <Shape extends Record<string, Schema<any>>>(
  shape: Shape,
): ObjectSchema<Shape> => ({
  kind: "object",
  shape,
});
