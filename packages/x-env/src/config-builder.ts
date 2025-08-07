/**
 * Type-safe configuration builder utilities
 * Provides helper functions to create strongly typed SafenvConfig
 */

import type {
  SafenvConfig,
  SafenvVariable,
  SafenvVariables,
  StringConstraints,
  NumberConstraints,
  ArrayConstraints,
  ObjectConstraints,
  StandardSchemaV1,
} from './types.ts'

// Helper function to create string variables
export function stringVar(options: {
  description?: string
  default?: string
  required?: boolean
  constraints?: StringConstraints
  validate?: (value: string) => boolean | string
  schema?: StandardSchemaV1<unknown, string>
}): SafenvVariable<'string'> {
  return {
    type: 'string',
    ...options,
  }
}

// Helper function to create number variables
export function numberVar(options: {
  description?: string
  default?: number
  required?: boolean
  constraints?: NumberConstraints
  validate?: (value: number) => boolean | string
  schema?: StandardSchemaV1<unknown, number>
}): SafenvVariable<'number'> {
  return {
    type: 'number',
    ...options,
  }
}

// Helper function to create boolean variables
export function booleanVar(options: {
  description?: string
  default?: boolean
  required?: boolean
  validate?: (value: boolean) => boolean | string
  schema?: StandardSchemaV1<unknown, boolean>
}): SafenvVariable<'boolean'> {
  return {
    type: 'boolean',
    ...options,
  }
}

// Helper function to create array variables
export function arrayVar(options: {
  description?: string
  default?: unknown[]
  required?: boolean
  constraints?: ArrayConstraints
  validate?: (value: unknown[]) => boolean | string
  schema?: StandardSchemaV1<unknown, unknown[]>
}): SafenvVariable<'array'> {
  return {
    type: 'array',
    ...options,
  }
}

// Helper function to create object variables
export function objectVar(options: {
  description?: string
  default?: Record<string, unknown>
  required?: boolean
  constraints?: ObjectConstraints
  validate?: (value: Record<string, unknown>) => boolean | string
  schema?: StandardSchemaV1<unknown, Record<string, unknown>>
}): SafenvVariable<'object'> {
  return {
    type: 'object',
    ...options,
  }
}

// Type-safe config builder
export function defineConfig<T extends SafenvVariables>(
  config: SafenvConfig<T>
): SafenvConfig<T> {
  return config
}

// Constraint builders for common patterns
export const constraints = {
  // String constraints
  string: {
    nonEmpty: (): StringConstraints => ({ minLength: 1 }),
    email: (): StringConstraints => ({ format: 'email' }),
    url: (): StringConstraints => ({ format: 'url' }),
    uuid: (): StringConstraints => ({ format: 'uuid' }),
    semver: (): StringConstraints => ({ format: 'semver' }),
    length: (min: number, max?: number): StringConstraints => ({
      minLength: min,
      maxLength: max,
    }),
    pattern: (regex: RegExp | string): StringConstraints => ({
      pattern: regex,
    }),
  },

  // Number constraints
  number: {
    positive: (): NumberConstraints => ({ min: 0 }),
    range: (min: number, max: number): NumberConstraints => ({ min, max }),
    integer: (): NumberConstraints => ({ integer: true }),
    port: (): NumberConstraints => ({ min: 1, max: 65535, integer: true }),
    percentage: (): NumberConstraints => ({ min: 0, max: 100 }),
    multipleOf: (divisor: number): NumberConstraints => ({
      multipleOf: divisor,
    }),
  },

  // Array constraints
  array: {
    nonEmpty: (): ArrayConstraints => ({ minItems: 1 }),
    maxItems: (max: number): ArrayConstraints => ({ maxItems: max }),
    unique: (): ArrayConstraints => ({ uniqueItems: true }),
    stringArray: (): ArrayConstraints => ({ itemType: 'string' }),
    numberArray: (): ArrayConstraints => ({ itemType: 'number' }),
  },
}

// Pre-defined common variable patterns
export const commonVars = {
  appName: (defaultName = 'My App') =>
    stringVar({
      description: 'Application name',
      default: defaultName,
      required: false,
      constraints: constraints.string.nonEmpty(),
    }),

  port: (defaultPort = 3000) =>
    numberVar({
      description: 'Server port',
      default: defaultPort,
      required: false,
      constraints: constraints.number.port(),
    }),

  databaseUrl: () =>
    stringVar({
      description: 'Database connection URL',
      required: true,
      constraints: constraints.string.url(),
    }),

  adminEmail: (defaultEmail = 'admin@example.com') =>
    stringVar({
      description: 'Administrator email address',
      default: defaultEmail,
      required: false,
      constraints: constraints.string.email(),
    }),

  debug: () =>
    booleanVar({
      description: 'Enable debug mode',
      default: false,
      required: false,
    }),

  featureFlags: () =>
    arrayVar({
      description: 'Enabled feature flags',
      default: [],
      required: false,
      constraints: {
        ...constraints.array.stringArray(),
        ...constraints.array.unique(),
      },
    }),

  timeout: (defaultTimeout = 5000) =>
    numberVar({
      description: 'Request timeout in milliseconds',
      default: defaultTimeout,
      required: false,
      constraints: constraints.number.range(1000, 60000),
    }),
}

// Validation helpers
export const validators = {
  string: {
    alphanumeric: (value: string) =>
      /^[a-zA-Z0-9]+$/.test(value) || 'Must contain only letters and numbers',

    noSpaces: (value: string) => !/\s/.test(value) || 'Must not contain spaces',

    slug: (value: string) =>
      /^[a-z0-9-]+$/.test(value) ||
      'Must be a valid slug (lowercase, numbers, hyphens only)',
  },

  number: {
    even: (value: number) => value % 2 === 0 || 'Must be an even number',

    powerOfTwo: (value: number) =>
      (value & (value - 1)) === 0 || 'Must be a power of 2',
  },

  array: {
    noDuplicates: (value: unknown[]) =>
      new Set(value).size === value.length || 'Must not contain duplicates',
  },
}
