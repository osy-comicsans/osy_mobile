import { useState } from 'react';

import { fieldErrors } from '../utils/authForm';

type Schema = Parameters<typeof fieldErrors>[0];

// A field shows errors after it first loses focus, then updates as the user types.
export function useFormErrors<Field extends string>(schema: Schema, values: Record<Field, string>) {
  const [touched, setTouched] = useState<ReadonlySet<string>>(new Set());
  const errors = fieldErrors(schema, values);

  return {
    errors,
    errorFor: (field: Field) => (touched.has(field) ? errors[field] : undefined),
    touch: (field: Field) => setTouched((current) => new Set(current).add(field)),
    touchAll: () => setTouched(new Set(Object.keys(values))),
  };
}
