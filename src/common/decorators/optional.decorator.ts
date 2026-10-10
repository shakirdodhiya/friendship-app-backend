import { IsOptional, ValidateIf } from 'class-validator';

/** The field may be omitted, but if present it must not be `null`. */
export const Optional = () => ValidateIf((_, value) => value !== undefined);

/** The field may be omitted or `null` (which clears it). */
export const Nullable = () => IsOptional();
