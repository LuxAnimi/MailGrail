//------------------------------------------------------------------------------
// Utility
export interface Schema<T> {
  readonly _type?: T;
  kind: string;
}

//------------------------------------------------------------------------------
export type Infer<S extends Schema<any>> =
  S extends Schema<infer T> ? T : never;

//------------------------------------------------------------------------------
// String
export interface StringSchema extends Schema<string> {
  kind: "string";
  minLength?: number;
}

//------------------------------------------------------------------------------
export const string = (): StringSchema => ({
  kind: "string",
});

//------------------------------------------------------------------------------
// Number
export interface NumberSchema extends Schema<number> {
  kind: "number";
  int?: boolean;
}

//------------------------------------------------------------------------------
export const number = (): NumberSchema => ({
  kind: "number",
});

//------------------------------------------------------------------------------
// Boolean
export interface BooleanSchema extends Schema<boolean> {
  kind: "boolean";
  int?: boolean;
}

//------------------------------------------------------------------------------
export const boolean = (): BooleanSchema => ({
  kind: "boolean",
});

//------------------------------------------------------------------------------
// Array
export interface ArraySchema<S extends Schema<any>> extends Schema<Infer<S>[]> {
  kind: "array";
  element: S;
}

//------------------------------------------------------------------------------
export const array = <S extends Schema<any>>(element: S): ArraySchema<S> => ({
  kind: "array",
  element,
});

//------------------------------------------------------------------------------
// Object
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

//------------------------------------------------------------------------------
// Optional
/**
 * The parameter may be omitted, and renders as an empty string when it is.
 * Use `default` instead when an absent value should render as something.
 */
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

//------------------------------------------------------------------------------
// Default
/**
 * The parameter may be omitted, and renders as `value` when it is -- so the
 * emitted type is optional on input but never undefined at render time.
 *
 * `Exclude<..., undefined>` keeps `default(optional(x), v)` composing to the
 * same thing, so the nested spelling stays valid without being necessary.
 */
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
