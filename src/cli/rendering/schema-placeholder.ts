import type {
  Schema,
  Infer,
  ArraySchema,
  ObjectSchema,
  OptionalSchema,
  DefaultedSchema,
} from "../../dsl/schemas.ts";

//------------------------------------------------------------------------------
//------------------------------------------------------------------------------
function cloneDeep<T>(v: T): T {
  if (Array.isArray(v)) return v.map(cloneDeep) as any;
  if (v && typeof v === "object") {
    const out: any = {};
    for (const k of Object.keys(v as any)) out[k] = cloneDeep((v as any)[k]);
    return out;
  }
  return v;
}

//------------------------------------------------------------------------------
export function makePlaceholderData<S extends Schema<any>>(
  schema: S,
  options: {
    optionalAsUndefined?: boolean;
    arrayLength?: number;
  } = {},
): Infer<S> {
  const optionalAsUndefined = options.optionalAsUndefined ?? true;
  const arrayLength = options.arrayLength ?? 1;

  const make = (s: Schema<any>): any => {
    switch (s.kind) {
      case "string": {
        return "";
      }

      case "number": {
        return "" as any;
      }

      case "boolean": {
        return false;
      }

      case "array": {
        const as = s as ArraySchema<Schema<any>>;
        const item = make(as.element);
        // Ensure each element is its own copy (important for objects)
        return Array.from({ length: arrayLength }, () => cloneDeep(item));
      }

      case "object": {
        const os = s as ObjectSchema<Record<string, Schema<any>>>;
        const out: any = {};
        for (const key of Object.keys(os.shape)) {
          out[key] = make(os.shape[key]);
        }
        return out;
      }

      case "optional": {
        const opt = s as OptionalSchema<Schema<any>>;
        return optionalAsUndefined ? undefined : make(opt.inner);
      }

      case "default": {
        const def = s as DefaultedSchema<Schema<any>>;
        // Use the schema’s default value (clone to avoid shared refs)
        return cloneDeep(def.value);
      }

      default: {
        // If you later add kinds, this protects you at runtime.
        const _exhaustive: never = s.kind as never;
        throw new Error(`Unknown schema kind: ${String(_exhaustive)}`);
      }
    }
  };

  return make(schema) as Infer<S>;
}
