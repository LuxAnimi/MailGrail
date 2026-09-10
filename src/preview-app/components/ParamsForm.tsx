import { useCallback, useMemo } from "react";

//------------------------------------------------------------------------------
import { makePlaceholderData } from "@/cli/rendering/schema-placeholder";

//------------------------------------------------------------------------------
import type {
  Schema,
  NumberSchema,
  ObjectSchema,
  ArraySchema,
  OptionalSchema,
  DefaultedSchema,
} from "@/dsl/schemas";

//------------------------------------------------------------------------------
type OnChange<T> = (value: T) => void;

//------------------------------------------------------------------------------
//------------------------------------------------------------------------------
export const ParamsForm = ({
  schema,
  value,
  onChange,
}: {
  schema: Schema<any>;
  value: any;
  onChange: OnChange<any>;
}) => (
  <div className="params-form">
    <SchemaField schema={schema} value={value} onChange={onChange} label={null} depth={0} />
  </div>
);

//------------------------------------------------------------------------------
//------------------------------------------------------------------------------
const SchemaField = ({
  schema,
  value,
  onChange,
  label,
  depth,
}: {
  schema: Schema<any>;
  value: any;
  onChange: OnChange<any>;
  label: string | null;
  depth: number;
}) => {
  switch (schema.kind) {
    case "string":
      return <StringField value={value} onChange={onChange} label={label} />;
    case "number":
      return (
        <NumberField
          schema={schema as NumberSchema}
          value={value}
          onChange={onChange}
          label={label}
        />
      );
    case "boolean":
      return <BooleanField value={value} onChange={onChange} label={label} />;
    case "object":
      return (
        <ObjectField
          schema={schema as ObjectSchema<any>}
          value={value}
          onChange={onChange}
          label={label}
          depth={depth}
        />
      );
    case "array":
      return (
        <ArrayField
          schema={schema as ArraySchema<any>}
          value={value}
          onChange={onChange}
          label={label}
          depth={depth}
        />
      );
    case "optional":
      return (
        <OptionalField
          schema={schema as OptionalSchema<any>}
          value={value}
          onChange={onChange}
          label={label}
          depth={depth}
        />
      );
    case "default":
      return (
        <SchemaField
          schema={(schema as DefaultedSchema<any>).inner}
          value={value}
          onChange={onChange}
          label={label}
          depth={depth}
        />
      );
    default:
      return null;
  }
};

//------------------------------------------------------------------------------
//------------------------------------------------------------------------------
const StringField = ({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: OnChange<string>;
  label: string | null;
}) => (
  <div className="field">
    {label && <label className="field-label">{label}</label>}
    <input
      className="field-input"
      type="text"
      placeholder={label ? `<${label}>` : undefined}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
    />
  </div>
);

//------------------------------------------------------------------------------
//------------------------------------------------------------------------------
const NumberField = ({
  schema,
  value,
  onChange,
  label,
}: {
  schema: NumberSchema;
  value: number | "";
  onChange: OnChange<number | "">;
  label: string | null;
}) => (
  <div className="field">
    {label && <label className="field-label">{label}</label>}
    <input
      className="field-input"
      type="number"
      step={schema.int ? 1 : "any"}
      placeholder={label ? `<${label}>` : undefined}
      value={value ?? ""}
      onChange={(e) => {
        if (e.target.value === "") return onChange("");
        const n = schema.int
          ? parseInt(e.target.value, 10)
          : parseFloat(e.target.value);
        if (!isNaN(n)) onChange(n);
      }}
    />
  </div>
);

//------------------------------------------------------------------------------
//------------------------------------------------------------------------------
const BooleanField = ({
  value,
  onChange,
  label,
}: {
  value: boolean;
  onChange: OnChange<boolean>;
  label: string | null;
}) => (
  <div className="field field-boolean">
    <label className="field-boolean-label">
      <input
        className="field-checkbox"
        type="checkbox"
        checked={value ?? false}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label && <span className="field-label">{label}</span>}
    </label>
  </div>
);

//------------------------------------------------------------------------------
//------------------------------------------------------------------------------
const ObjectField = ({
  schema,
  value,
  onChange,
  label,
  depth,
}: {
  schema: ObjectSchema<any>;
  value: any;
  onChange: OnChange<any>;
  label: string | null;
  depth: number;
}) => {
  const fields = (
    <div className="object-fields">
      {Object.entries(schema.shape).map(([key, fieldSchema]) => (
        <SchemaField
          key={key}
          schema={fieldSchema as Schema<any>}
          value={value?.[key]}
          onChange={(newVal) => onChange({ ...value, [key]: newVal })}
          label={key}
          depth={depth + 1}
        />
      ))}
    </div>
  );

  if (label === null) return fields;

  return (
    <div className="field field-group">
      <label className="field-label field-group-label">{label}</label>
      {fields}
    </div>
  );
};

//------------------------------------------------------------------------------
//------------------------------------------------------------------------------
const ArrayField = ({
  schema,
  value,
  onChange,
  label,
  depth,
}: {
  schema: ArraySchema<any>;
  value: any[];
  onChange: OnChange<any[]>;
  label: string | null;
  depth: number;
}) => {
  const arr = useMemo(() => value ?? [], [value]);

  const addItem = useCallback(() => {
    onChange([...arr, makePlaceholderData(schema.element)]);
  }, [arr, schema.element, onChange]);

  const removeItem = useCallback(
    (index: number) => {
      onChange(arr.filter((_, i) => i !== index));
    },
    [arr, onChange],
  );

  const updateItem = useCallback(
    (index: number, newVal: any) => {
      const next = [...arr];
      next[index] = newVal;
      onChange(next);
    },
    [arr, onChange],
  );

  return (
    <div className="field field-array">
      {label && <label className="field-label">{label}</label>}
      <div className="array-items">
        {arr.map((item, index) => (
          <div className="array-item" key={index}>
            <div className="array-item-header">
              <span className="array-index">{index}</span>
              <button
                type="button"
                className="array-remove"
                onClick={() => removeItem(index)}
              >
                ×
              </button>
            </div>
            <div className="array-item-content">
              <SchemaField
                schema={schema.element}
                value={item}
                onChange={(newVal) => updateItem(index, newVal)}
                label={null}
                depth={depth + 1}
              />
            </div>
          </div>
        ))}
      </div>
      <button type="button" className="array-add" onClick={addItem}>
        + add item
      </button>
    </div>
  );
};

//------------------------------------------------------------------------------
//------------------------------------------------------------------------------
const OptionalField = ({
  schema,
  value,
  onChange,
  label,
  depth,
}: {
  schema: OptionalSchema<any>;
  value: any;
  onChange: OnChange<any>;
  label: string | null;
  depth: number;
}) => {
  const isPresent = value !== undefined;

  const toggle = useCallback(() => {
    onChange(isPresent ? undefined : makePlaceholderData(schema.inner));
  }, [isPresent, schema.inner, onChange]);

  return (
    <div className="field field-optional">
      <div className="optional-header">
        <label className="field-boolean-label">
          <input
            type="checkbox"
            className="field-checkbox"
            checked={isPresent}
            onChange={toggle}
          />
          {label && <span className="field-label">{label}</span>}
        </label>
      </div>
      {isPresent && (
        <div className="optional-content">
          <SchemaField
            schema={schema.inner}
            value={value}
            onChange={onChange}
            label={null}
            depth={depth + 1}
          />
        </div>
      )}
    </div>
  );
};
