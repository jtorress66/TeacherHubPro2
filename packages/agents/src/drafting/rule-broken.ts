import type { ValidationError } from '@thp/domain';

/** A validation error as words the model can act on. */
export const ruleBroken = ({ field, code }: ValidationError): string =>
  code === 'too_long'
    ? `"${field}" is too long; keep it within the limit given in the shape.`
    : `"${field}" breaks a rule (${code}).`;
