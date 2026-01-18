import type { ReactElement, ReactNode } from "react";

//------------------------------------------------------------------------------
import type { Infer, Schema } from "@/dsl/schemas.js";

//------------------------------------------------------------------------------
//------------------------------------------------------------------------------
type Primitive = string | number | boolean | null | undefined;

//------------------------------------------------------------------------------
type Prev = [never, 0, 1, 2, 3, 4, 5, 6];

//------------------------------------------------------------------------------
type Depth = 0 | 1 | 2 | 3 | 4 | 5 | 6;

//------------------------------------------------------------------------------
type IsAny<T> = 0 extends 1 & T ? true : false;

//------------------------------------------------------------------------------
export type EmptyObj = Record<string, never>;

//------------------------------------------------------------------------------
type IsUnknown<T> =
  IsAny<T> extends true
    ? false
    : unknown extends T
      ? T extends unknown
        ? true
        : false
      : false;

//------------------------------------------------------------------------------
type Join<K, P> = K extends string | number
  ? P extends string | number
    ? `${K}.${P}`
    : never
  : never;

//------------------------------------------------------------------------------
type RootPath<T, D extends Depth = 4> = D extends 0
  ? never
  : T extends Primitive | Date
    ? never
    : T extends readonly any[]
      ? never
      : {
          [K in keyof T & string]: T[K] extends Primitive | Date
            ? K
            : T[K] extends readonly any[]
              ? K // allow the array key itself, but do NOT recurse
              : K | Join<K, RootPath<T[K], Prev[D]>>;
        }[keyof T & string];

//------------------------------------------------------------------------------
type PathValue<T, P extends string, D extends Depth = 4> =
  // Bail out early (prevents huge instantiations)
  IsAny<T> extends true
    ? any
    : IsUnknown<T> extends true
      ? unknown
      : D extends 0
        ? unknown
        : T extends Primitive
          ? T
          : P extends `${infer K}.${infer R}`
            ? K extends keyof T
              ? PathValue<T[K], R, Prev[D]>
              : unknown
            : P extends keyof T
              ? T[P]
              : unknown;

//------------------------------------------------------------------------------
type Renderable = string | number | boolean | null | undefined | Date;
type Boolish = boolean | null | undefined;
type IsScopeable<V> = V extends Primitive
  ? false
  : V extends Date
    ? false
    : V extends readonly any[]
      ? false
      : V extends object
        ? true
        : false;

//------------------------------------------------------------------------------
type KeepIf<T, P extends string, D extends Depth, Cond> =
  PathValue<T, P, D> extends Cond ? P : never;

//------------------------------------------------------------------------------
type Elem<T> = T extends readonly (infer U)[] ? U : never;

//------------------------------------------------------------------------------
type RenderablePath<T, D extends Depth = 4> =
  RootPath<T, D> extends infer P
    ? P extends string
      ? KeepIf<T, P, D, Renderable>
      : never
    : never;

type BooleanPath<T, D extends Depth = 4> =
  RootPath<T, D> extends infer P
    ? P extends string
      ? KeepIf<T, P, D, Boolish>
      : never
    : never;

type IterablePath<T, D extends Depth = 4> =
  RootPath<T, D> extends infer P
    ? P extends string
      ? KeepIf<T, P, D, readonly any[]>
      : never
    : never;

type ScopeablePath<T, D extends Depth = 4> =
  RootPath<T, D> extends infer P
    ? P extends string
      ? IsScopeable<PathValue<T, P, D>> extends true
        ? P
        : never
      : never
    : never;

//------------------------------------------------------------------------------
type ObjectItemContext<TObj, R, D extends Depth> = TemplateContext<TObj, R, D>;

//------------------------------------------------------------------------------
type ItemContext<T, R, D extends Depth = 4> =
  // nested array item
  T extends readonly any[]
    ? ArrayItemContext<T, R, D>
    : // renderable primitive
      T extends Renderable
      ? PrimitiveItemContext
      : // scopeable object
        T extends object
        ? ObjectItemContext<T, R, D>
        : // fallback (shouldn’t happen much)
          unknown;

//------------------------------------------------------------------------------
type RenderCap<T, R, D extends Depth> = {
  render: <P extends RenderablePath<T, D>>(path: P) => R;
};

//------------------------------------------------------------------------------
type WhenCap<T, D extends Depth> = [BooleanPath<T, D>] extends [never]
  ? unknown
  : {
      when: <P extends BooleanPath<T, D>>(
        path: P,
        render: () => ReactNode,
        otherwise?: () => ReactNode,
      ) => ReactNode;

      unless: <P extends BooleanPath<T, D>>(
        path: P,
        render: () => ReactNode,
        otherwise?: () => ReactNode,
      ) => ReactNode;
    };

//------------------------------------------------------------------------------
type EachCap<T, R, D extends Depth> = [IterablePath<T, D>] extends [never]
  ? unknown
  : {
      each: <P extends IterablePath<T, D>>(
        path: P,
        render: (
          item: ItemContext<Elem<PathValue<T, P, D>>, R, D>,
          index: number,
        ) => ReactNode,
      ) => ReactNode;
    };

//------------------------------------------------------------------------------
type WithCap<T, R, D extends Depth> = [ScopeablePath<T, D>] extends [never]
  ? unknown
  : {
      with: <P extends ScopeablePath<T, D>>(
        path: P,
        render: (
          scoped: TemplateContext<PathValue<T, P, D>, R, D>,
        ) => ReactNode,
      ) => ReactNode;
    };

//------------------------------------------------------------------------------
type PrimitiveItemContext = {
  render: () => string;
};

//------------------------------------------------------------------------------
type ArrayItemContext<TArr extends readonly any[], R, D extends Depth> = {
  each: (
    render: (item: ItemContext<Elem<TArr>, R, D>, index: number) => ReactNode,
  ) => ReactNode;
};

//------------------------------------------------------------------------------
export type TemplateContext<T, R, D extends Depth = 4> = RenderCap<T, R, D> &
  WhenCap<T, D> &
  EachCap<T, R, D> &
  WithCap<T, R, D>;

//------------------------------------------------------------------------------
export type RenderTemplateContext<T, D extends Depth = 4> = TemplateContext<
  T,
  ReactNode,
  D
>;
//------------------------------------------------------------------------------
export type PreviewTemplateContext<T, D extends Depth = 4> = TemplateContext<
  T,
  ReactNode,
  D
>;

//------------------------------------------------------------------------------
export interface TemplateDefinition<S extends Schema<any>> {
  name: string;
  subjectTemplate: (params: Infer<S>) => string;
  textTemplate: (params: Infer<S>) => string;
  htmlTemplate:
    | ((mg: PreviewTemplateContext<Infer<S>>) => ReactElement)
    | ((mg: RenderTemplateContext<Infer<S>>) => ReactElement);
  sender?: string;
  params: S;
}

//------------------------------------------------------------------------------
export type ParamGetter<T, D extends Depth = 4> = {
  <P extends RootPath<T, D>>(path: P): ReactNode;
  raw(path: string): string;
};
